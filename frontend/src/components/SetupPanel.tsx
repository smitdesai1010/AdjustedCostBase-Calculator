import { useState, FormEvent } from 'react';
import { Security, Account } from '../services/api';
import '../styles/SetupPanel.css';

interface SetupPanelProps {
    securities: Security[];
    accounts: Account[];
    onAddSecurity: (data: Partial<Security>) => Promise<void>;
    onDeleteSecurity: (id: string) => Promise<void>;
    onAddAccount: (data: Partial<Account>) => Promise<void>;
    onDeleteAccount: (id: string) => Promise<void>;
}

const ACCOUNT_TYPES = [
    { value: 'non-registered', label: 'Non-Registered (Taxable)' },
    { value: 'TFSA', label: 'TFSA' },
    { value: 'RRSP', label: 'RRSP' },
    { value: 'RESP', label: 'RESP' },
    { value: 'LIRA', label: 'LIRA' },
    { value: 'RRIF', label: 'RRIF' }
];

const SECURITY_TYPES = [
    { value: 'stock', label: 'Stock' },
    { value: 'etf', label: 'ETF' },
    { value: 'mutual_fund', label: 'Mutual Fund' },
    { value: 'bond', label: 'Bond' }
];

const CURRENCIES = ['CAD', 'USD', 'EUR', 'GBP', 'JPY', 'CHF'];

