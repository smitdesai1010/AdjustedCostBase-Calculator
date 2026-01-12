import { Decimal, roundToCurrency, roundToShares, safeDivide, toDecimal } from '../src/utils/decimal';

describe('Decimal Utilities', () => {
    describe('roundToCurrency', () => {
        it('should round to 2 decimal places', () => {
            expect(roundToCurrency(10.125)).toBe(10.13); // Round up
            expect(roundToCurrency(10.124)).toBe(10.12); // Round down
            expect(roundToCurrency(10.1)).toBe(10.1);
            expect(roundToCurrency(10)).toBe(10);
        });

        it('should handle Decimal objects', () => {
            expect(roundToCurrency(new Decimal('10.125'))).toBe(10.13);
        });
    });

    describe('roundToShares', () => {
        it('should round to 6 decimal places', () => {
            expect(roundToShares(1.1234567)).toBe(1.123457); // Round up
            expect(roundToShares(1.1234564)).toBe(1.123456); // Round down
        });
    });

    describe('safeDivide', () => {
        it('should divide normally when denominator is not zero', () => {
            const result = safeDivide(100, 4);
            expect(result.toNumber()).toBe(25);
        });

        it('should return 0 when denominator is zero', () => {
            const result = safeDivide(100, 0);
            expect(result.toNumber()).toBe(0);
        });

        it('should handle Decimal inputs', () => {
            const result = safeDivide(new Decimal(100), new Decimal(3));
            expect(result.toDecimalPlaces(4).toNumber()).toBeCloseTo(33.3333, 4);
        });
    });

    describe('toDecimal', () => {
        it('should convert numbers to Decimal', () => {
            const d = toDecimal(123.45);
            expect(d.toNumber()).toBe(123.45);
        });

        it('should convert strings to Decimal', () => {
            const d = toDecimal('123.45');
            expect(d.toNumber()).toBe(123.45);
        });

        it('should handle precision for financial calculations', () => {
            // 0.1 + 0.2 = 0.3 (fails in regular JS floating point)
            const a = toDecimal('0.1');
            const b = toDecimal('0.2');
            const sum = a.plus(b);
            expect(sum.toNumber()).toBe(0.3);
        });
    });
});

describe('Financial Calculation Precision', () => {
    it('should handle large numbers without precision loss', () => {
        const largeValue = toDecimal('999999999.99');
        const result = largeValue.times(1.35);
        expect(roundToCurrency(result)).toBe(1349999999.99);
    });

    it('should calculate ACB correctly with many decimal places', () => {
        // Simulate: 123.456789 shares at $99.9999 per share
        const shares = toDecimal('123.456789');
        const price = toDecimal('99.9999');
        const cost = shares.times(price);
        const fees = toDecimal('9.99');
        const totalAcb = cost.plus(fees);

        // Expected: 123.456789 × 99.9999 + 9.99 = 12345.555458... + 9.99 = 12355.54...
        expect(roundToCurrency(totalAcb)).toBeCloseTo(12355.55, 0);
    });

    it('should maintain precision through multiple operations', () => {
        let acb = toDecimal('10000.00');
        const shares = toDecimal('100');

        // Simulate 10 small purchases adding $100.01 each
        for (let i = 0; i < 10; i++) {
            acb = acb.plus(toDecimal('100.01'));
        }

        expect(roundToCurrency(acb)).toBe(11000.10);
    });
});
