import { Router, Request, Response } from 'express';
import { transactionService } from '../services/transaction.service.js';

const router = Router();

// GET all positions
router.get('/', async (req: Request, res: Response) => {
    try {
        const positions = await transactionService.getAllPositions();

        // Add calculated ACB per share
        const positionsWithAcbPerShare = positions.map(p => ({
            ...p,
            acbPerShare: p.shares > 0 ? Number(p.totalAcb) / Number(p.shares) : 0
        }));

        res.json(positionsWithAcbPerShare);
    } catch (error) {
        console.error('Error fetching positions:', error);
        res.status(500).json({ error: 'Failed to fetch positions' });
    }
});

export default router;
