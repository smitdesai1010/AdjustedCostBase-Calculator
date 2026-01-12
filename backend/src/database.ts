import { DataSource } from 'typeorm';
import { Security, Account, Transaction, Position, FXRate, CorporateAction } from './entities/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const AppDataSource = new DataSource({
    type: 'sqljs',
    location: path.join(__dirname, '..', 'data', 'acb-calculator.db'),
    autoSave: true,
    entities: [Security, Account, Transaction, Position, FXRate, CorporateAction],
    synchronize: true, // Auto-create tables in development
    logging: false
});

export async function initializeDatabase(): Promise<DataSource> {
    if (!AppDataSource.isInitialized) {
        await AppDataSource.initialize();
        console.log('Database initialized successfully');
    }
    return AppDataSource;
}
