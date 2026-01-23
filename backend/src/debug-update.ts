
import { AppDataSource, initializeDatabase } from './database.js';
import { transactionService, CreateTransactionInput } from './services/transaction.service.js';
import { securityService } from './services/security.service.js'; // Assuming this exists or using repo
import { Security } from './entities/Security.js';
import { Account } from './entities/Account.js';
import { v4 as uuidv4 } from 'uuid';

async function run() {
    try {
        await initializeDatabase();

        // 1. Ensure we have a security and account
        const securRepo = AppDataSource.getRepository(Security);
        const accountRepo = AppDataSource.getRepository(Account);

        let security = await securRepo.findOne({ where: {} });
        if (!security) {
            security = new Security();
            security.id = uuidv4();
            security.symbol = 'TEST-SEC';
            security.name = 'Test Security';
            security.currency = 'CAD';
            security.type = 'equity'; // or whatever
            await securRepo.save(security);
        }

        let account = await accountRepo.findOne({ where: {} });
        if (!account) {
            account = new Account();
            account.id = uuidv4();
            account.name = 'Test Account';
            account.type = 'cash';
            await accountRepo.save(account);
        }

        // 2. Create a transaction
        const input: CreateTransactionInput = {
            date: '2023-01-01',
            type: 'buy',
            securityId: security.id,
            accountId: account.id,
            quantity: 10,
            price: 100,
            fees: 0
        };

        const created = await transactionService.createTransaction(input);
        console.log('Created transaction date:', created.date);

        // 3. Update the date
        const updateInput: Partial<CreateTransactionInput> = {
            date: '2023-01-05'
        };

        const updated = await transactionService.updateTransaction(created.id, updateInput);
        console.log('Updated transaction date (in memory return):', updated.date);

        // 4. Verify from DB
        const reFetched = await transactionService.getTransaction(created.id);
        console.log('Refetched transaction date:', reFetched?.date);

        if (reFetched?.date.toISOString().startsWith('2023-01-05')) {
            console.log('SUCCESS: Date was updated.');
        } else {
            console.log('FAILURE: Date was NOT updated.');
        }

        // Cleanup
        await transactionService.deleteTransaction(created.id);

    } catch (err) {
        console.error('Error:', err);
    }
}

run();
