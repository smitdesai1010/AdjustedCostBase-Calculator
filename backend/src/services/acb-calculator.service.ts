import { Decimal, roundToCurrency, roundToShares, toDecimal, safeDivide } from '../utils/decimal.js';
import { TransactionType } from '../entities/Transaction.js';

/**
 * Input data for ACB calculation
 */
export interface ACBCalculationInput {
    transactionType: TransactionType;
    quantity: number;
    pricePerShare: number;
    priceCurrency: string;
    fees: number;
    fxRate: number; // 1 if CAD, exchange rate for foreign currency

    // Current position state
    currentShares: number;
    currentAcb: number;

    // For corporate actions
    ratio?: number;
    rocPerShare?: number;
    newSecurityAcbPercent?: number; // For spinoffs
    cashPerShare?: number; // For mergers with cash boot
}

/**
 * Result of ACB calculation with full audit trail
 */
export interface ACBCalculationResult {
    // New position state
    newShares: number;
    newAcb: number;
    newAcbPerShare: number;

    // For sell transactions
    capitalGain?: number;
    proceeds?: number;
    acbUsed?: number;

    // Calculation breakdown for auditability
    calculationDetails: CalculationDetails;
}

/**
 * Detailed calculation breakdown for transparency
 */
export interface CalculationDetails {
    type: string;
    steps: CalculationStep[];
    summary: string;
}

export interface CalculationStep {
    description: string;
    formula?: string;
    values?: Record<string, string>;
    result?: string;
}

/**
 * ACB Calculator Service
 * Implements all CRA-compliant ACB calculation rules
 */
export class ACBCalculatorService {

    /**
     * Main calculation entry point - routes to specific calculation method
     */
    calculate(input: ACBCalculationInput): ACBCalculationResult {
        switch (input.transactionType) {
            case 'buy':
                return this.calculateBuy(input);
            case 'sell':
                return this.calculateSell(input);
            case 'dividend':
                return this.calculateDividend(input);
            case 'drip':
                return this.calculateDrip(input);
            case 'roc':
                return this.calculateRoC(input);
            case 'split':
                return this.calculateSplit(input);
            case 'consolidation':
                return this.calculateConsolidation(input);
            case 'merger':
                return this.calculateMerger(input);
            case 'spinoff':
                return this.calculateSpinoff(input);
            case 'transfer_in':
                return this.calculateTransferIn(input);
            case 'transfer_out':
                return this.calculateTransferOut(input);
            default:
                throw new Error(`Unsupported transaction type: ${input.transactionType}`);
        }
    }

    /**
     * BUY Transaction
     * NewACB = OldACB + (Price × Qty) + Fees
     * NewShares = OldShares + Qty
     */
    private calculateBuy(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldAcb = toDecimal(input.currentAcb);
        const oldShares = toDecimal(input.currentShares);
        const qty = toDecimal(input.quantity);
        const price = toDecimal(input.pricePerShare);
        const fxRate = toDecimal(input.fxRate);
        const fees = toDecimal(input.fees);

        // Step 1: Calculate cost in original currency
        const costOriginal = price.times(qty);
        steps.push({
            description: 'Calculate purchase cost in original currency',
            formula: 'Cost = Price × Quantity',
            values: {
                'Price': `$${price.toFixed(4)}`,
                'Quantity': qty.toFixed(6)
            },
            result: `$${costOriginal.toFixed(2)}`
        });

        // Step 2: Convert to CAD if needed
        const costCad = costOriginal.times(fxRate);
        if (input.priceCurrency !== 'CAD') {
            steps.push({
                description: `Convert to CAD using exchange rate`,
                formula: 'Cost (CAD) = Cost × FX Rate',
                values: {
                    'Cost': `$${costOriginal.toFixed(2)} ${input.priceCurrency}`,
                    'FX Rate': fxRate.toFixed(6)
                },
                result: `$${costCad.toFixed(2)} CAD`
            });
        }

        // Step 3: Add fees
        const totalCost = costCad.plus(fees);
        steps.push({
            description: 'Add commission/fees',
            formula: 'Total Cost = Cost (CAD) + Fees',
            values: {
                'Cost (CAD)': `$${costCad.toFixed(2)}`,
                'Fees': `$${fees.toFixed(2)}`
            },
            result: `$${totalCost.toFixed(2)} CAD`
        });

        // Step 4: Calculate new ACB
        const newAcb = oldAcb.plus(totalCost);
        steps.push({
            description: 'Calculate new total ACB',
            formula: 'New ACB = Old ACB + Total Cost',
            values: {
                'Old ACB': `$${oldAcb.toFixed(2)}`,
                'Total Cost': `$${totalCost.toFixed(2)}`
            },
            result: `$${newAcb.toFixed(2)} CAD`
        });

        // Step 5: Calculate new share count
        const newShares = oldShares.plus(qty);
        steps.push({
            description: 'Update share count',
            formula: 'New Shares = Old Shares + Quantity',
            values: {
                'Old Shares': oldShares.toFixed(6),
                'Quantity': qty.toFixed(6)
            },
            result: newShares.toFixed(6)
        });

        // Step 6: Calculate new ACB per share
        const newAcbPerShare = safeDivide(newAcb, newShares);
        steps.push({
            description: 'Calculate ACB per share',
            formula: 'ACB/Share = Total ACB ÷ Shares',
            values: {
                'Total ACB': `$${newAcb.toFixed(2)}`,
                'Shares': newShares.toFixed(6)
            },
            result: `$${newAcbPerShare.toFixed(4)}/share`
        });

        return {
            newShares: roundToShares(newShares),
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            calculationDetails: {
                type: 'BUY',
                steps,
                summary: `Purchased ${qty.toFixed(6)} shares. ACB increased from $${oldAcb.toFixed(2)} to $${newAcb.toFixed(2)}. New ACB/share: $${newAcbPerShare.toFixed(4)}.`
            }
        };
    }

