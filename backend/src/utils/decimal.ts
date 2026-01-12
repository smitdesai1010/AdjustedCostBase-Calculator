import Decimal from 'decimal.js';

// Configure Decimal.js for financial calculations
Decimal.set({
    precision: 20,
    rounding: Decimal.ROUND_HALF_UP
});

/**
 * Round to 2 decimal places (CAD currency)
 */
export function roundToCurrency(value: Decimal | number): number {
    const d = new Decimal(value);
    return d.toDecimalPlaces(2, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Round to 6 decimal places (for share quantities)
 */
export function roundToShares(value: Decimal | number): number {
    const d = new Decimal(value);
    return d.toDecimalPlaces(6, Decimal.ROUND_HALF_UP).toNumber();
}

/**
 * Convert to Decimal for precise calculations
 */
export function toDecimal(value: number | string): Decimal {
    return new Decimal(value);
}

/**
 * Safely divide, returning 0 if divisor is 0
 */
export function safeDivide(numerator: number | Decimal, denominator: number | Decimal): Decimal {
    const num = new Decimal(numerator);
    const den = new Decimal(denominator);
    if (den.isZero()) {
        return new Decimal(0);
    }
    return num.dividedBy(den);
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number, currency: string = 'CAD'): string {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency
    }).format(value);
}

/**
 * Format percentage for display
 */
export function formatPercent(value: number): string {
    return new Intl.NumberFormat('en-CA', {
        style: 'percent',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    }).format(value);
}

export { Decimal };
