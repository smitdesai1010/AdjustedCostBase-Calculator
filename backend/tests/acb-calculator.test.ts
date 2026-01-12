import { ACBCalculatorService, ACBCalculationInput } from '../src/services/acb-calculator.service';

describe('ACBCalculatorService', () => {
    let calculator: ACBCalculatorService;

    beforeEach(() => {
        calculator = new ACBCalculatorService();
    });

    describe('Buy Transactions', () => {
        it('should calculate ACB correctly for initial purchase', () => {
            const input: ACBCalculationInput = {
                transactionType: 'buy',
                quantity: 100,
                pricePerShare: 50,
                priceCurrency: 'CAD',
                fees: 9.99,
                fxRate: 1,
                currentShares: 0,
                currentAcb: 0
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(100);
            expect(result.newAcb).toBe(5009.99); // (100 × $50) + $9.99
            expect(result.newAcbPerShare).toBeCloseTo(50.10, 2);
        });

        it('should calculate ACB correctly for subsequent purchase', () => {
            const input: ACBCalculationInput = {
                transactionType: 'buy',
                quantity: 50,
                pricePerShare: 52,
                priceCurrency: 'CAD',
                fees: 9.99,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5009.99
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(150);
            // Old ACB: $5009.99 + (50 × $52) + $9.99 = $5009.99 + $2600 + $9.99 = $7619.98
            expect(result.newAcb).toBeCloseTo(7619.98, 2);
            expect(result.newAcbPerShare).toBeCloseTo(50.80, 2);
        });

        it('should convert USD purchases to CAD', () => {
            const input: ACBCalculationInput = {
                transactionType: 'buy',
                quantity: 100,
                pricePerShare: 50, // USD
                priceCurrency: 'USD',
                fees: 10, // Already in CAD
                fxRate: 1.35, // 1 USD = 1.35 CAD
                currentShares: 0,
                currentAcb: 0
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(100);
            // (100 × $50 × 1.35) + $10 = $6750 + $10 = $6760
            expect(result.newAcb).toBe(6760);
        });
    });

    describe('Sell Transactions', () => {
        it('should calculate capital gain on profitable sale', () => {
            const input: ACBCalculationInput = {
                transactionType: 'sell',
                quantity: 40,
                pricePerShare: 80,
                priceCurrency: 'CAD',
                fees: 9.99,
                fxRate: 1,
                currentShares: 50,
                currentAcb: 2666.50 // $53.33/share
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(10);
            // ACB used: 40 × $53.33 = $2133.20
            expect(result.acbUsed).toBeCloseTo(2133.20, 2);
            // Proceeds: (40 × $80) - $9.99 = $3190.01
            expect(result.proceeds).toBeCloseTo(3190.01, 2);
            // Capital Gain: $3190.01 - $2133.20 = $1056.81
            expect(result.capitalGain).toBeCloseTo(1056.81, 2);
            // Remaining ACB: $2666.50 - $2133.20 = $533.30
            expect(result.newAcb).toBeCloseTo(533.30, 2);
        });

        it('should calculate capital loss on unprofitable sale', () => {
            const input: ACBCalculationInput = {
                transactionType: 'sell',
                quantity: 50,
                pricePerShare: 40,
                priceCurrency: 'CAD',
                fees: 10,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000 // $50/share
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(50);
            // ACB used: 50 × $50 = $2500
            expect(result.acbUsed).toBe(2500);
            // Proceeds: (50 × $40) - $10 = $1990
            expect(result.proceeds).toBe(1990);
            // Capital Loss: $1990 - $2500 = -$510
            expect(result.capitalGain).toBe(-510);
        });

        it('should throw error when selling more shares than held', () => {
            const input: ACBCalculationInput = {
                transactionType: 'sell',
                quantity: 150,
                pricePerShare: 50,
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000
            };

            expect(() => calculator.calculate(input)).toThrow();
        });
    });

    describe('DRIP Transactions', () => {
        it('should increase ACB by reinvested dividend amount', () => {
            const input: ACBCalculationInput = {
                transactionType: 'drip',
                quantity: 2.5, // New shares acquired
                pricePerShare: 0.50, // Dividend per share
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000
            };

            const result = calculator.calculate(input);

            // Total dividend: $0.50 × 100 shares = $50
            // New ACB: $5000 + $50 = $5050
            // New shares: 100 + 2.5 = 102.5
            expect(result.newShares).toBeCloseTo(102.5, 6);
            expect(result.newAcb).toBe(5050);
        });
    });

    describe('Return of Capital', () => {
        it('should reduce ACB by RoC amount', () => {
            const input: ACBCalculationInput = {
                transactionType: 'roc',
                quantity: 100, // Shares
                pricePerShare: 5, // RoC per share
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000,
                rocPerShare: 5
            };

            const result = calculator.calculate(input);

            // RoC: 100 × $5 = $500
            // New ACB: $5000 - $500 = $4500
            expect(result.newShares).toBe(100);
            expect(result.newAcb).toBe(4500);
        });

        it('should create capital gain when RoC exceeds ACB', () => {
            const input: ACBCalculationInput = {
                transactionType: 'roc',
                quantity: 100,
                pricePerShare: 10, // RoC per share
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 800, // Only $8/share ACB
                rocPerShare: 10
            };

            const result = calculator.calculate(input);

            // RoC: 100 × $10 = $1000
            // ACB: $800
            // Excess (capital gain): $1000 - $800 = $200
            expect(result.newAcb).toBe(0);
            expect(result.capitalGain).toBe(200);
        });
    });

    describe('Stock Splits', () => {
        it('should multiply shares by split ratio while keeping ACB unchanged', () => {
            const input: ACBCalculationInput = {
                transactionType: 'split',
                quantity: 0,
                pricePerShare: 0,
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000,
                ratio: 2 // 2:1 split
            };

            const result = calculator.calculate(input);

            // New shares: 100 × 2 = 200
            // ACB unchanged: $5000
            // New ACB/share: $5000 / 200 = $25
            expect(result.newShares).toBe(200);
            expect(result.newAcb).toBe(5000);
            expect(result.newAcbPerShare).toBe(25);
        });

        it('should handle consolidation (reverse split)', () => {
            const input: ACBCalculationInput = {
                transactionType: 'consolidation',
                quantity: 0,
                pricePerShare: 0,
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000,
                ratio: 0.5 // 1:2 reverse split (halves shares)
            };

            const result = calculator.calculate(input);

            // New shares: 100 × 0.5 = 50
            // ACB unchanged: $5000
            // New ACB/share: $5000 / 50 = $100
            expect(result.newShares).toBe(50);
            expect(result.newAcb).toBe(5000);
            expect(result.newAcbPerShare).toBe(100);
        });
    });

    describe('Edge Cases', () => {
        it('should handle fractional shares', () => {
            const input: ACBCalculationInput = {
                transactionType: 'buy',
                quantity: 0.123456,
                pricePerShare: 1000,
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 0,
                currentAcb: 0
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(0.123456);
            expect(result.newAcb).toBeCloseTo(123.46, 2);
        });

        it('should handle selling all shares', () => {
            const input: ACBCalculationInput = {
                transactionType: 'sell',
                quantity: 100,
                pricePerShare: 60,
                priceCurrency: 'CAD',
                fees: 10,
                fxRate: 1,
                currentShares: 100,
                currentAcb: 5000
            };

            const result = calculator.calculate(input);

            expect(result.newShares).toBe(0);
            expect(result.newAcb).toBe(0);
            // Proceeds: 100 × $60 - $10 = $5990
            // Capital Gain: $5990 - $5000 = $990
            expect(result.capitalGain).toBe(990);
        });

        it('should handle zero fees', () => {
            const input: ACBCalculationInput = {
                transactionType: 'buy',
                quantity: 100,
                pricePerShare: 50,
                priceCurrency: 'CAD',
                fees: 0,
                fxRate: 1,
                currentShares: 0,
                currentAcb: 0
            };

            const result = calculator.calculate(input);

            expect(result.newAcb).toBe(5000);
        });
    });
});

describe("Norbert's Gambit Scenario", () => {
    let calculator: ACBCalculatorService;

    beforeEach(() => {
        calculator = new ACBCalculatorService();
    });

    it('should correctly handle CAD to USD conversion via DLR', () => {
        // Step 1: Buy DLR in CAD
        const buyDlrCad = calculator.calculate({
            transactionType: 'buy',
            quantity: 100,
            pricePerShare: 13.50, // CAD price
            priceCurrency: 'CAD',
            fees: 9.99,
            fxRate: 1,
            currentShares: 0,
            currentAcb: 0
        });

        expect(buyDlrCad.newShares).toBe(100);
        expect(buyDlrCad.newAcb).toBe(1359.99); // $1350 + $9.99

        // Step 2: Journal to DLR.U and sell in USD
        // This is effectively a sell of DLR
        const sellDlrUsd = calculator.calculate({
            transactionType: 'sell',
            quantity: 100,
            pricePerShare: 10, // USD price
            priceCurrency: 'USD',
            fees: 9.99,
            fxRate: 1.35, // USD to CAD rate
            currentShares: buyDlrCad.newShares,
            currentAcb: buyDlrCad.newAcb
        });

        // Proceeds in CAD: (100 × $10 × 1.35) - $9.99 = $1350 - $9.99 = $1340.01
        expect(sellDlrUsd.proceeds).toBeCloseTo(1340.01, 2);
        // ACB used: $1359.99
        // Capital loss: $1340.01 - $1359.99 = -$19.98
        expect(sellDlrUsd.capitalGain).toBeCloseTo(-19.98, 2);
        expect(sellDlrUsd.newShares).toBe(0);
    });
});