    /**
     * SELL Transaction
     * ACB/share = OldACB / OldShares
     * ACBused = ACB/share × QtySold
     * Proceeds = (Price × QtySold) - Fees (converted to CAD)
     * Gain/Loss = Proceeds - ACBused
     * NewACB = OldACB - ACBused
     * NewShares = OldShares - QtySold
     */
    private calculateSell(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldAcb = toDecimal(input.currentAcb);
        const oldShares = toDecimal(input.currentShares);
        const qty = toDecimal(input.quantity);
        const price = toDecimal(input.pricePerShare);
        const fxRate = toDecimal(input.fxRate);
        const fees = toDecimal(input.fees);

        // Validate: cannot sell more than we have
        if (qty.greaterThan(oldShares)) {
            throw new Error(`Cannot sell ${qty.toFixed(6)} shares when only ${oldShares.toFixed(6)} are held`);
        }

        // Step 1: Calculate ACB per share BEFORE the sale
        const acbPerShare = safeDivide(oldAcb, oldShares);
        steps.push({
            description: 'Calculate ACB per share before sale',
            formula: 'ACB/Share = Total ACB ÷ Total Shares',
            values: {
                'Total ACB': `$${oldAcb.toFixed(2)}`,
                'Total Shares': oldShares.toFixed(6)
            },
            result: `$${acbPerShare.toFixed(4)}/share`
        });

        // Step 2: Calculate ACB used for this sale
        const acbUsed = acbPerShare.times(qty);
        steps.push({
            description: 'Calculate ACB portion for shares sold',
            formula: 'ACB Used = ACB/Share × Quantity Sold',
            values: {
                'ACB/Share': `$${acbPerShare.toFixed(4)}`,
                'Quantity Sold': qty.toFixed(6)
            },
            result: `$${acbUsed.toFixed(2)}`
        });

        // Step 3: Calculate gross proceeds in original currency
        const grossProceeds = price.times(qty);
        steps.push({
            description: 'Calculate gross proceeds',
            formula: 'Gross Proceeds = Price × Quantity',
            values: {
                'Price': `$${price.toFixed(4)}`,
                'Quantity': qty.toFixed(6)
            },
            result: `$${grossProceeds.toFixed(2)}`
        });

        // Step 4: Convert to CAD if needed
        const grossProceedsCad = grossProceeds.times(fxRate);
        if (input.priceCurrency !== 'CAD') {
            steps.push({
                description: 'Convert proceeds to CAD',
                formula: 'Proceeds (CAD) = Proceeds × FX Rate',
                values: {
                    'Proceeds': `$${grossProceeds.toFixed(2)} ${input.priceCurrency}`,
                    'FX Rate': fxRate.toFixed(6)
                },
                result: `$${grossProceedsCad.toFixed(2)} CAD`
            });
        }

        // Step 5: Subtract selling fees
        const netProceeds = grossProceedsCad.minus(fees);
        steps.push({
            description: 'Calculate net proceeds after fees',
            formula: 'Net Proceeds = Gross Proceeds (CAD) - Fees',
            values: {
                'Gross Proceeds': `$${grossProceedsCad.toFixed(2)}`,
                'Fees': `$${fees.toFixed(2)}`
            },
            result: `$${netProceeds.toFixed(2)} CAD`
        });

        // Step 6: Calculate capital gain/loss
        const capitalGain = netProceeds.minus(acbUsed);
        steps.push({
            description: 'Calculate capital gain/loss',
            formula: 'Capital Gain = Net Proceeds - ACB Used',
            values: {
                'Net Proceeds': `$${netProceeds.toFixed(2)}`,
                'ACB Used': `$${acbUsed.toFixed(2)}`
            },
            result: `$${capitalGain.toFixed(2)} ${capitalGain.isNegative() ? '(LOSS)' : '(GAIN)'}`
        });

        // Step 7: Calculate remaining ACB
        const newAcb = oldAcb.minus(acbUsed);
        steps.push({
            description: 'Calculate remaining ACB',
            formula: 'New ACB = Old ACB - ACB Used',
            values: {
                'Old ACB': `$${oldAcb.toFixed(2)}`,
                'ACB Used': `$${acbUsed.toFixed(2)}`
            },
            result: `$${newAcb.toFixed(2)}`
        });

        // Step 8: Calculate remaining shares
        const newShares = oldShares.minus(qty);
        steps.push({
            description: 'Update share count',
            formula: 'New Shares = Old Shares - Quantity Sold',
            values: {
                'Old Shares': oldShares.toFixed(6),
                'Quantity Sold': qty.toFixed(6)
            },
            result: newShares.toFixed(6)
        });

        // Calculate new ACB per share (if shares remain)
        const newAcbPerShare = safeDivide(newAcb, newShares);

        const gainLossText = capitalGain.isNegative()
            ? `Capital Loss: $${capitalGain.abs().toFixed(2)}`
            : `Capital Gain: $${capitalGain.toFixed(2)}`;

        return {
            newShares: roundToShares(newShares),
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            capitalGain: roundToCurrency(capitalGain),
            proceeds: roundToCurrency(netProceeds),
            acbUsed: roundToCurrency(acbUsed),
            calculationDetails: {
                type: 'SELL',
                steps,
                summary: `Sold ${qty.toFixed(6)} shares. ${gainLossText}. Remaining: ${newShares.toFixed(6)} shares at $${newAcb.toFixed(2)} ACB.`
            }
        };
    }

