import express from 'express';
import cors from 'cors';
import { initializeDatabase } from './database.js';
import {
    securitiesRouter,
    accountsRouter,
    transactionsRouter,
    positionsRouter,
    exportRouter,
    fxRatesRouter
} from './routes/index.js';

const PORT = process.env.PORT || 3000;

async function main() {
    try {
        // Initialize database
        await initializeDatabase();

        // Create Express app
        const app = express();

        // Middleware
        app.use(cors());
        app.use(express.json());

        // Request logging
        app.use((req, res, next) => {
            console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
            next();
        });

        // API routes
        app.use('/api/securities', securitiesRouter);
        app.use('/api/accounts', accountsRouter);
        app.use('/api/transactions', transactionsRouter);
        app.use('/api/positions', positionsRouter);
        app.use('/api/export', exportRouter);
        app.use('/api/fx-rates', fxRatesRouter);

        // Health check
        app.get('/api/health', (req, res) => {
            res.json({ status: 'ok', timestamp: new Date().toISOString() });
        });

        // Error handling middleware
        app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
            console.error('Unhandled error:', err);
            res.status(500).json({ error: 'Internal server error' });
        });

        // Start server
        app.listen(PORT, () => {
            console.log(`
╔══════════════════════════════════════════════════════════════╗
║           ACB Calculator API Server                          ║
╠══════════════════════════════════════════════════════════════╣
║  Server running at: http://localhost:${PORT}                    ║
║                                                              ║
║  API Endpoints:                                              ║
║    GET/POST    /api/securities                               ║
║    GET/POST    /api/accounts                                 ║
║    GET/POST    /api/transactions                             ║
║    GET         /api/positions                                ║
║    GET         /api/fx-rates                                 ║
║    GET         /api/export/csv                               ║
║    GET         /api/export/json                              ║
║    GET         /api/health                                   ║
╚══════════════════════════════════════════════════════════════╝
      `);
        });
    } catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}

main();
