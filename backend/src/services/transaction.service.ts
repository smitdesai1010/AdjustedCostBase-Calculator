import { Repository, LessThanOrEqual, LessThan, MoreThan, MoreThanOrEqual } from 'typeorm';
import { Transaction, TransactionType } from '../entities/Transaction.js';
import { Position } from '../entities/Position.js';
import { Security } from '../entities/Security.js';
import { Account } from '../entities/Account.js';
import { AppDataSource } from '../database.js';
import { acbCalculator, ACBCalculationInput } from './acb-calculator.service.js';
import { fxRateService } from './fx-rate.service.js';
import { superficialLossService } from './superficial-loss.service.js';
import { v4 as uuidv4 } from 'uuid';
import { parseLocalDate } from '../utils/index.js';


/**
 * Input for creating a new transaction
 */
export interface CreateTransactionInput {
    date: string;
    settlementDate?: string;
    type: TransactionType;
    securityId: string;
    accountId: string;
    quantity: number;
    price: number;
    fees?: number;
    ratio?: number;
    rocPerShare?: number;
    newSecurityId?: string;
    newSecurityAcbPercent?: number;
    cashPerShare?: number;
    notes?: string;
    fxRate?: number;
}

/**
 * Transaction Service
 * Handles transaction CRUD with automatic ACB calculations
 */
export class TransactionService {
    private transactionRepository: Repository<Transaction>;
    private positionRepository: Repository<Position>;
    private securityRepository: Repository<Security>;
    private accountRepository: Repository<Account>;

    constructor() {
        this.transactionRepository = AppDataSource.getRepository(Transaction);
        this.positionRepository = AppDataSource.getRepository(Position);
        this.securityRepository = AppDataSource.getRepository(Security);
        this.accountRepository = AppDataSource.getRepository(Account);
    }

    /**
     * Get position state (shares and ACB) at a specific date
     * Returns the state BEFORE any transactions on that date
     */
    private async getPositionStateAtDate(
        securityId: string,
        accountId: string,
        date: Date
    ): Promise<{ shares: number; acb: number }> {
        // Find the most recent transaction strictly before this date
        const priorTransaction = await this.transactionRepository.findOne({
            where: {
                securityId,
                accountId,
                date: LessThanOrEqual(date)
            },
            order: { date: 'DESC', createdAt: 'DESC' }
        });

        // If there's a prior transaction on a date before this one, use its state
        if (priorTransaction && new Date(priorTransaction.date).getTime() < date.getTime()) {
            return {
                shares: Number(priorTransaction.sharesAfter),
                acb: Number(priorTransaction.acbAfter)
            };
        }

        // If the prior transaction is on the same date, find the one before it
        if (priorTransaction && new Date(priorTransaction.date).getTime() === date.getTime()) {
            // Get the transaction before this date
            const earlierTransaction = await this.transactionRepository.findOne({
                where: {
                    securityId,
                    accountId,
                    date: LessThanOrEqual(new Date(date.getTime() - 86400000)) // Day before
                },
                order: { date: 'DESC', createdAt: 'DESC' }
            });

            if (earlierTransaction) {
                return {
                    shares: Number(earlierTransaction.sharesAfter),
                    acb: Number(earlierTransaction.acbAfter)
                };
            }
        }

        // No prior transactions - start from zero
        return { shares: 0, acb: 0 };
    }