function SetupPanel({
    securities, accounts,
    onAddSecurity, onDeleteSecurity,
    onAddAccount, onDeleteAccount
}: SetupPanelProps) {
    const [securityForm, setSecurityForm] = useState({
        symbol: '', name: '', currency: 'CAD', type: 'stock', exchange: ''
    });
    const [accountForm, setAccountForm] = useState({
        name: '', type: 'non-registered', institution: ''
    });
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleSecuritySubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!securityForm.symbol || !securityForm.name) {
            setError('Symbol and name are required');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await onAddSecurity(securityForm);
            setSecurityForm({ symbol: '', name: '', currency: 'CAD', type: 'stock', exchange: '' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add security');
        } finally {
            setLoading(false);
        }
    };

    const handleAccountSubmit = async (e: FormEvent) => {
        e.preventDefault();
        if (!accountForm.name) {
            setError('Account name is required');
            return;
        }

        try {
            setLoading(true);
            setError(null);
            await onAddAccount(accountForm);
            setAccountForm({ name: '', type: 'non-registered', institution: '' });
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add account');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteSecurity = async (id: string) => {
        if (!confirm('Delete this security? This may fail if transactions exist.')) return;
        try {
            await onDeleteSecurity(id);
        } catch (err) {
            setError('Cannot delete security with existing transactions');
        }
    };

    const handleDeleteAccount = async (id: string) => {
        if (!confirm('Delete this account? This may fail if transactions exist.')) return;
        try {
            await onDeleteAccount(id);
        } catch (err) {
            setError('Cannot delete account with existing transactions');
        }
    };

    return (
        <div className="setup-panel">
            {error && (
                <div className="alert alert-error mb-4">
                    {error}
                    <button className="btn btn-ghost btn-sm" onClick={() => setError(null)}>×</button>
                </div>
            )}

            <div className="setup-grid">
                {/* Securities Section */}
                <div className="setup-section card">
                    <div className="card-header">
                        <h3 className="card-title">Securities</h3>
                        <span className="badge badge-info">{securities.length}</span>
                    </div>

                    <form onSubmit={handleSecuritySubmit} className="setup-form">
                        <div className="form-row">
                            <div className="input-group">
                                <label htmlFor="sec-symbol">Symbol</label>
                                <input
                                    type="text"
                                    id="sec-symbol"
                                    className="input"
                                    value={securityForm.symbol}
                                    onChange={e => setSecurityForm({ ...securityForm, symbol: e.target.value.toUpperCase() })}
                                    placeholder="AAPL"
                                    required
                                />
                            </div>
                            <div className="input-group">
                                <label htmlFor="sec-currency">Currency</label>
                                <select
                                    id="sec-currency"
                                    className="input"
                                    value={securityForm.currency}
                                    onChange={e => setSecurityForm({ ...securityForm, currency: e.target.value })}
                                >
                                    {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                                </select>
                            </div>
                        </div>

                        <div className="input-group">
                            <label htmlFor="sec-name">Name</label>
                            <input
                                type="text"
                                id="sec-name"
                                className="input"
                                value={securityForm.name}
                                onChange={e => setSecurityForm({ ...securityForm, name: e.target.value })}
                                placeholder="Apple Inc."
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="input-group">
                                <label htmlFor="sec-type">Type</label>
                                <select
                                    id="sec-type"
                                    className="input"
                                    value={securityForm.type}
                                    onChange={e => setSecurityForm({ ...securityForm, type: e.target.value })}
                                >
                                    {SECURITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label htmlFor="sec-exchange">Exchange</label>
                                <input
                                    type="text"
                                    id="sec-exchange"
                                    className="input"
                                    value={securityForm.exchange}
                                    onChange={e => setSecurityForm({ ...securityForm, exchange: e.target.value })}
                                    placeholder="NASDAQ"
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            Add Security
                        </button>
                    </form>

                    <div className="items-list">
                        {securities.map(sec => (
                            <div key={sec.id} className="item-row">
                                <div className="item-info">
                                    <span className="item-primary">{sec.symbol}</span>
                                    <span className="item-secondary">{sec.name}</span>
                                </div>
                                <div className="item-meta">
                                    <span className="badge badge-info">{sec.currency}</span>
                                    <button
                                        className="btn btn-ghost btn-sm text-error"
                                        onClick={() => handleDeleteSecurity(sec.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                        {securities.length === 0 && (
                            <p className="text-muted text-center">No securities added yet</p>
                        )}
                    </div>
                </div>

                {/* Accounts Section */}
                <div className="setup-section card">
                    <div className="card-header">
                        <h3 className="card-title">Accounts</h3>
                        <span className="badge badge-info">{accounts.length}</span>
                    </div>

                    <form onSubmit={handleAccountSubmit} className="setup-form">
                        <div className="input-group">
                            <label htmlFor="acc-name">Account Name</label>
                            <input
                                type="text"
                                id="acc-name"
                                className="input"
                                value={accountForm.name}
                                onChange={e => setAccountForm({ ...accountForm, name: e.target.value })}
                                placeholder="My Trading Account"
                                required
                            />
                        </div>

                        <div className="form-row">
                            <div className="input-group">
                                <label htmlFor="acc-type">Account Type</label>
                                <select
                                    id="acc-type"
                                    className="input"
                                    value={accountForm.type}
                                    onChange={e => setAccountForm({ ...accountForm, type: e.target.value })}
                                >
                                    {ACCOUNT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                </select>
                            </div>
                            <div className="input-group">
                                <label htmlFor="acc-institution">Institution</label>
                                <input
                                    type="text"
                                    id="acc-institution"
                                    className="input"
                                    value={accountForm.institution}
                                    onChange={e => setAccountForm({ ...accountForm, institution: e.target.value })}
                                    placeholder="Questrade"
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={loading}>
                            Add Account
                        </button>
                    </form>

                    <div className="items-list">
                        {accounts.map(acc => (
                            <div key={acc.id} className="item-row">
                                <div className="item-info">
                                    <span className="item-primary">{acc.name}</span>
                                    <span className="item-secondary">{acc.institution || 'No institution'}</span>
                                </div>
                                <div className="item-meta">
                                    <span className={`badge ${acc.type === 'non-registered' ? 'badge-warning' : 'badge-success'}`}>
                                        {acc.type}
                                    </span>
                                    <button
                                        className="btn btn-ghost btn-sm text-error"
                                        onClick={() => handleDeleteAccount(acc.id)}
                                    >
                                        ✕
                                    </button>
                                </div>
                            </div>
                        ))}
                        {accounts.length === 0 && (
                            <p className="text-muted text-center">No accounts added yet</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SetupPanel;
