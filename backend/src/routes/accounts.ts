import { Router, Request, Response } from 'express';
import { AppDataSource } from '../database.js';
import { Account } from '../entities/Account.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET all accounts
router.get('/', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Account);
        const accounts = await repository.find({ order: { name: 'ASC' } });
        res.json(accounts);
    } catch (error) {
        console.error('Error fetching accounts:', error);
        res.status(500).json({ error: 'Failed to fetch accounts' });
    }
});

// GET single account
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Account);
        const account = await repository.findOne({ where: { id: req.params.id } });
        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }
        res.json(account);
    } catch (error) {
        console.error('Error fetching account:', error);
        res.status(500).json({ error: 'Failed to fetch account' });
    }
});

// POST create account
router.post('/', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Account);

        const account = new Account();
        account.id = uuidv4();
        account.name = req.body.name;
        account.type = req.body.type ?? 'non-registered';
        account.institution = req.body.institution;
        account.accountNumber = req.body.accountNumber;

        if (!account.name) {
            return res.status(400).json({ error: 'Account name is required' });
        }

        const validTypes = ['non-registered', 'RRSP', 'TFSA', 'RESP', 'LIRA', 'RRIF'];
        if (!validTypes.includes(account.type)) {
            return res.status(400).json({
                error: `Invalid account type. Must be one of: ${validTypes.join(', ')}`
            });
        }

        await repository.save(account);
        res.status(201).json(account);
    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ error: 'Failed to create account' });
    }
});

// PUT update account
router.put('/:id', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Account);
        const account = await repository.findOne({ where: { id: req.params.id } });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        if (req.body.name) account.name = req.body.name;
        if (req.body.type) account.type = req.body.type;
        if (req.body.institution !== undefined) account.institution = req.body.institution;
        if (req.body.accountNumber !== undefined) account.accountNumber = req.body.accountNumber;

        await repository.save(account);
        res.json(account);
    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ error: 'Failed to update account' });
    }
});

// DELETE account
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const repository = AppDataSource.getRepository(Account);
        const account = await repository.findOne({ where: { id: req.params.id } });

        if (!account) {
            return res.status(404).json({ error: 'Account not found' });
        }

        await repository.remove(account);
        res.status(204).send();
    } catch (error) {
        console.error('Error deleting account:', error);
        res.status(500).json({ error: 'Failed to delete account' });
    }
});

export default router;
