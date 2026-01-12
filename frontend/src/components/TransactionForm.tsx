import { useState, FormEvent } from 'react';
import { Security, Account, CreateTransactionInput } from '../services/api';
import '../styles/TransactionForm.css';

interface TransactionFormProps {
    securities: Security[];
    accounts: Account[];
    onSubmit: (data: CreateTransactionInput) => Promise<void>;
}

const TRANSACTION_TYPES = [
    { value: 'buy', label: 'Buy', description: 'Purchase shares' },
    { value: 'sell', label: 'Sell', description: 'Sell shares' },
    { value: 'dividend', label: 'Dividend', description: 'Cash dividend (no ACB change)' },
    { value: 'drip', label: 'DRIP', description: 'Dividend reinvestment' },
    { value: 'roc', label: 'Return of Capital', description: 'Reduces ACB' },
    { value: 'split', label: 'Stock Split', description: 'Multiply shares' },
    { value: 'consolidation', label: 'Consolidation', description: 'Reverse split' },
    { value: 'transfer_in', label: 'Transfer In', description: 'Transfer from another account' },
    { value: 'transfer_out', label: 'Transfer Out', description: 'Transfer to another account' }
];

function TransactionForm({ securities, accounts, onSubmit }: TransactionFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        settlementDate: '',
        type: 'buy',
        securityId: '',
        accountId: '',
        quantity: '',
        price: '',
        fees: '',
        ratio: '',
        notes: ''
    });

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
        setError(null);
        setSuccess(false);
    };

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault();

        if (!formData.securityId) {
            setError('Please select a security');
            return;
        }
        if (!formData.accountId) {
            setError('Please select an account');
            return;
        }

        try {
            setLoading(true);
            setError(null);

            const data: CreateTransactionInput = {
                date: formData.date,
                settlementDate: formData.settlementDate || formData.date,
                type: formData.type,
                securityId: formData.securityId,
                accountId: formData.accountId,
                quantity: parseFloat(formData.quantity) || 0,
                price: parseFloat(formData.price) || 0,
                fees: formData.fees ? parseFloat(formData.fees) : undefined,
                ratio: formData.ratio ? parseFloat(formData.ratio) : undefined,
                notes: formData.notes || undefined
            };

            await onSubmit(data);

            // Reset form
            setFormData(prev => ({
                ...prev,
                quantity: '',
                price: '',
                fees: '',
                ratio: '',
                notes: ''
            }));
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create transaction');
        } finally {
            setLoading(false);
        }
    };

    const selectedType = TRANSACTION_TYPES.find(t => t.value === formData.type);
    const showRatio = ['split', 'consolidation'].includes(formData.type);
    const showQuantityPrice = !['dividend'].includes(formData.type);

    return (
        <div className="transaction-form card">
            <div className="card-header">
                <h2 className="card-title">Add Transaction</h2>
            </div>

            <form onSubmit={handleSubmit}>
                {error && (
                    <div className="alert alert-error mb-4">
                        {error}
                    </div>
                )}

                {success && (
                    <div className="alert alert-success mb-4">
                        Transaction added successfully!
                    </div>
                )}

                <div className="form-grid">
                    <div className="input-group">
                        <label htmlFor="type">Transaction Type</label>
                        <select
                            id="type"
                            name="type"
                            className="input"
                            value={formData.type}
                            onChange={handleChange}
                        >
                            {TRANSACTION_TYPES.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        {selectedType && (
                            <span className="input-hint">{selectedType.description}</span>
                        )}
                    </div>

                    <div className="input-group">
                        <label htmlFor="date">Trade Date</label>
                        <input
                            type="date"
                            id="date"
                            name="date"
                            className="input"
                            value={formData.date}
                            onChange={handleChange}
                            required
                        />
                    </div>

                    <div className="input-group">
                        <label htmlFor="settlementDate">Settlement Date</label>
                        <input
                            type="date"
                            id="settlementDate"
                            name="settlementDate"
                            className="input"
                            value={formData.settlementDate}
                            onChange={handleChange}
                            placeholder="Same as trade date"
                        />
                        <span className="input-hint">For FX rate lookup (optional)</span>
                    </div>

                    <div className="input-group">
                        <label htmlFor="securityId">Security</label>
                        <select
                            id="securityId"
                            name="securityId"
                            className="input"
                            value={formData.securityId}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select security...</option>
                            {securities.map(sec => (
                                <option key={sec.id} value={sec.id}>
                                    {sec.symbol} - {sec.name} ({sec.currency})
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="input-group">
                        <label htmlFor="accountId">Account</label>
                        <select
                            id="accountId"
                            name="accountId"
                            className="input"
                            value={formData.accountId}
                            onChange={handleChange}
                            required
                        >
                            <option value="">Select account...</option>
                            {accounts.map(acc => (
                                <option key={acc.id} value={acc.id}>
                                    {acc.name} ({acc.type})
                                </option>
                            ))}
                        </select>
                    </div>

                    {showQuantityPrice && (
                        <>
                            <div className="input-group">
                                <label htmlFor="quantity">Quantity</label>
                                <input
                                    type="number"
                                    id="quantity"
                                    name="quantity"
                                    className="input"
                                    value={formData.quantity}
                                    onChange={handleChange}
                                    step="0.000001"
                                    min="0"
                                    placeholder="0.00"
                                    required
                                />
                            </div>

                            <div className="input-group">
                                <label htmlFor="price">
                                    {formData.type === 'roc' ? 'RoC per Share' : 'Price per Share'}
                                </label>
                                <input
                                    type="number"
                                    id="price"
                                    name="price"
                                    className="input"
                                    value={formData.price}
                                    onChange={handleChange}
                                    step="0.0001"
                                    min="0"
                                    placeholder="0.00"
                                    required
                                />
                            </div>
                        </>
                    )}

                    {showRatio && (
                        <div className="input-group">
                            <label htmlFor="ratio">Split Ratio</label>
                            <input
                                type="number"
                                id="ratio"
                                name="ratio"
                                className="input"
                                value={formData.ratio}
                                onChange={handleChange}
                                step="0.0001"
                                min="0"
                                placeholder="e.g., 2 for 2:1 split"
                                required
                            />
                            <span className="input-hint">
                                {formData.type === 'split'
                                    ? 'Enter 2 for a 2:1 split (doubles shares)'
                                    : 'Enter 0.5 for a 1:2 consolidation (halves shares)'}
                            </span>
                        </div>
                    )}

                    <div className="input-group">
                        <label htmlFor="fees">Commission/Fees (CAD)</label>
                        <input
                            type="number"
                            id="fees"
                            name="fees"
                            className="input"
                            value={formData.fees}
                            onChange={handleChange}
                            step="0.01"
                            min="0"
                            placeholder="0.00"
                        />
                    </div>

                    <div className="input-group full-width">
                        <label htmlFor="notes">Notes</label>
                        <textarea
                            id="notes"
                            name="notes"
                            className="input"
                            value={formData.notes}
                            onChange={handleChange}
                            rows={2}
                            placeholder="Optional notes..."
                        />
                    </div>
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Processing...
                            </>
                        ) : (
                            'Add Transaction'
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}

export default TransactionForm;
