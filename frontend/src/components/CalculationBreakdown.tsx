import { Transaction } from '../services/api';
import '../styles/CalculationBreakdown.css';

interface CalculationBreakdownProps {
    transaction: Transaction;
}

function CalculationBreakdown({ transaction }: CalculationBreakdownProps) {
    const details = transaction.calculationDetails;

    if (!details) {
        return (
            <div className="calculation-breakdown">
                <p className="text-muted">No calculation details available.</p>
            </div>
        );
    }

    const superficialLoss = details.superficialLoss;

    return (
        <div className="calculation-breakdown">
            <div className="breakdown-header">
                <h4>Calculation Breakdown - {details.type}</h4>
            </div>

            <div className="breakdown-content">
                {superficialLoss && superficialLoss.isSuperficial && (
                    <div className="alert alert-warning mb-4">
                        <div className="superficial-loss-warning">
                            <strong>⚠️ Superficial Loss Detected</strong>
                            <p>{superficialLoss.explanation}</p>
                            <p className="adjustment"><strong>Required Action:</strong> {superficialLoss.adjustmentRequired}</p>
                        </div>
                    </div>
                )}

                <div className="steps-container">
                    {details.steps.map((step, index) => (
                        <div key={index} className="step">
                            <div className="step-number">{index + 1}</div>
                            <div className="step-content">
                                <div className="step-description">{step.description}</div>

                                {step.formula && (
                                    <div className="step-formula">{step.formula}</div>
                                )}

                                {step.values && Object.keys(step.values).length > 0 && (
                                    <div className="step-values">
                                        {Object.entries(step.values).map(([key, value]) => (
                                            <span key={key} className="value-pair">
                                                <span className="value-key">{key}:</span>
                                                <span className="value-val">{value}</span>
                                            </span>
                                        ))}
                                    </div>
                                )}

                                {step.result && (
                                    <div className="step-result">
                                        <span className="result-label">Result:</span>
                                        <span className="result-value">{step.result}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="summary-box">
                    <strong>Summary:</strong> {details.summary}
                </div>
            </div>
        </div>
    );
}

export default CalculationBreakdown;