    /**
     * DIVIDEND (Cash, not reinvested)
     * No change to ACB - dividend income is taxed separately
     */
    private calculateDividend(input: ACBCalculationInput): ACBCalculationResult {
        const dividendAmount = toDecimal(input.pricePerShare).times(input.currentShares).times(input.fxRate);

        return {
            newShares: input.currentShares,
            newAcb: input.currentAcb,
            newAcbPerShare: safeDivide(toDecimal(input.currentAcb), toDecimal(input.currentShares)).toNumber(),
            calculationDetails: {
                type: 'DIVIDEND',
                steps: [{
                    description: 'Cash dividend received',
                    formula: 'Dividend = Rate per Share × Shares',
                    values: {
                        'Rate': `$${input.pricePerShare.toFixed(4)}`,
                        'Shares': input.currentShares.toFixed(6)
                    },
                    result: `$${dividendAmount.toFixed(2)} CAD`
                }],
                summary: `Cash dividend of $${dividendAmount.toFixed(2)} received. No change to ACB.`
            }
        };
    }

    /**
     * DRIP (Dividend Reinvestment Plan)
     * NewACB = OldACB + Dividend Amount
     * NewShares = OldShares + Shares Acquired
     */
    private calculateDrip(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldAcb = toDecimal(input.currentAcb);
        const oldShares = toDecimal(input.currentShares);
        const newSharesAcquired = toDecimal(input.quantity);
        const dividendPerShare = toDecimal(input.pricePerShare);
        const fxRate = toDecimal(input.fxRate);
        const fees = toDecimal(input.fees);

        // Step 1: Calculate dividend amount
        const dividendAmount = dividendPerShare.times(oldShares).times(fxRate);
        steps.push({
            description: 'Calculate dividend amount',
            formula: 'Dividend = Rate × Shares × FX Rate',
            values: {
                'Rate': `$${dividendPerShare.toFixed(4)}`,
                'Shares': oldShares.toFixed(6),
                'FX Rate': fxRate.toFixed(6)
            },
            result: `$${dividendAmount.toFixed(2)} CAD`
        });

        // Step 2: Total amount including any cash portion used for share purchase
        const reinvestedAmount = dividendAmount.plus(fees); // fees here could be cash added
        steps.push({
            description: 'Total reinvested amount (including any fees)',
            values: {
                'Dividend': `$${dividendAmount.toFixed(2)}`,
                'Additional': `$${fees.toFixed(2)}`
            },
            result: `$${reinvestedAmount.toFixed(2)} CAD`
        });

        // Step 3: Add to ACB
        const newAcb = oldAcb.plus(reinvestedAmount);
        steps.push({
            description: 'Add reinvested amount to ACB',
            formula: 'New ACB = Old ACB + Reinvested Amount',
            values: {
                'Old ACB': `$${oldAcb.toFixed(2)}`,
                'Reinvested': `$${reinvestedAmount.toFixed(2)}`
            },
            result: `$${newAcb.toFixed(2)}`
        });

        // Step 4: Add new shares
        const totalShares = oldShares.plus(newSharesAcquired);
        steps.push({
            description: 'Add new shares from DRIP',
            formula: 'New Shares = Old Shares + DRIP Shares',
            values: {
                'Old Shares': oldShares.toFixed(6),
                'DRIP Shares': newSharesAcquired.toFixed(6)
            },
            result: totalShares.toFixed(6)
        });

        // Step 5: Calculate new ACB per share
        const newAcbPerShare = safeDivide(newAcb, totalShares);
        steps.push({
            description: 'Calculate new ACB per share',
            formula: 'ACB/Share = Total ACB ÷ Total Shares',
            values: {
                'Total ACB': `$${newAcb.toFixed(2)}`,
                'Total Shares': totalShares.toFixed(6)
            },
            result: `$${newAcbPerShare.toFixed(4)}/share`
        });

        return {
            newShares: roundToShares(totalShares),
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            calculationDetails: {
                type: 'DRIP',
                steps,
                summary: `Dividend of $${dividendAmount.toFixed(2)} reinvested → +${newSharesAcquired.toFixed(6)} shares, +$${reinvestedAmount.toFixed(2)} to ACB.`
            }
        };
    }