    /**
     * Create a new transaction with automatic ACB calculation
     */
    async createTransaction(input: CreateTransactionInput): Promise<Transaction> {
        // Get security and account
        const security = await this.securityRepository.findOne({ where: { id: input.securityId } });
        if (!security) {
            throw new Error(`Security not found: ${input.securityId}`);
        }

        const account = await this.accountRepository.findOne({ where: { id: input.accountId } });
        if (!account) {
            throw new Error(`Account not found: ${input.accountId}`);
        }

        // Parse the transaction date
        const transactionDate = parseLocalDate(input.date);
        
        // Get position state AT the transaction date (not current position)
        const positionState = await this.getPositionStateAtDate(
            input.securityId,
            input.accountId,
            transactionDate
        );

        // Get or create the position record (for later updates)
        const position = await this.getOrCreatePosition(input.securityId, input.accountId);

        // Get FX rate if needed
        const settlementDate = parseLocalDate(input.settlementDate ?? input.date);
        let fxRate = 1;

        if (input.fxRate !== undefined) {
            fxRate = input.fxRate;
        } else if (security.currency !== 'CAD') {
            try {
                fxRate = await fxRateService.getRate(settlementDate, security.currency, 'CAD');
            } catch (error) {
                console.error('FX rate fetch failed:', error);
                throw new Error(`Unable to fetch exchange rate for ${security.currency}/CAD on ${settlementDate.toISOString().split('T')[0]}. Please add the rate manually.`);
            }
        }

        // Prepare ACB calculation input using position state at date
        const calcInput: ACBCalculationInput = {
            transactionType: input.type,
            quantity: input.quantity,
            pricePerShare: input.price,
            priceCurrency: security.currency,
            fees: input.fees ?? 0,
            fxRate,
            currentShares: positionState.shares,
            currentAcb: positionState.acb,
            ratio: input.ratio,
            rocPerShare: input.rocPerShare,
            newSecurityAcbPercent: input.newSecurityAcbPercent,
            cashPerShare: input.cashPerShare
        };

        // Calculate ACB changes
        const result = acbCalculator.calculate(calcInput);

        // Create transaction record
        const transaction = new Transaction();
        transaction.id = uuidv4();
        transaction.date = transactionDate;
        transaction.settlementDate = settlementDate;

        transaction.type = input.type;
        transaction.securityId = input.securityId;
        transaction.accountId = input.accountId;
        transaction.quantity = input.quantity;
        transaction.price = input.price;
        transaction.priceCurrency = security.currency;
        transaction.fees = input.fees ?? 0;
        transaction.fxRate = fxRate;
        transaction.acbBefore = positionState.acb;
        transaction.acbAfter = result.newAcb;
        transaction.sharesBefore = positionState.shares;
        transaction.sharesAfter = result.newShares;
        transaction.capitalGain = result.capitalGain;
        transaction.ratio = input.ratio;
        transaction.newSecurityId = input.newSecurityId;
        transaction.notes = input.notes;
        transaction.calculationDetails = result.calculationDetails as unknown as Record<string, unknown>;
        transaction.flags = [];

        // Check for superficial loss
        if (input.type === 'sell' && result.capitalGain !== undefined && result.capitalGain < 0) {
            const slResult = await superficialLossService.checkForSuperficialLoss(
                transaction,
                result.capitalGain
            );
            if (slResult.isSuperficial) {
                transaction.flags = ['superficial_loss'];
                transaction.calculationDetails = {
                    ...(transaction.calculationDetails as Record<string, unknown>),
                    superficialLoss: slResult
                };
            }
        }

        // Save transaction
        await this.transactionRepository.save(transaction);

        // Check if there are any transactions after this one that need recalculation
        const laterTransactions = await this.transactionRepository.find({
            where: {
                securityId: input.securityId,
                accountId: input.accountId,
                date: MoreThan(transactionDate)
            },
            take: 1
        });

        if (laterTransactions.length > 0) {
            // There are transactions after this one - recalculate the entire chain from this date
            await this.recalculateTransactions(input.securityId, input.accountId, transactionDate);
        } else {
            // This is the latest transaction - just update the position
            position.shares = result.newShares;
            position.totalAcb = result.newAcb;
            await this.positionRepository.save(position);
        }

        // Return the updated transaction (refetch to get recalculated values)
        const updatedTransaction = await this.transactionRepository.findOne({ where: { id: transaction.id } });
        return updatedTransaction ?? transaction;
    }

    /**
     * Get or create a position for a security/account pair
     */
    private async getOrCreatePosition(securityId: string, accountId: string): Promise<Position> {
        let position = await this.positionRepository.findOne({
            where: { securityId, accountId }
        });

        if (!position) {
            position = new Position();
            position.id = uuidv4();
            position.securityId = securityId;
            position.accountId = accountId;
            position.shares = 0;
            position.totalAcb = 0;
            await this.positionRepository.save(position);
        }

        return position;
    }

    /**
     * Get all transactions for a security/account pair
     */
    async getTransactions(securityId?: string, accountId?: string): Promise<Transaction[]> {
        const where: Record<string, string> = {};
        if (securityId) where.securityId = securityId;
        if (accountId) where.accountId = accountId;

        return await this.transactionRepository.find({
            where,
            order: { date: 'DESC', createdAt: 'DESC' },
            relations: ['security', 'account']
        });
    }

    /**
     * Get a single transaction by ID
     */
    async getTransaction(id: string): Promise<Transaction | null> {
        return await this.transactionRepository.findOne({
            where: { id },
            relations: ['security', 'account']
        });
    }

    /**
     * Delete a transaction and recalculate all subsequent transactions
     */
    async deleteTransaction(id: string): Promise<void> {
        const transaction = await this.transactionRepository.findOne({ where: { id } });
        if (!transaction) {
            throw new Error(`Transaction not found: ${id}`);
        }

        // Find all transactions after this one for the same security/account
        const subsequentTransactions = await this.transactionRepository.find({
            where: {
                securityId: transaction.securityId,
                accountId: transaction.accountId,
                date: MoreThan(transaction.date)
            },
            order: { date: 'ASC', createdAt: 'ASC' }
        });

        // Delete the transaction
        await this.transactionRepository.remove(transaction);

        // Recalculate all subsequent transactions
        await this.recalculateTransactions(
            transaction.securityId,
            transaction.accountId,
            new Date(transaction.date)
        );
    }

