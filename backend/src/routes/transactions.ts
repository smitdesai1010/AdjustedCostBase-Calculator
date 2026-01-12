import { Router, Request, Response } from 'express';
import { transactionService, CreateTransactionInput } from '../services/transaction.service.js';

const router = Router();

// GET all transactions
router.get('/', async (req: Request, res: Response) => {
    try {
        const { securityId, accountId } = req.query;
        const transactions = await transactionService.getTransactions(
            securityId as string | undefined,
            accountId as string | undefined
        );
        res.json(transactions);
    } catch (error) {
        console.error('Error fetching transactions:', error);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// GET single transaction
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const transaction = await transactionService.getTransaction(req.params.id);
        if (!transaction) {
            return res.status(404).json({ error: 'Transaction not found' });
        }
        res.json(transaction);
    } catch (error) {
        console.error('Error fetching transaction:', error);
        res.status(500).json({ error: 'Failed to fetch transaction' });
    }
});

// POST create transaction
router.post('/', async (req: Request, res: Response) => {
    try {
        const input: CreateTransactionInput = {
            date: req.body.date,
            settlementDate: req.body.settlementDate,
            type: req.body.type,
            securityId: req.body.securityId,
            accountId: req.body.accountId,
            quantity: parseFloat(req.body.quantity),
            price: parseFloat(req.body.price),
            fees: req.body.fees ? parseFloat(req.body.fees) : 0,
            ratio: req.body.ratio ? parseFloat(req.body.ratio) : undefined,
            rocPerShare: req.body.rocPerShare ? parseFloat(req.body.rocPerShare) : undefined,
            newSecurityId: req.body.newSecurityId,
            newSecurityAcbPercent: req.body.newSecurityAcbPercent
                ? parseFloat(req.body.newSecurityAcbPercent)
                : undefined,
            cashPerShare: req.body.cashPerShare ? parseFloat(req.body.cashPerShare) : undefined,
            notes: req.body.notes
        };

        // Validate required fields
        if (!input.date || !input.type || !input.securityId || !input.accountId) {
            return res.status(400).json({
                error: 'Required fields: date, type, securityId, accountId'
            });
        }

        const validTypes = [
            'buy', 'sell', 'dividend', 'drip', 'roc',
            'split', 'consolidation', 'merger', 'spinoff',
            'transfer_in', 'transfer_out'
        ];
        if (!validTypes.includes(input.type)) {
            return res.status(400).json({
                error: `Invalid transaction type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        const transaction = await transactionService.createTransaction(input);
        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error creating transaction:', error);
        const message = error instanceof Error ? error.message : 'Failed to create transaction';
        res.status(400).json({ error: message });
    }
});

// PUT update transaction
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const input: Partial<CreateTransactionInput> = {};

        if (req.body.date) input.date = req.body.date;
        if (req.body.settlementDate) input.settlementDate = req.body.settlementDate;
        if (req.body.type) input.type = req.body.type;
        if (req.body.securityId) input.securityId = req.body.securityId;
        if (req.body.accountId) input.accountId = req.body.accountId;
        if (req.body.quantity !== undefined) input.quantity = parseFloat(req.body.quantity);
        if (req.body.price !== undefined) input.price = parseFloat(req.body.price);
        if (req.body.fees !== undefined) input.fees = parseFloat(req.body.fees);
        if (req.body.ratio !== undefined) input.ratio = parseFloat(req.body.ratio);
        if (req.body.notes !== undefined) input.notes = req.body.notes;

        const transaction = await transactionService.updateTransaction(req.params.id, input);
        res.json(transaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        const message = error instanceof Error ? error.message : 'Failed to update transaction';
        res.status(400).json({ error: message });
    }
});

// DELETE transaction
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        await transactionService.deleteTransaction(req.params.id);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        const message = error instanceof Error ? error.message : 'Failed to delete transaction';
        res.status(400).json({ error: message });
    }
});

export default router;