    /**
     * Return of Capital (RoC)
     * Reduces ACB. If ACB would go negative, excess becomes capital gain.
     */
    private calculateRoC(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldAcb = toDecimal(input.currentAcb);
        const shares = toDecimal(input.currentShares);
        const rocPerShare = toDecimal(input.rocPerShare ?? input.pricePerShare);
        const fxRate = toDecimal(input.fxRate);

        // Step 1: Calculate total RoC
        const totalRoc = rocPerShare.times(shares).times(fxRate);
        steps.push({
            description: 'Calculate total Return of Capital',
            formula: 'Total RoC = RoC per Share × Shares × FX Rate',
            values: {
                'RoC/Share': `$${rocPerShare.toFixed(4)}`,
                'Shares': shares.toFixed(6),
                'FX Rate': fxRate.toFixed(6)
            },
            result: `$${totalRoc.toFixed(2)} CAD`
        });

        // Step 2: Calculate new ACB
        let newAcb = oldAcb.minus(totalRoc);
        let capitalGain: Decimal | undefined = undefined;

        if (newAcb.isNegative()) {
            // ACB cannot go below zero - excess is immediate capital gain
            capitalGain = newAcb.abs();
            newAcb = new Decimal(0);

            steps.push({
                description: 'ACB would go negative - excess treated as capital gain',
                formula: 'Capital Gain = RoC - Old ACB (when RoC > ACB)',
                values: {
                    'Total RoC': `$${totalRoc.toFixed(2)}`,
                    'Old ACB': `$${oldAcb.toFixed(2)}`
                },
                result: `Capital Gain: $${capitalGain.toFixed(2)}, New ACB: $0.00`
            });
        } else {
            steps.push({
                description: 'Reduce ACB by Return of Capital',
                formula: 'New ACB = Old ACB - Total RoC',
                values: {
                    'Old ACB': `$${oldAcb.toFixed(2)}`,
                    'Total RoC': `$${totalRoc.toFixed(2)}`
                },
                result: `$${newAcb.toFixed(2)}`
            });
        }

        // Step 3: Calculate new ACB per share
        const newAcbPerShare = safeDivide(newAcb, shares);
        steps.push({
            description: 'Calculate new ACB per share',
            formula: 'ACB/Share = New ACB ÷ Shares',
            values: {
                'New ACB': `$${newAcb.toFixed(2)}`,
                'Shares': shares.toFixed(6)
            },
            result: `$${newAcbPerShare.toFixed(4)}/share`
        });

        let summary = `Return of Capital $${totalRoc.toFixed(2)} reduced ACB from $${oldAcb.toFixed(2)} to $${newAcb.toFixed(2)}.`;
        if (capitalGain) {
            summary += ` Excess of $${capitalGain.toFixed(2)} is an immediate capital gain.`;
        }

        return {
            newShares: input.currentShares,
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            capitalGain: capitalGain ? roundToCurrency(capitalGain) : undefined,
            calculationDetails: {
                type: 'RETURN_OF_CAPITAL',
                steps,
                summary
            }
        };
    }