    /**
     * Update a transaction and recalculate all subsequent transactions
     */
    async updateTransaction(id: string, input: Partial<CreateTransactionInput>): Promise<Transaction> {
        const existing = await this.transactionRepository.findOne({ where: { id } });
        if (!existing) {
            throw new Error(`Transaction not found: ${id}`);
        }

        // Delete and recreate (simpler than partial updates with recalculation)
        const fullInput: CreateTransactionInput = {
            date: input.date ?? existing.date.toISOString(),
            settlementDate: input.settlementDate ?? existing.settlementDate.toISOString(),
            type: input.type ?? existing.type,
            securityId: input.securityId ?? existing.securityId,
            accountId: input.accountId ?? existing.accountId,
            quantity: input.quantity ?? existing.quantity,
            price: input.price ?? existing.price,
            fees: input.fees ?? existing.fees,
            ratio: input.ratio ?? existing.ratio,
            notes: input.notes ?? existing.notes,
            fxRate: input.fxRate ?? existing.fxRate
        };

        await this.deleteTransaction(id);
        return await this.createTransaction(fullInput);
    }

    /**
     * Recalculate all transactions from a given date forward
     */
    private async recalculateTransactions(
        securityId: string,
        accountId: string,
        fromDate: Date
    ): Promise<void> {
        // Find the most recent transaction strictly before the fromDate
        const lastPrior = await this.transactionRepository.findOne({
            where: {
                securityId,
                accountId,
                date: LessThan(fromDate)
            },
            order: { date: 'DESC', createdAt: 'DESC' }
        });

        let currentShares = lastPrior ? Number(lastPrior.sharesAfter) : 0;
        let currentAcb = lastPrior ? Number(lastPrior.acbAfter) : 0;

        // Get all transactions from the date forward (including the date itself)
        const transactions = await this.transactionRepository.find({
            where: {
                securityId,
                accountId,
                date: MoreThanOrEqual(fromDate)
            },
            order: { date: 'ASC', createdAt: 'ASC' }
        });

        const security = await this.securityRepository.findOne({ where: { id: securityId } });
        if (!security) return;

        // Recalculate each transaction
        for (const txn of transactions) {
            const calcInput: ACBCalculationInput = {
                transactionType: txn.type,
                quantity: Number(txn.quantity),
                pricePerShare: Number(txn.price),
                priceCurrency: txn.priceCurrency,
                fees: Number(txn.fees),
                fxRate: Number(txn.fxRate),
                currentShares: Number(currentShares),
                currentAcb: Number(currentAcb),
                ratio: txn.ratio ? Number(txn.ratio) : undefined
            };

            const result = acbCalculator.calculate(calcInput);

            txn.acbBefore = currentAcb;
            txn.acbAfter = result.newAcb;
            txn.sharesBefore = currentShares;
            txn.sharesAfter = result.newShares;
            txn.capitalGain = result.capitalGain;
            txn.calculationDetails = result.calculationDetails as unknown as Record<string, unknown>;

            // Check superficial loss
            if (txn.type === 'sell' && result.capitalGain !== undefined && result.capitalGain < 0) {
                const slResult = await superficialLossService.checkForSuperficialLoss(txn, result.capitalGain);
                if (slResult.isSuperficial) {
                    txn.flags = ['superficial_loss'];
                    txn.calculationDetails = {
                        ...(txn.calculationDetails as Record<string, unknown>),
                        superficialLoss: slResult
                    };
                } else {
                    txn.flags = txn.flags?.filter(f => f !== 'superficial_loss') ?? [];
                }
            }

            await this.transactionRepository.save(txn);

            currentShares = result.newShares;
            currentAcb = result.newAcb;
        }

        // Update final position
        const position = await this.getOrCreatePosition(securityId, accountId);
        position.shares = currentShares;
        position.totalAcb = currentAcb;
        await this.positionRepository.save(position);
    }

    /**
     * Get all positions
     */
    async getAllPositions(): Promise<Position[]> {
        return await this.positionRepository.find({
            relations: ['security', 'account']
        });
    }

    /**
     * Export transactions as CSV
     */
    async exportTransactionsCSV(securityId?: string, accountId?: string): Promise<string> {
        const transactions = await this.getTransactions(securityId, accountId);

        const headers = [
            'Date',
            'Settlement Date',
            'Type',
            'Security',
            'Account',
            'Quantity',
            'Price',
            'Currency',
            'Fees',
            'FX Rate',
            'ACB Before',
            'ACB After',
            'Shares Before',
            'Shares After',
            'Capital Gain/Loss',
            'Flags',
            'Notes'
        ];

        const rows = transactions.map(t => [
            t.date.toISOString().split('T')[0],
            t.settlementDate.toISOString().split('T')[0],
            t.type,
            t.security?.symbol ?? t.securityId,
            t.account?.name ?? t.accountId,
            t.quantity.toString(),
            t.price.toString(),
            t.priceCurrency,
            t.fees.toString(),
            t.fxRate.toString(),
            t.acbBefore.toString(),
            t.acbAfter.toString(),
            t.sharesBefore.toString(),
            t.sharesAfter.toString(),
            t.capitalGain?.toString() ?? '',
            (t.flags ?? []).join('; '),
            t.notes ?? ''
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
        ].join('\n');

        return csvContent;
    }
}

export const transactionService = new TransactionService();
