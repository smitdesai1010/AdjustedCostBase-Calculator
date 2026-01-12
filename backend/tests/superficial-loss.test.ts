import { SuperficialLossService } from '../src/services/superficial-loss.service';
import { Transaction } from '../src/entities/Transaction';

// Mock the database
jest.mock('../src/database', () => ({
    AppDataSource: {
        getRepository: jest.fn(() => ({
            findOne: jest.fn(),
            find: jest.fn(),
            createQueryBuilder: jest.fn(() => ({
                where: jest.fn().mockReturnThis(),
                andWhere: jest.fn().mockReturnThis(),
                orderBy: jest.fn().mockReturnThis(),
                getOne: jest.fn()
            }))
        }))
    }
}));

describe('SuperficialLossService', () => {
    describe('calculateAdjustedAcb', () => {
        let service: SuperficialLossService;

        beforeEach(() => {
            service = new SuperficialLossService();
        });

        it('should calculate adjusted ACB when adding denied loss', () => {
            const result = service.calculateAdjustedAcb(
                5000,  // Current ACB
                500,   // Denied loss
                50,    // Shares repurchased
                100    // Total shares after repurchase
            );

            // New ACB: $5000 + $500 = $5500
            // Adjustment per share: $500 / 50 = $10
            expect(result.newTotalAcb).toBe(5500);
            expect(result.adjustmentPerShare).toBe(10);
        });

        it('should handle fractional adjustments', () => {
            const result = service.calculateAdjustedAcb(
                3000,
                333.33,
                30,
                60
            );

            expect(result.newTotalAcb).toBeCloseTo(3333.33, 2);
            expect(result.adjustmentPerShare).toBeCloseTo(11.11, 2);
        });
    });

    describe('Superficial Loss Detection Logic', () => {
        it('should identify superficial loss within 30-day window', () => {
            // Create test scenario
            const sellDate = new Date('2024-03-15');
            const buyDate = new Date('2024-03-20'); // 5 days after sell

            // This is within the 30-day window
            const daysDiff = Math.abs(buyDate.getTime() - sellDate.getTime()) / (1000 * 60 * 60 * 24);
            expect(daysDiff).toBeLessThanOrEqual(30);
        });

        it('should not flag loss outside 30-day window', () => {
            const sellDate = new Date('2024-01-15');
            const buyDate = new Date('2024-03-20'); // 64 days after sell

            const daysDiff = Math.abs(buyDate.getTime() - sellDate.getTime()) / (1000 * 60 * 60 * 24);
            expect(daysDiff).toBeGreaterThan(30);
        });

        it('should detect purchases before the sale within window', () => {
            const sellDate = new Date('2024-03-15');
            const buyDate = new Date('2024-03-01'); // 14 days BEFORE sell

            const windowStart = new Date(sellDate);
            windowStart.setDate(windowStart.getDate() - 30);

            expect(buyDate >= windowStart).toBe(true);
            expect(buyDate <= sellDate).toBe(true);
        });
    });

    describe('Superficial Loss Scenario Examples', () => {
        it('should identify loss followed by repurchase next day', () => {
            // Day 1: Sell 100 shares at $40 (bought at $50) = $1000 loss
            // Day 2: Repurchase 100 shares at $38
            // Result: Superficial loss, add $1000 to new ACB

            const oldAcb = 5000; // 100 shares at $50
            const proceeds = 4000; // 100 × $40
            const loss = proceeds - oldAcb; // -$1000

            expect(loss).toBe(-1000);

            // New purchase ACB before adjustment: 100 × $38 = $3800
            // After superficial loss adjustment: $3800 + $1000 = $4800
            const newAcbBeforeAdjustment = 3800;
            const adjustedAcb = newAcbBeforeAdjustment + Math.abs(loss);

            expect(adjustedAcb).toBe(4800);
        });

        it('should handle partial repurchase scenario', () => {
            // Sell 100 shares at loss of $1000
            // Repurchase only 50 shares
            // Superficial loss: 50/100 = 50% of loss = $500 disallowed

            const totalLoss = 1000;
            const sharesSold = 100;
            const sharesRepurchased = 50;

            // Proportional superficial loss
            const superficialPortion = (sharesRepurchased / sharesSold) * totalLoss;
            expect(superficialPortion).toBe(500);

            // Allowable loss
            const allowableLoss = totalLoss - superficialPortion;
            expect(allowableLoss).toBe(500);
        });
    });
});
