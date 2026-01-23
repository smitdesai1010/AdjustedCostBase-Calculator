import { useState, FormEvent, useEffect } from 'react';
import { Security, Account, CreateTransactionInput, Transaction, getFxRate } from '../services/api';
import '../styles/TransactionForm.css';

interface TransactionFormProps {
    securities: Security[];
    accounts: Account[];
    onSubmit: (data: CreateTransactionInput) => Promise<void>;
    initialData?: Transaction | null;
    onCancel?: () => void;
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

function TransactionForm({ securities, accounts, onSubmit, initialData, onCancel }: TransactionFormProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const defaultFormData = {
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
    };

    const [formData, setFormData] = useState(defaultFormData);
    const [settlementSameAsTrade, setSettlementSameAsTrade] = useState(true);
    const [fxRate, setFxRate] = useState<number | null>(null);
    const [manualFxRate, setManualFxRate] = useState('');
    const [feeCurrency, setFeeCurrency] = useState<'CAD' | 'USD' | string>('CAD'); // Default to CAD initially, will update based on security
    const [showNotes, setShowNotes] = useState(false);

    // Sync settlement date if checkbox is checked
    useEffect(() => {
        if (settlementSameAsTrade) {
            setFormData(prev => ({ ...prev, settlementDate: prev.date }));
        }
    }, [formData.date, settlementSameAsTrade]);

    // Fetch FX rate when date or security changes
    useEffect(() => {
        const fetchRate = async () => {
            const security = securities.find(s => s.id === formData.securityId);
            if (!security || security.currency === 'CAD' || !formData.date) {
                setFxRate(null);
                setManualFxRate('');
                return;
            }

            // Sync fee currency to security currency by default
            if (!initialData) {
                setFeeCurrency(security.currency);
            }

            try {
                // Determine relevant date: settlement date if set, otherwise trade date
                // Usually FX is based on settlement date? User asked for "date" in requirements for current FX ratio.
                // Standard practice is settlement date for FX, but let's use trade date if settlement is not set or logic implies.
                // Requirement says "based on the currency selected/CAD and the date".
                const dateToUse = formData.settlementDate || formData.date;
                const rateData = await getFxRate(dateToUse, security.currency, 'CAD');
                setFxRate(rateData.rate);
                // Don't auto-overwrite manual input if it's already set by user? 
                // For simplicity, if manual is empty, maybe don't fill it? Or display the fetched rate as hint?
                // We'll display fetched rate separately.
            } catch (err) {
                console.warn('Failed to fetch FX rate', err);
                setFxRate(null);
            }
        };
        fetchRate();
    }, [formData.date, formData.settlementDate, formData.securityId, securities]);

    useEffect(() => {
        if (initialData) {
            const security = securities.find(s => s.id === initialData.securityId);
            setFormData({
                date: initialData.date.split('T')[0],
                settlementDate: initialData.settlementDate ? initialData.settlementDate.split('T')[0] : '',
                type: initialData.type,
                securityId: initialData.securityId,
                accountId: initialData.accountId,
                quantity: initialData.quantity.toString(),
                price: initialData.price.toString(),
                fees: initialData.fees.toString(),
                ratio: initialData.ratio?.toString() || '',
                notes: initialData.notes || ''
            });

            // Initialize settlement checkbox
            if (initialData.settlementDate && initialData.date) {
                const traded = initialData.date.split('T')[0];
                const setd = initialData.settlementDate.split('T')[0];
                setSettlementSameAsTrade(traded === setd);
            }

            if (initialData.fxRate && security && security.currency !== 'CAD') {
                setManualFxRate(initialData.fxRate.toString());
            }

            if (initialData.notes) {
                setShowNotes(true);
            }

            // Guess fee currency? Backend stores fees in CAD.
            // We'll leave it as CAD for editing to avoid reverse calc errors.
            setFeeCurrency('CAD');
        } else {
            setFormData(defaultFormData);
            setSettlementSameAsTrade(true);
            setFxRate(null);
            setManualFxRate('');
            setFeeCurrency('CAD');
        }
    }, [initialData, securities]);

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

            let calculatedFees = formData.fees ? parseFloat(formData.fees) : undefined;
            const security = securities.find(s => s.id === formData.securityId);

            // Convert fees if not CAD
            let finalFxRate = 1;

            if (security && security.currency !== 'CAD') {
                // Use manual rate if provided, otherwise fetched rate, otherwise 1
                const rateToUse = manualFxRate ? parseFloat(manualFxRate) : fxRate;
                if (rateToUse) {
                    finalFxRate = rateToUse;
                    if (feeCurrency !== 'CAD' && calculatedFees) {
                        calculatedFees = calculatedFees * finalFxRate;
                    }
                }
            }

            const data: CreateTransactionInput = {
                date: formData.date,
                settlementDate: formData.settlementDate || formData.date,
                type: formData.type,
                securityId: formData.securityId,
                accountId: formData.accountId,
                quantity: parseFloat(formData.quantity) || 0,
                price: parseFloat(formData.price) || 0,
                fees: calculatedFees,
                ratio: formData.ratio ? parseFloat(formData.ratio) : undefined,
                notes: formData.notes || undefined,
                fxRate: security?.currency !== 'CAD' && (manualFxRate || fxRate) ? (manualFxRate ? parseFloat(manualFxRate) : fxRate!) : undefined
            };

            await onSubmit(data);

            if (!initialData) {
                // Only reset if creating new
                setFormData(defaultFormData);
                setSettlementSameAsTrade(true);
                setManualFxRate('');
                setFxRate(null);
            }

            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save transaction');
        } finally {
            setLoading(false);
        }
    };

    const selectedType = TRANSACTION_TYPES.find(t => t.value === formData.type);
    const showRatio = ['split', 'consolidation'].includes(formData.type);
    const showQuantityPrice = !['dividend'].includes(formData.type);
    const selectedSecurity = securities.find(s => s.id === formData.securityId);
    const isForeign = selectedSecurity && selectedSecurity.currency !== 'CAD';

    return (
        <div className="transaction-form card">
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
                            onClick={(e) => e.currentTarget.showPicker()}
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
                            onClick={(e) => e.currentTarget.showPicker()}
                            disabled={settlementSameAsTrade}
                        />
                        <div style={{ marginTop: '0.25rem' }}>
                            <label style={{ fontSize: '0.8rem', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer' }}>
                                <input
                                    type="checkbox"
                                    checked={settlementSameAsTrade}
                                    onChange={(e) => setSettlementSameAsTrade(e.target.checked)}
                                />
                                Same as Trade Date
                            </label>
                        </div>
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
                                <div className="input-with-suffix">
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
                                    {selectedSecurity && (
                                        <span className="input-suffix">
                                            {selectedSecurity.currency}
                                        </span>
                                    )}
                                </div>
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
                        <label htmlFor="fees">Commission/Fees</label>
                        <div className="input-with-suffix">
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
                            {isForeign && (
                                <select
                                    className="input-suffix-select"
                                    value={feeCurrency}
                                    onChange={(e) => setFeeCurrency(e.target.value)}
                                >
                                    <option value={selectedSecurity.currency}>{selectedSecurity.currency}</option>
                                    <option value="CAD">CAD</option>
                                </select>
                            )}
                            {!isForeign && (
                                <span className="input-suffix">
                                    CAD
                                </span>
                            )}
                        </div>
                    </div>

                    <div className="input-group note-toggle-group">
                        <button
                            type="button"
                            className="btn btn-ghost btn-note-toggle"
                            onClick={() => setShowNotes(!showNotes)}
                        >
                            {showNotes ? (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                                        <path d="M18 15l-6-6-6 6" />
                                    </svg>
                                    Hide Note
                                </>
                            ) : (
                                <>
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: '6px' }}>
                                        <path d="M12 5v14M5 12h14" />
                                    </svg>
                                    Add Note
                                </>
                            )}
                        </button>
                    </div>

                    {isForeign && (
                        <div className="input-group">
                            <label htmlFor="fxRate">FX Rate ({selectedSecurity.currency} to CAD)</label>
                            <input
                                type="number"
                                id="fxRate"
                                value={manualFxRate}
                                onChange={(e) => setManualFxRate(e.target.value)}
                                placeholder={fxRate ? fxRate.toFixed(4) : "Enter rate..."}
                                className="input"
                                step="any"
                            />
                            <span className="input-hint">
                                {fxRate ? `Current rate: ${fxRate.toFixed(6)}` : 'Enter custom rate or leave blank to auto-fetch'}
                            </span>
                        </div>
                    )}

                    {showNotes && (
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
                    )}
                </div>

                <div className="form-actions">
                    <button type="submit" className="btn btn-primary btn-lg" disabled={loading}>
                        {loading ? (
                            <>
                                <span className="spinner"></span>
                                Processing...
                            </>
                        ) : (
                            initialData ? 'Update Transaction' : 'Add Transaction'
                        )}
                    </button>
                    {onCancel && (
                        <button type="button" className="btn btn-ghost btn-lg" onClick={onCancel} disabled={loading}>
                            Cancel
                        </button>
                    )}
                </div>
            </form>
        </div>
    );
}

export default TransactionForm;
