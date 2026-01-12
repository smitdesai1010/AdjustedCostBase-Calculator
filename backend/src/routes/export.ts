import { Router, Request, Response } from 'express';
import { transactionService } from '../services/transaction.service.js';
import { fxRateService } from '../services/fx-rate.service.js';

const router = Router();

// GET export as CSV
router.get('/csv', async (req: Request, res: Response) => {
    try {
        const { securityId, accountId } = req.query;
        const csv = await transactionService.exportTransactionsCSV(
            securityId as string | undefined,
            accountId as string | undefined
        );

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=acb-transactions.csv');
        res.send(csv);
    } catch (error) {
        console.error('Error exporting CSV:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

// GET export as JSON
router.get('/json', async (req: Request, res: Response) => {
    try {
        const { securityId, accountId } = req.query;
        const transactions = await transactionService.getTransactions(
            securityId as string | undefined,
            accountId as string | undefined
        );

        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=acb-transactions.json');
        res.json(transactions);
    } catch (error) {
        console.error('Error exporting JSON:', error);
        res.status(500).json({ error: 'Failed to export transactions' });
    }
});

export default router;