    /**
     * Stock Split (M:1)
     * NewShares = OldShares × Ratio
     * Total ACB unchanged
     * ACB/Share = OldACB / NewShares
     */
    private calculateSplit(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldShares = toDecimal(input.currentShares);
        const acb = toDecimal(input.currentAcb);
        const ratio = toDecimal(input.ratio ?? 1);

        // Step 1: Calculate old ACB per share
        const oldAcbPerShare = safeDivide(acb, oldShares);
        steps.push({
            description: 'ACB per share before split',
            formula: 'ACB/Share = Total ACB ÷ Shares',
            values: {
                'Total ACB': `$${acb.toFixed(2)}`,
                'Shares': oldShares.toFixed(6)
            },
            result: `$${oldAcbPerShare.toFixed(4)}/share`
        });

        // Step 2: Apply split ratio to shares
        const newShares = oldShares.times(ratio);
        steps.push({
            description: `Apply ${ratio.toFixed(2)}:1 split ratio`,
            formula: 'New Shares = Old Shares × Split Ratio',
            values: {
                'Old Shares': oldShares.toFixed(6),
                'Split Ratio': ratio.toFixed(4)
            },
            result: newShares.toFixed(6)
        });

        // Step 3: ACB unchanged, calculate new ACB per share
        const newAcbPerShare = safeDivide(acb, newShares);
        steps.push({
            description: 'Total ACB unchanged, calculate new ACB/share',
            formula: 'New ACB/Share = Total ACB ÷ New Shares',
            values: {
                'Total ACB': `$${acb.toFixed(2)}`,
                'New Shares': newShares.toFixed(6)
            },
            result: `$${newAcbPerShare.toFixed(4)}/share`
        });

        return {
            newShares: roundToShares(newShares),
            newAcb: input.currentAcb, // Unchanged
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            calculationDetails: {
                type: 'STOCK_SPLIT',
                steps,
                summary: `${ratio.toFixed(2)}:1 stock split. Shares: ${oldShares.toFixed(6)} → ${newShares.toFixed(6)}. ACB/share: $${oldAcbPerShare.toFixed(4)} → $${newAcbPerShare.toFixed(4)}. Total ACB unchanged.`
            }
        };
    }

    /**
     * Stock Consolidation (Reverse Split) 1:N
     * NewShares = OldShares × Ratio (ratio < 1)
     * Total ACB unchanged
     */
    private calculateConsolidation(input: ACBCalculationInput): ACBCalculationResult {
        // Consolidation is just a split with ratio < 1
        const result = this.calculateSplit(input);
        result.calculationDetails.type = 'CONSOLIDATION';
        result.calculationDetails.summary = result.calculationDetails.summary.replace('stock split', 'consolidation');
        return result;
    }

