import { Repository, Between, LessThanOrEqual, MoreThanOrEqual } from 'typeorm';
import { Transaction } from '../entities/Transaction.js';
import { Account } from '../entities/Account.js';
import { AppDataSource } from '../database.js';

/**
 * Result of superficial loss detection
 */
export interface SuperficialLossResult {
    isSuperficial: boolean;
    lossAmount: number;
    relatedTransactionIds: string[];
    explanation: string;
    adjustmentRequired: string;
}

/**
 * Superficial Loss Detection Service
 * 
 * Per CRA rules, a superficial loss occurs when:
 * 1. You sell a security at a loss
 * 2. You (or an affiliated person) buy the same or identical security
 * 3. Within 30 days before or after the sale
 * 4. You (or affiliated person) still owns that security 30 days after the sale
 * 
 * The loss is "denied" and must be added to the ACB of the repurchased shares.
 * 
 * Note: Losses in registered accounts (TFSA, RRSP) are not reported and thus
 * superficial loss rules don't apply in the same way.
 */
export class SuperficialLossService {
    private transactionRepository: Repository<Transaction>;
    private accountRepository: Repository<Account>;

    constructor() {
        this.transactionRepository = AppDataSource.getRepository(Transaction);
        this.accountRepository = AppDataSource.getRepository(Account);
    }

    /**
     * Check if a sell transaction results in a superficial loss
     */
    async checkForSuperficialLoss(
        sellTransaction: Transaction,
        lossAmount: number
    ): Promise<SuperficialLossResult> {
        // Only check sells with a loss
        if (lossAmount >= 0) {
            return {
                isSuperficial: false,
                lossAmount: 0,
                relatedTransactionIds: [],
                explanation: 'No loss on this transaction.',
                adjustmentRequired: ''
            };
        }

        // Get the account to check if it's registered
        const account = await this.accountRepository.findOne({
            where: { id: sellTransaction.accountId }
        });

        // Losses in registered accounts don't need to be reported
        if (account?.isRegistered()) {
            return {
                isSuperficial: false,
                lossAmount: Math.abs(lossAmount),
                relatedTransactionIds: [],
                explanation: 'Loss occurred in a registered account - not reportable for tax purposes.',
                adjustmentRequired: ''
            };
        }

        const sellDate = new Date(sellTransaction.date);
        const windowStart = new Date(sellDate);
        const windowEnd = new Date(sellDate);
        windowStart.setDate(windowStart.getDate() - 30);
        windowEnd.setDate(windowEnd.getDate() + 30);

        // Find all buy transactions of the same security within the ±30 day window
        // Check ALL accounts (including registered) for purchases
        const relatedBuys = await this.transactionRepository.find({
            where: {
                securityId: sellTransaction.securityId,
                type: 'buy',
                date: Between(windowStart, windowEnd)
            },
            order: { date: 'ASC' }
        });

        // Also check for DRIPs which count as acquisitions
        const relatedDrips = await this.transactionRepository.find({
            where: {
                securityId: sellTransaction.securityId,
                type: 'drip',
                date: Between(windowStart, windowEnd)
            }
        });

        const allRelatedAcquisitions = [...relatedBuys, ...relatedDrips];

        // Filter out transactions that are the same as the sell transaction
        const filteredAcquisitions = allRelatedAcquisitions.filter(
            t => t.id !== sellTransaction.id && new Date(t.date).getTime() !== sellDate.getTime()
        );

        if (filteredAcquisitions.length === 0) {
            return {
                isSuperficial: false,
                lossAmount: Math.abs(lossAmount),
                relatedTransactionIds: [],
                explanation: 'No repurchase of the security within the 30-day window.',
                adjustmentRequired: ''
            };
        }

        // Check if shares are still owned 30 days after the sale
        const thirtyDaysAfter = new Date(sellDate);
        thirtyDaysAfter.setDate(thirtyDaysAfter.getDate() + 30);

        const stillOwnsShares = await this.checkIfSharesStillOwned(
            sellTransaction.securityId,
            thirtyDaysAfter
        );

        if (!stillOwnsShares) {
            return {
                isSuperficial: false,
                lossAmount: Math.abs(lossAmount),
                relatedTransactionIds: filteredAcquisitions.map(t => t.id),
                explanation: 'Repurchase detected within 30 days, but no shares held 30 days after sale.',
                adjustmentRequired: ''
            };
        }

        // This is a superficial loss
        const relatedIds = filteredAcquisitions.map(t => t.id);
        const acquisitionDates = filteredAcquisitions
            .map(t => new Date(t.date).toLocaleDateString())
            .join(', ');

        return {
            isSuperficial: true,
            lossAmount: Math.abs(lossAmount),
            relatedTransactionIds: relatedIds,
            explanation: `SUPERFICIAL LOSS DETECTED: You sold at a loss of $${Math.abs(lossAmount).toFixed(2)} ` +
                `and repurchased the same security on ${acquisitionDates}, which is within 30 days of the sale. ` +
                `The shares were still held 30 days after the sale. Per CRA rules (IT-456R), this loss is denied.`,
            adjustmentRequired: `Add $${Math.abs(lossAmount).toFixed(2)} to the ACB of the repurchased shares. ` +
                `This preserves the economic loss for when you eventually sell without triggering superficial loss rules.`
        };
    }

