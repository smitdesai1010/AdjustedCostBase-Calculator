import { useState } from 'react';
import { Transaction } from '../services/api';
import CalculationBreakdown from './CalculationBreakdown';
import '../styles/TransactionTable.css';

interface TransactionTableProps {
    transactions: Transaction[];
    onDelete: (id: string) => Promise<void>;
    onEdit: (transaction: Transaction) => void;
}

function formatCurrency(value: number | undefined | null): string {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(value);
}

function formatNumber(value: number | undefined | null, decimals: number = 2): string {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-CA', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('en-CA');
}

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
    buy: { label: 'BUY', className: 'badge-success' },
    sell: { label: 'SELL', className: 'badge-error' },
    dividend: { label: 'DIV', className: 'badge-info' },
    drip: { label: 'DRIP', className: 'badge-info' },
    roc: { label: 'ROC', className: 'badge-warning' },
    split: { label: 'SPLIT', className: 'badge-info' },
    consolidation: { label: 'CONSOL', className: 'badge-info' },
    merger: { label: 'MERGER', className: 'badge-warning' },
    spinoff: { label: 'SPINOFF', className: 'badge-warning' },
    transfer_in: { label: 'IN', className: 'badge-success' },
    transfer_out: { label: 'OUT', className: 'badge-error' }
};

function TransactionTable({ transactions, onDelete, onEdit }: TransactionTableProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this transaction? All subsequent transactions will be recalculated.')) {
            return;
        }

        setDeletingId(id);
        try {
            await onDelete(id);
        } finally {
            setDeletingId(null);
        }
    };

    if (transactions.length === 0) {
        return (
            <div className="card">
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <h3>No Transactions</h3>
                    <p>Add securities and accounts in Setup, then add your first transaction.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="card transaction-table-card">
            <div className="card-header">
                <h2 className="card-title">Transaction History</h2>
                <span className="badge badge-info">{transactions.length} transactions</span>
            </div>

            <div className="table-container">
                <table className="table">
                    <thead>
                        <tr>
                            <th>Date</th>
                            <th>Type</th>
                            <th>Security</th>
                            <th>Account</th>
                            <th className="text-right">Qty</th>
                            <th className="text-right">Price</th>
                            <th className="text-right">Fees</th>
                            <th className="text-right">ACB Before</th>
                            <th className="text-right">ACB After</th>
                            <th className="text-right">Gain/Loss</th>
                            <th>Flags</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(txn => {
                            const typeInfo = TYPE_LABELS[txn.type] || { label: txn.type.toUpperCase(), className: 'badge-info' };
                            const hasSuperficialLoss = txn.flags?.includes('superficial_loss');
                            const isExpanded = expandedId === txn.id;

                            return (
                                <>
                                    <tr
                                        key={txn.id}
                                        className={`${hasSuperficialLoss ? 'row-warning' : ''} ${isExpanded ? 'row-expanded' : ''}`}
                                    >
                                        <td>{formatDate(txn.date)}</td>
                                        <td>
                                            <span className={`badge ${typeInfo.className}`}>
                                                {typeInfo.label}
                                            </span>
                                        </td>
                                        <td>
                                            <div className="security-cell">
                                                <span className="symbol">{txn.security?.symbol || '-'}</span>
                                                {txn.priceCurrency !== 'CAD' && (
                                                    <span className="currency-badge">{txn.priceCurrency}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td>{txn.account?.name || '-'}</td>
                                        <td className="text-right font-mono">{formatNumber(txn.quantity, 4)}</td>
                                        <td className="text-right font-mono">
                                            {formatCurrency(txn.price)}
                                            {txn.fxRate !== 1 && (
                                                <div className="fx-rate">
                                                    FX: {formatNumber(txn.fxRate, 4)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="text-right font-mono">{formatCurrency(txn.fees)}</td>
                                        <td className="text-right font-mono">{formatCurrency(txn.acbBefore)}</td>
                                        <td className="text-right font-mono">{formatCurrency(txn.acbAfter)}</td>
                                        <td className={`text-right font-mono ${txn.capitalGain !== undefined && txn.capitalGain !== null ? (txn.capitalGain >= 0 ? 'text-success' : 'text-error') : ''}`}>
                                            {txn.capitalGain !== undefined && txn.capitalGain !== null
                                                ? formatCurrency(txn.capitalGain)
                                                : '-'}
                                        </td>
                                        <td>
                                            {hasSuperficialLoss && (
                                                <span className="badge badge-warning" title="Superficial Loss">
                                                    ⚠️ SL
                                                </span>
                                            )}
                                        </td>
                                        <td>
                                            <div className="row-actions">
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => setExpandedId(isExpanded ? null : txn.id)}
                                                    title="View calculation details"
                                                >
                                                    {isExpanded ? '▲' : '▼'}
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    onClick={() => onEdit(txn)}
                                                    title="Edit transaction"
                                                >
                                                    ✎
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm text-error"
                                                    onClick={() => handleDelete(txn.id)}
                                                    disabled={deletingId === txn.id}
                                                    title="Delete transaction"
                                                >
                                                    {deletingId === txn.id ? '...' : '✕'}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {isExpanded && (
                                        <tr key={`${txn.id}-details`} className="details-row">
                                            <td colSpan={12}>
                                                <CalculationBreakdown transaction={txn} />
                                            </td>
                                        </tr>
                                    )}
                                </>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default TransactionTable;