    /**
     * Merger - Share exchange with possible cash component
     */
    private calculateMerger(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldShares = toDecimal(input.currentShares);
        const oldAcb = toDecimal(input.currentAcb);
        const ratio = toDecimal(input.ratio ?? 1);
        const cashPerShare = toDecimal(input.cashPerShare ?? 0);
        const fxRate = toDecimal(input.fxRate);

        // Step 1: Calculate new shares from ratio
        const newShares = oldShares.times(ratio);
        steps.push({
            description: 'Calculate new shares from merger ratio',
            formula: 'New Shares = Old Shares × Merger Ratio',
            values: {
                'Old Shares': oldShares.toFixed(6),
                'Merger Ratio': ratio.toFixed(4)
            },
            result: newShares.toFixed(6)
        });

        let capitalGain: Decimal | undefined = undefined;
        let newAcb = oldAcb;

        // Step 2: If cash component exists, treat as partial disposition
        if (cashPerShare.greaterThan(0)) {
            const totalCash = cashPerShare.times(oldShares).times(fxRate);
            steps.push({
                description: 'Calculate cash component (boot)',
                formula: 'Cash = Cash per Share × Shares × FX Rate',
                values: {
                    'Cash/Share': `$${cashPerShare.toFixed(4)}`,
                    'Shares': oldShares.toFixed(6),
                    'FX Rate': fxRate.toFixed(6)
                },
                result: `$${totalCash.toFixed(2)} CAD`
            });

            // Calculate proportion of ACB attributable to cash
            // This is simplified - user may need to provide allocation
            const totalValue = totalCash.plus(newShares.times(input.pricePerShare).times(fxRate));
            const cashProportion = safeDivide(totalCash, totalValue);
            const acbForCash = oldAcb.times(cashProportion);
            capitalGain = totalCash.minus(acbForCash);
            newAcb = oldAcb.minus(acbForCash);

            steps.push({
                description: 'Calculate capital gain on cash portion',
                formula: 'Gain = Cash - (ACB × Cash Proportion)',
                values: {
                    'Cash': `$${totalCash.toFixed(2)}`,
                    'ACB Proportion': `$${acbForCash.toFixed(2)}`
                },
                result: `$${capitalGain.toFixed(2)} ${capitalGain.isNegative() ? '(LOSS)' : '(GAIN)'}`
            });

            steps.push({
                description: 'Calculate remaining ACB for new shares',
                formula: 'New ACB = Old ACB - ACB for Cash',
                values: {
                    'Old ACB': `$${oldAcb.toFixed(2)}`,
                    'ACB for Cash': `$${acbForCash.toFixed(2)}`
                },
                result: `$${newAcb.toFixed(2)}`
            });
        } else {
            // No cash component - full ACB carries forward
            steps.push({
                description: 'Full ACB carries forward (no cash component)',
                result: `ACB: $${oldAcb.toFixed(2)}`
            });
        }

        const newAcbPerShare = safeDivide(newAcb, newShares);
        steps.push({
            description: 'Calculate new ACB per share',
            formula: 'ACB/Share = New ACB ÷ New Shares',
            values: {
                'New ACB': `$${newAcb.toFixed(2)}`,
                'New Shares': newShares.toFixed(6)
            },
            result: `$${newAcbPerShare.toFixed(4)}/share`
        });

        return {
            newShares: roundToShares(newShares),
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            capitalGain: capitalGain ? roundToCurrency(capitalGain) : undefined,
            calculationDetails: {
                type: 'MERGER',
                steps,
                summary: `Merger: ${oldShares.toFixed(6)} old shares → ${newShares.toFixed(6)} new shares. ${capitalGain ? `Capital gain on cash: $${capitalGain.toFixed(2)}.` : ''} New ACB: $${newAcb.toFixed(2)}.`
            }
        };
    }