    /**
     * Check if shares of a security are still owned after a given date
     */
    private async checkIfSharesStillOwned(
        securityId: string,
        afterDate: Date
    ): Promise<boolean> {
        // Get the most recent transaction for this security up to the check date
        const lastTransaction = await this.transactionRepository.findOne({
            where: {
                securityId,
                date: LessThanOrEqual(afterDate)
            },
            order: { date: 'DESC', createdAt: 'DESC' }
        });

        if (!lastTransaction) {
            return false;
        }

        return lastTransaction.sharesAfter > 0;
    }

    /**
     * Scan all sell transactions for potential superficial losses
     * Useful for running a full audit
     */
    async scanAllTransactionsForSuperficialLosses(): Promise<Map<string, SuperficialLossResult>> {
        const results = new Map<string, SuperficialLossResult>();

        // Get all sell transactions with capital losses
        const sellTransactions = await this.transactionRepository.find({
            where: { type: 'sell' },
            order: { date: 'ASC' }
        });

        for (const sell of sellTransactions) {
            if (sell.capitalGain !== undefined && sell.capitalGain < 0) {
                const result = await this.checkForSuperficialLoss(sell, sell.capitalGain);
                if (result.isSuperficial) {
                    results.set(sell.id, result);
                }
            }
        }

        return results;
    }

    /**
     * Find all transactions within the superficial loss window of a given transaction
     */
    async findTransactionsInWindow(
        securityId: string,
        centerDate: Date
    ): Promise<Transaction[]> {
        const windowStart = new Date(centerDate);
        const windowEnd = new Date(centerDate);
        windowStart.setDate(windowStart.getDate() - 30);
        windowEnd.setDate(windowEnd.getDate() + 30);

        return await this.transactionRepository.find({
            where: {
                securityId,
                date: Between(windowStart, windowEnd)
            },
            order: { date: 'ASC' }
        });
    }

    /**
     * Calculate the adjusted ACB after applying a superficial loss
     * The denied loss is added to the ACB of repurchased shares
     */
    calculateAdjustedAcb(
        currentAcb: number,
        deniedLoss: number,
        sharesRepurchased: number,
        totalSharesAfterRepurchase: number
    ): { newTotalAcb: number; adjustmentPerShare: number } {
        // The denied loss is added proportionally to the repurchased shares
        // If you repurchased the same number of shares you sold, the full loss is added
        const adjustmentPerShare = deniedLoss / sharesRepurchased;
        const newTotalAcb = currentAcb + deniedLoss;

        return {
            newTotalAcb,
            adjustmentPerShare
        };
    }
}

// Export singleton instance
export const superficialLossService = new SuperficialLossService();
