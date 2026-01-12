import { Router, Request, Response } from 'express';
import { fxRateService } from '../services/fx-rate.service.js';

const router = Router();

// GET all cached FX rates
router.get('/', async (req: Request, res: Response) => {
    try {
        const rates = await fxRateService.getAllRates();
        res.json(rates);
    } catch (error) {
        console.error('Error fetching FX rates:', error);
        res.status(500).json({ error: 'Failed to fetch FX rates' });
    }
});

// GET rate for specific date and currency pair
router.get('/rate', async (req: Request, res: Response) => {
    try {
        const { date, from, to } = req.query;

        if (!date || !from || !to) {
            return res.status(400).json({
                error: 'Required query params: date, from, to'
            });
        }

        const rate = await fxRateService.getRate(
            new Date(date as string),
            from as string,
            to as string
        );

        res.json({
            date,
            fromCurrency: from,
            toCurrency: to,
            rate
        });
    } catch (error) {
        console.error('Error fetching FX rate:', error);
        const message = error instanceof Error ? error.message : 'Failed to fetch FX rate';
        res.status(400).json({ error: message });
    }
});

// POST add manual rate
router.post('/manual', async (req: Request, res: Response) => {
    try {
        const { date, fromCurrency, toCurrency, rate } = req.body;

        if (!date || !fromCurrency || !toCurrency || rate === undefined) {
            return res.status(400).json({
                error: 'Required fields: date, fromCurrency, toCurrency, rate'
            });
        }

        const fxRate = await fxRateService.addManualRate(
            new Date(date),
            fromCurrency,
            toCurrency,
            parseFloat(rate)
        );

        res.status(201).json(fxRate);
    } catch (error) {
        console.error('Error adding manual FX rate:', error);
        res.status(500).json({ error: 'Failed to add FX rate' });
    }
});

export default router;