    /**
     * Spinoff - ACB allocated between original and new security
     */
    private calculateSpinoff(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldShares = toDecimal(input.currentShares);
        const oldAcb = toDecimal(input.currentAcb);
        const allocationPercent = toDecimal(input.newSecurityAcbPercent ?? 0);

        // Step 1: Calculate ACB allocation
        const acbToNewSecurity = oldAcb.times(allocationPercent);
        const acbRemaining = oldAcb.minus(acbToNewSecurity);

        steps.push({
            description: 'Allocate ACB to spun-off security',
            formula: 'ACB to New = Old ACB × Allocation %',
            values: {
                'Old ACB': `$${oldAcb.toFixed(2)}`,
                'Allocation %': `${allocationPercent.times(100).toFixed(2)}%`
            },
            result: `$${acbToNewSecurity.toFixed(2)} to new security`
        });

        steps.push({
            description: 'Remaining ACB for original security',
            formula: 'Remaining ACB = Old ACB - ACB to New',
            values: {
                'Old ACB': `$${oldAcb.toFixed(2)}`,
                'ACB to New': `$${acbToNewSecurity.toFixed(2)}`
            },
            result: `$${acbRemaining.toFixed(2)}`
        });

        const newAcbPerShare = safeDivide(acbRemaining, oldShares);
        steps.push({
            description: 'Calculate new ACB per share for original security',
            formula: 'ACB/Share = Remaining ACB ÷ Shares',
            values: {
                'Remaining ACB': `$${acbRemaining.toFixed(2)}`,
                'Shares': oldShares.toFixed(6)
            },
            result: `$${newAcbPerShare.toFixed(4)}/share`
        });

        return {
            newShares: input.currentShares, // Share count unchanged for original
            newAcb: roundToCurrency(acbRemaining),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            calculationDetails: {
                type: 'SPINOFF',
                steps,
                summary: `Spinoff: ${allocationPercent.times(100).toFixed(2)}% of ACB ($${acbToNewSecurity.toFixed(2)}) allocated to new security. Remaining ACB: $${acbRemaining.toFixed(2)}.`
            }
        };
    }

    /**
     * Transfer In - shares transferred from another account
     * ACB must be provided by user (carried from source account)
     */
    private calculateTransferIn(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldAcb = toDecimal(input.currentAcb);
        const oldShares = toDecimal(input.currentShares);
        const transferShares = toDecimal(input.quantity);
        const transferAcb = toDecimal(input.pricePerShare).times(transferShares); // pricePerShare = ACB/share of transferred shares

        const newAcb = oldAcb.plus(transferAcb);
        const newShares = oldShares.plus(transferShares);

        steps.push({
            description: 'Add transferred shares and ACB',
            values: {
                'Transferred Shares': transferShares.toFixed(6),
                'Transferred ACB': `$${transferAcb.toFixed(2)}`
            },
            result: `${newShares.toFixed(6)} shares, $${newAcb.toFixed(2)} ACB`
        });

        const newAcbPerShare = safeDivide(newAcb, newShares);

        return {
            newShares: roundToShares(newShares),
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            calculationDetails: {
                type: 'TRANSFER_IN',
                steps,
                summary: `Transferred in ${transferShares.toFixed(6)} shares with $${transferAcb.toFixed(2)} ACB.`
            }
        };
    }

    /**
     * Transfer Out - shares transferred to another account
     * No gain/loss - ACB transfers with shares
     */
    private calculateTransferOut(input: ACBCalculationInput): ACBCalculationResult {
        const steps: CalculationStep[] = [];

        const oldAcb = toDecimal(input.currentAcb);
        const oldShares = toDecimal(input.currentShares);
        const transferShares = toDecimal(input.quantity);

        if (transferShares.greaterThan(oldShares)) {
            throw new Error(`Cannot transfer ${transferShares.toFixed(6)} shares when only ${oldShares.toFixed(6)} are held`);
        }

        const acbPerShare = safeDivide(oldAcb, oldShares);
        const acbTransferred = acbPerShare.times(transferShares);
        const newAcb = oldAcb.minus(acbTransferred);
        const newShares = oldShares.minus(transferShares);

        steps.push({
            description: 'Calculate ACB for transferred shares',
            formula: 'ACB Transferred = ACB/Share × Shares Transferred',
            values: {
                'ACB/Share': `$${acbPerShare.toFixed(4)}`,
                'Shares': transferShares.toFixed(6)
            },
            result: `$${acbTransferred.toFixed(2)}`
        });

        steps.push({
            description: 'Calculate remaining ACB and shares',
            values: {
                'Remaining Shares': newShares.toFixed(6),
                'Remaining ACB': `$${newAcb.toFixed(2)}`
            }
        });

        const newAcbPerShare = safeDivide(newAcb, newShares);

        return {
            newShares: roundToShares(newShares),
            newAcb: roundToCurrency(newAcb),
            newAcbPerShare: roundToCurrency(newAcbPerShare),
            calculationDetails: {
                type: 'TRANSFER_OUT',
                steps,
                summary: `Transferred out ${transferShares.toFixed(6)} shares with $${acbTransferred.toFixed(2)} ACB. No capital gain/loss.`
            }
        };
    }
}

// Export singleton instance
export const acbCalculator = new ACBCalculatorService();
