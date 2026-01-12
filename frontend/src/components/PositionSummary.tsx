import { Position } from '../services/api';
import '../styles/PositionSummary.css';

interface PositionSummaryProps {
    positions: Position[];
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('en-CA', {
        style: 'currency',
        currency: 'CAD'
    }).format(value);
}

function formatNumber(value: number, decimals: number = 4): string {
    return new Intl.NumberFormat('en-CA', {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals
    }).format(value);
}

function PositionSummary({ positions }: PositionSummaryProps) {
    if (positions.length === 0) {
        return (
            <div className="card">
                <div className="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M3 3v18h18" />
                        <path d="M18.7 8l-5.1 5.2-2.8-2.7L7 14.3" />
                    </svg>
                    <h3>No Positions</h3>
                    <p>Add transactions to see your portfolio positions and ACB summary.</p>
                </div>
            </div>
        );
    }

    const totalAcb = positions.reduce((sum, p) => sum + Number(p.totalAcb), 0);
    const totalPositions = positions.filter(p => Number(p.shares) > 0).length;

    return (
        <div className="positions-container">
            <div className="positions-header">
                <h2>Portfolio Positions</h2>
                <div className="stats">
                    <div className="stat">
                        <span className="stat-value">{totalPositions}</span>
                        <span className="stat-label">Holdings</span>
                    </div>
                    <div className="stat">
                        <span className="stat-value">{formatCurrency(totalAcb)}</span>
                        <span className="stat-label">Total ACB</span>
                    </div>
                </div>
            </div>

            <div className="positions-grid">
                {positions.filter(p => Number(p.shares) > 0).map(position => (
                    <div key={position.id} className="position-card card">
                        <div className="position-header">
                            <div className="position-symbol">
                                <span className="symbol">{position.security?.symbol || 'Unknown'}</span>
                                <span className="account-badge">{position.account?.name || '-'}</span>
                            </div>
                            <span className={`account-type ${position.account?.type === 'non-registered' ? 'taxable' : 'registered'}`}>
                                {position.account?.type}
                            </span>
                        </div>

                        <div className="position-details">
                            <div className="detail-row">
                                <span className="detail-label">Shares Held</span>
                                <span className="detail-value font-mono">{formatNumber(Number(position.shares), 6)}</span>
                            </div>
                            <div className="detail-row">
                                <span className="detail-label">Total ACB</span>
                                <span className="detail-value font-mono">{formatCurrency(Number(position.totalAcb))}</span>
                            </div>
                            <div className="detail-row highlight">
                                <span className="detail-label">ACB per Share</span>
                                <span className="detail-value font-mono">{formatCurrency(position.acbPerShare)}</span>
                            </div>
                        </div>

                        {position.security?.currency && position.security.currency !== 'CAD' && (
                            <div className="currency-note">
                                Traded in {position.security.currency}
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {positions.some(p => Number(p.shares) === 0) && (
                <div className="closed-positions">
                    <h3>Closed Positions</h3>
                    <div className="closed-list">
                        {positions.filter(p => Number(p.shares) === 0).map(position => (
                            <div key={position.id} className="closed-item">
                                <span>{position.security?.symbol || 'Unknown'} in {position.account?.name || '-'}</span>
                                <span className="text-muted">No shares held</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default PositionSummary;
