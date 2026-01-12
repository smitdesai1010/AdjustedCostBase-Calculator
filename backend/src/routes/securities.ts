import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database.js';
import { Security } from '../entities/Security.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET all securities
router.get('/', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Security);
        const securities = await repository.find({ order: { symbol: 'ASC' } });
        res.json(securities);
    } catch (error) {
        console.error('Error fetching securities:', error);
        res.status(500).json({ error: 'Failed to fetch securities' });
    }
});

// GET single security
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Security);
        const security = await repository.findOne({ where: { id: req.params.id } });
        if (!security) {
            return res.status(404).json({ error: 'Security not found' });
        }
        res.json(security);
    } catch (error) {
        console.error('Error fetching security:', error);
        res.status(500).json({ error: 'Failed to fetch security' });
    }
});

// POST create security
router.post('/', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Security);

        const security = new Security();
        security.id = uuidv4();
        security.symbol = req.body.symbol?.toUpperCase();
        security.name = req.body.name;
        security.currency = req.body.currency?.toUpperCase() ?? 'CAD';
        security.type = req.body.type ?? 'stock';
        security.exchange = req.body.exchange;

        if (!security.symbol || !security.name) {
            return res.status(400).json({ error: 'Symbol and name are required' });
        }

        await repository.save(security);
        res.status(201).json(security);
    } catch (error) {
        console.error('Error creating security:', error);
        res.status(500).json({ error: 'Failed to create security' });
    }
});

// PUT update security
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Security);
        const security = await repository.findOne({ where: { id: req.params.id } });

        if (!security) {
            return res.status(404).json({ error: 'Security not found' });
        }

        if (req.body.symbol) security.symbol = req.body.symbol.toUpperCase();
        if (req.body.name) security.name = req.body.name;
        if (req.body.currency) security.currency = req.body.currency.toUpperCase();
        if (req.body.type) security.type = req.body.type;
        if (req.body.exchange !== undefined) security.exchange = req.body.exchange;

        await repository.save(security);
        res.json(security);
    } catch (error) {
        console.error('Error updating security:', error);
        res.status(500).json({ error: 'Failed to update security' });
    }
});

// DELETE security
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Security);
        const security = await repository.findOne({ where: { id: req.params.id } });

        if (!security) {
            return res.status(404).json({ error: 'Security not found' });
        }

        await repository.remove(security);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting security:', error);
        res.status(500).json({ error: 'Failed to delete security' });
    }
});

export default router;
