import { useState, useEffect } from 'react';
import {
    Security, Account, Transaction, Position,
    getSecurities, getAccounts, getTransactions, getPositions,
    createSecurity, createAccount, createTransaction,
    deleteSecurity, deleteAccount, deleteTransaction,
    getExportCsvUrl
} from './services/api';
import TransactionForm from './components/TransactionForm';
import TransactionTable from './components/TransactionTable';
import PositionSummary from './components/PositionSummary';
import SetupPanel from './components/SetupPanel';
import './styles/App.css';

function App() {
    const [securities, setSecurities] = useState<Security[]>([]);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [positions, setPositions] = useState<Position[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<'transactions' | 'positions' | 'setup'>('transactions');

    const loadData = async () => {
        try {
            setLoading(true);
            setError(null);
            const [secs, accs, txns, pos] = await Promise.all([
                getSecurities(),
                getAccounts(),
                getTransactions(),
                getPositions()
            ]);
            setSecurities(secs);
            setAccounts(accs);
            setTransactions(txns);
            setPositions(pos);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load data');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleAddSecurity = async (data: Partial<Security>) => {
        try {
            const security = await createSecurity(data);
            setSecurities([...securities, security]);
        } catch (err) {
            throw err;
        }
    };

    const handleDeleteSecurity = async (id: string) => {
        await deleteSecurity(id);
        setSecurities(securities.filter(s => s.id !== id));
    };

    const handleAddAccount = async (data: Partial<Account>) => {
        try {
            const account = await createAccount(data);
            setAccounts([...accounts, account]);
        } catch (err) {
            throw err;
        }
    };

    const handleDeleteAccount = async (id: string) => {
        await deleteAccount(id);
        setAccounts(accounts.filter(a => a.id !== id));
    };

    const handleAddTransaction = async (data: Parameters<typeof createTransaction>[0]) => {
        try {
            await createTransaction(data);
            await loadData(); // Reload to get updated positions and transaction with calculated values
        } catch (err) {
            throw err;
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        await deleteTransaction(id);
        await loadData(); // Reload to recalculate subsequent transactions
    };

    return (
        <div className="app">
            <header className="app-header">
                <div className="header-content">
                    <div className="logo">
                        <div className="logo-icon">
                            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 2L2 7l10 5 10-5-10-5z" />
                                <path d="M2 17l10 5 10-5" />
                                <path d="M2 12l10 5 10-5" />
                            </svg>
                        </div>
                        <div className="logo-text">
                            <h1>ACB Calculator</h1>
                            <span className="logo-subtitle">Canadian Capital Gains Tracker</span>
                        </div>
                    </div>
                    <nav className="header-nav">
                        <button
                            className={`nav-btn ${activeTab === 'transactions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('transactions')}
                        >
                            Transactions
                        </button>
                        <button
                            className={`nav-btn ${activeTab === 'positions' ? 'active' : ''}`}
                            onClick={() => setActiveTab('positions')}
                        >
                            Positions
                        </button>
                        <button
                            className={`nav-btn ${activeTab === 'setup' ? 'active' : ''}`}
                            onClick={() => setActiveTab('setup')}
                        >
                            Setup
                        </button>
                    </nav>
                    <div className="header-actions">
                        <a href={getExportCsvUrl()} className="btn btn-secondary btn-sm" download>
                            Export CSV
                        </a>
                    </div>
                </div>
            </header>

            <main className="app-main">
                {error && (
                    <div className="alert alert-error mb-4">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <line x1="12" y1="8" x2="12" y2="12" />
                            <line x1="12" y1="16" x2="12.01" y2="16" />
                        </svg>
                        <span>{error}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>Dismiss</button>
                    </div>
                )}

                {loading ? (
                    <div className="loading-container">
                        <div className="spinner"></div>
                        <span>Loading data...</span>
                    </div>
                ) : (
                    <>
                        {activeTab === 'transactions' && (
                            <div className="transactions-view">
                                <div className="main-content">
                                    <TransactionTable
                                        transactions={transactions}
                                        onDelete={handleDeleteTransaction}
                                    />
                                </div>
                                <aside className="sidebar">
                                    <TransactionForm
                                        securities={securities}
                                        accounts={accounts}
                                        onSubmit={handleAddTransaction}
                                    />
                                </aside>
                            </div>
                        )}

                        {activeTab === 'positions' && (
                            <PositionSummary positions={positions} />
                        )}

                        {activeTab === 'setup' && (
                            <SetupPanel
                                securities={securities}
                                accounts={accounts}
                                onAddSecurity={handleAddSecurity}
                                onDeleteSecurity={handleDeleteSecurity}
                                onAddAccount={handleAddAccount}
                                onDeleteAccount={handleDeleteAccount}
                            />
                        )}
                    </>
                )}
            </main>

            <footer className="app-footer">
                <p>ACB Calculator - For informational purposes only. Consult a tax professional for advice.</p>
            </footer>
        </div>
    );
}

export default App;
