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
    // Backend returns ISO strings. We want to display the date part exactly as stored.
    // split('T')[0] is the safest way to get YYYY-MM-DD regardless of local timezone.
    return dateStr.split('T')[0];
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
                            <th className="text-right">Amount</th>
                            <th className="text-right">Shares</th>
                            <th className="text-right">Price</th>
                            <th className="text-right">Price (CAD)</th>
                            <th className="text-right">Comm.</th>
                            <th className="text-right">Gain/Loss</th>
                            <th className="text-right">Share Bal</th>
                            <th className="text-right">Δ ACB</th>
                            <th className="text-right">New ACB</th>
                            <th className="text-right">ACB/Share</th>
                            <th></th>
                        </tr>
                    </thead>
                    <tbody>
                        {[...transactions]
                            .sort((a, b) => {
                                const dateA = new Date(a.date).getTime();
                                const dateB = new Date(b.date).getTime();
                                if (dateA !== dateB) return dateB - dateA;
                                // If same date, use createdAt if available, otherwise fallback to index/id comparison
                                const createA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                                const createB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                                return createB - createA;
                            })
                            .map(txn => {
                                const typeInfo = TYPE_LABELS[txn.type] || { label: txn.type.toUpperCase(), className: 'badge-info' };
                                const hasSuperficialLoss = txn.flags?.includes('superficial_loss');
                                const isExpanded = expandedId === txn.id;

                                // Calculate Amount (Cash Flow approx)
                                // Ideally we'd have this from backend or calculate it: (Quantity * Price * FX) + Fees?
                                // Or just delta ACB? For now let's show Price * Shares * FX
                                const amount = Math.abs(txn.quantity * txn.price * txn.fxRate);

                                // Calculate Change in ACB
                                const deltaAcb = txn.acbAfter - txn.acbBefore;

                                // ACB per share
                                const acbPerShare = txn.sharesAfter !== 0 ? txn.acbAfter / txn.sharesAfter : 0;

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
                                            <td className="text-right font-mono">{formatCurrency(amount)}</td>
                                            <td className="text-right font-mono">{formatNumber(txn.quantity, 4)}</td>
                                            <td className="text-right font-mono">
                                                {formatCurrency(txn.price)}
                                                {txn.priceCurrency !== 'CAD' && (
                                                    <span className="text-xs text-muted ml-1">{txn.priceCurrency}</span>
                                                )}
                                            </td>
                                            <td className="text-right font-mono">{formatCurrency(txn.price * txn.fxRate)}</td>
                                            <td className="text-right font-mono">{formatCurrency(txn.fees)}</td>
                                            <td className={`text-right font-mono ${txn.capitalGain !== undefined && txn.capitalGain !== null ? (txn.capitalGain >= 0 ? 'text-success' : 'text-error') : ''}`}>
                                                {txn.capitalGain !== undefined && txn.capitalGain !== null
                                                    ? formatCurrency(txn.capitalGain)
                                                    : '-'}
                                            </td>
                                            <td className="text-right font-mono">{formatNumber(txn.sharesAfter, 4)}</td>
                                            <td className="text-right font-mono">{formatCurrency(deltaAcb)}</td>
                                            <td className="text-right font-mono">{formatCurrency(txn.acbAfter)}</td>
                                            <td className="text-right font-mono">{formatCurrency(acbPerShare)}</td>
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
                                                <td colSpan={13}>
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
