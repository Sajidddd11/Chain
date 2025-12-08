import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

interface SDGScoreData {
    score: number;
    breakdown: {
        wasteReduction: number;
        nutrition: number;
        inventoryEfficiency: number;
    };
    weeklyImprovement: number;
    insights: {
        weeklyInsight: string;
        topStrength: string;
        topWeakness: string;
        actionableSteps: string[];
        scoreImpact: string[];
    };
    categoryBreakdown: Array<{
        category: string;
        count: number;
        quantity: number;
    }>;
}

export function SDGImpactScoring() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [scoreData, setScoreData] = useState<SDGScoreData | null>(null);
    const [error, setError] = useState<string | null>(null);

    const fetchSDGScore = async () => {
        if (!token) return;

        try {
            setLoading(true);
            setError(null);
            const data = await api.getSDGScore(token);
            setScoreData(data);
        } catch (err) {
            console.error('Error fetching SDG score:', err);
            setError(err instanceof Error ? err.message : 'Failed to load SDG score');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSDGScore();
    }, [token]);

    if (loading) {
        return (
            <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
                <div style={{
                    display: 'inline-block',
                    width: '40px',
                    height: '40px',
                    border: '4px solid #f3f4f6',
                    borderTopColor: '#1f7a4d',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                }} />
                <p style={{ marginTop: '1rem', color: '#64748b' }}>Calculating your SDG Impact Score...</p>
            </div>
        );
    }

    if (error || !scoreData) {
        return (
            <div className="card" style={{ padding: '2rem', textAlign: 'center' }}>
                <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error || 'No data available'}</p>
                <button
                    onClick={fetchSDGScore}
                    className="primary-btn"
                    style={{ padding: '0.75rem 1.5rem' }}
                >
                    Retry
                </button>
            </div>
        );
    }

    const getScoreColor = (score: number) => {
        if (score >= 80) return '#10b981';
        if (score >= 60) return '#3b82f6';
        if (score >= 40) return '#f59e0b';
        return '#ef4444';
    };

    const getScoreLabel = (score: number) => {
        if (score >= 80) return 'Excellent';
        if (score >= 60) return 'Good';
        if (score >= 40) return 'Fair';
        return 'Needs Improvement';
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.8; }
        }
        .sdg-card {
          animation: fadeIn 0.5s ease-out;
        }
        .score-ring {
          position: relative;
          width: 200px;
          height: 200px;
        }
        .score-ring svg {
          transform: rotate(-90deg);
        }
        .score-ring-bg {
          fill: none;
          stroke: #f1f5f9;
          stroke-width: 12;
        }
        .score-ring-progress {
          fill: none;
          stroke-width: 12;
          stroke-linecap: round;
          transition: stroke-dashoffset 1s ease-out;
        }
      `}</style>

            {/* Header */}
            <div className="card sdg-card" style={{ padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                    <div>
                        <h2 style={{ fontSize: '1.75rem', margin: '0 0 0.5rem 0', color: '#1f7a4d' }}>
                            SDG Impact Score
                        </h2>
                        <p style={{ margin: 0, color: '#64748b', fontSize: '0.95rem' }}>
                            Your sustainability performance based on waste reduction and nutrition
                        </p>
                    </div>
                    <button
                        onClick={fetchSDGScore}
                        style={{
                            padding: '0.6rem 1.25rem',
                            borderRadius: '0.75rem',
                            border: '1px solid #e2e8f0',
                            background: '#ffffff',
                            color: '#475569',
                            fontWeight: '600',
                            fontSize: '0.9rem',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#1f7a4d';
                            e.currentTarget.style.color = '#1f7a4d';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = '#e2e8f0';
                            e.currentTarget.style.color = '#475569';
                        }}
                    >
                        Refresh Score
                    </button>
                </div>
            </div>

            {/* Main Score Display */}
            <div className="card sdg-card" style={{ padding: '2rem' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2rem', alignItems: 'center' }}>
                    {/* Score Ring */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
                        <div className="score-ring">
                            <svg width="200" height="200" viewBox="0 0 200 200">
                                <circle
                                    className="score-ring-bg"
                                    cx="100"
                                    cy="100"
                                    r="90"
                                />
                                <circle
                                    className="score-ring-progress"
                                    cx="100"
                                    cy="100"
                                    r="90"
                                    stroke={getScoreColor(scoreData.score)}
                                    strokeDasharray={`${2 * Math.PI * 90}`}
                                    strokeDashoffset={`${2 * Math.PI * 90 * (1 - scoreData.score / 100)}`}
                                />
                            </svg>
                            <div style={{
                                position: 'absolute',
                                top: '50%',
                                left: '50%',
                                transform: 'translate(-50%, -50%)',
                                textAlign: 'center'
                            }}>
                                <div style={{ fontSize: '3rem', fontWeight: '800', color: getScoreColor(scoreData.score), lineHeight: 1 }}>
                                    {scoreData.score}
                                </div>
                                <div style={{ fontSize: '0.9rem', color: '#64748b', fontWeight: '600', marginTop: '0.25rem' }}>
                                    out of 100
                                </div>
                            </div>
                        </div>
                        <div style={{
                            padding: '0.5rem 1.25rem',
                            borderRadius: '999px',
                            background: `${getScoreColor(scoreData.score)}15`,
                            color: getScoreColor(scoreData.score),
                            fontWeight: '700',
                            fontSize: '0.95rem'
                        }}>
                            {getScoreLabel(scoreData.score)}
                        </div>
                    </div>

                    {/* Insights */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                        {/* Weekly Insight */}
                        <div style={{
                            padding: '1.25rem',
                            borderRadius: '1rem',
                            background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                            border: '1px solid #bbf7d0'
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                                <div style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '8px',
                                    background: '#1f7a4d',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '1.25rem',
                                    color: '#fff',
                                    fontWeight: '600'
                                }}>
                                    📈
                                </div>
                                <h3 style={{ margin: 0, fontSize: '1rem', color: '#166534', fontWeight: '700' }}>
                                    Weekly Insight
                                </h3>
                            </div>
                            <p style={{ margin: 0, color: '#15803d', fontSize: '0.95rem', lineHeight: '1.6' }}>
                                {scoreData.insights.weeklyInsight}
                            </p>
                        </div>

                        {/* Weekly Improvement */}
                        {scoreData.weeklyImprovement !== 0 && (
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.75rem',
                                padding: '1rem 1.25rem',
                                borderRadius: '0.75rem',
                                background: scoreData.weeklyImprovement > 0 ? '#f0fdf4' : '#fef2f2',
                                border: `1px solid ${scoreData.weeklyImprovement > 0 ? '#bbf7d0' : '#fecaca'}`
                            }}>
                                <span style={{ fontSize: '1.5rem' }}>
                                    {scoreData.weeklyImprovement > 0 ? '📈' : '📉'}
                                </span>
                                <div>
                                    <div style={{ fontSize: '0.85rem', color: '#64748b', fontWeight: '600' }}>
                                        Weekly Change
                                    </div>
                                    <div style={{
                                        fontSize: '1.25rem',
                                        fontWeight: '700',
                                        color: scoreData.weeklyImprovement > 0 ? '#16a34a' : '#dc2626'
                                    }}>
                                        {scoreData.weeklyImprovement > 0 ? '+' : ''}{scoreData.weeklyImprovement} points
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Score Breakdown */}
            <div className="card sdg-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem 0', color: '#1e293b', fontWeight: '700' }}>
                    Score Breakdown
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1.25rem' }}>
                    {/* Waste Reduction */}
                    <div style={{
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
                        border: '1px solid #fcd34d'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#92400e', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Waste Reduction
                            </h4>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#b45309' }}>
                                {scoreData.breakdown.wasteReduction}
                            </div>
                        </div>
                        <div style={{ height: '6px', background: '#fef3c7', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${scoreData.breakdown.wasteReduction}%`,
                                background: 'linear-gradient(90deg, #f59e0b, #d97706)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }} />
                        </div>
                    </div>

                    {/* Nutrition */}
                    <div style={{
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
                        border: '1px solid #93c5fd'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#1e40af', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Nutrition
                            </h4>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#2563eb' }}>
                                {scoreData.breakdown.nutrition}
                            </div>
                        </div>
                        <div style={{ height: '6px', background: '#dbeafe', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${scoreData.breakdown.nutrition}%`,
                                background: 'linear-gradient(90deg, #3b82f6, #2563eb)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }} />
                        </div>
                    </div>

                    {/* Inventory Efficiency */}
                    <div style={{
                        padding: '1.5rem',
                        borderRadius: '1rem',
                        background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
                        border: '1px solid #bbf7d0'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                            <h4 style={{ margin: 0, fontSize: '0.9rem', color: '#166534', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Inventory Efficiency
                            </h4>
                            <div style={{ fontSize: '1.75rem', fontWeight: '800', color: '#16a34a' }}>
                                {scoreData.breakdown.inventoryEfficiency}
                            </div>
                        </div>
                        <div style={{ height: '6px', background: '#f0fdf4', borderRadius: '999px', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%',
                                width: `${scoreData.breakdown.inventoryEfficiency}%`,
                                background: 'linear-gradient(90deg, #22c55e, #16a34a)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }} />
                        </div>
                    </div>
                </div>
            </div>

            {/* Strengths & Weaknesses */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.5rem' }}>
                {/* Top Strength */}
                <div className="card sdg-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #f0fdf4 0%, #ffffff 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #22c55e, #16a34a)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            color: '#fff',
                            fontWeight: '600'
                        }}>
                            ★
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#166534', fontWeight: '700' }}>
                            Top Strength
                        </h3>
                    </div>
                    <p style={{ margin: 0, color: '#15803d', fontSize: '1rem', lineHeight: '1.6', fontWeight: '500' }}>
                        {scoreData.insights.topStrength}
                    </p>
                </div>

                {/* Area for Improvement */}
                <div className="card sdg-card" style={{ padding: '1.5rem', background: 'linear-gradient(135deg, #fff7ed 0%, #ffffff 100%)', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '10px',
                            background: 'linear-gradient(135deg, #f97316, #ea580c)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '1.25rem',
                            color: '#fff',
                            fontWeight: '600'
                        }}>
                            ⚡
                        </div>
                        <h3 style={{ margin: 0, fontSize: '1.1rem', color: '#9a3412', fontWeight: '700' }}>
                            Focus Area
                        </h3>
                    </div>
                    <p style={{ margin: 0, color: '#c2410c', fontSize: '1rem', lineHeight: '1.6', fontWeight: '500' }}>
                        {scoreData.insights.topWeakness}
                    </p>
                </div>
            </div>

            {/* Actionable Steps */}
            <div className="card sdg-card" style={{ padding: '1.75rem' }}>
                <h3 style={{ fontSize: '1.25rem', margin: '0 0 1.5rem 0', color: '#1e293b', fontWeight: '700' }}>
                    Actionable Next Steps
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {scoreData.insights.actionableSteps.map((step, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '1rem',
                                padding: '1.25rem',
                                borderRadius: '0.75rem',
                                background: '#f8fafc',
                                border: '1px solid #e2e8f0',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.borderColor = '#1f7a4d';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(31, 122, 77, 0.1)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#e2e8f0';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{
                                minWidth: '32px',
                                height: '32px',
                                borderRadius: '8px',
                                background: 'linear-gradient(135deg, #1f7a4d, #15803d)',
                                color: 'white',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: '700',
                                fontSize: '0.95rem'
                            }}>
                                {index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                                <p style={{ margin: '0 0 0.5rem 0', color: '#334155', fontSize: '0.95rem', lineHeight: '1.6', fontWeight: '500' }}>
                                    {step}
                                </p>
                                <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.5rem',
                                    padding: '0.35rem 0.75rem',
                                    borderRadius: '999px',
                                    background: '#dcfce7',
                                    fontSize: '0.85rem',
                                    fontWeight: '700',
                                    color: '#166534'
                                }}>
                                    <span>Potential Impact:</span>
                                    <span style={{ color: '#16a34a' }}>{scoreData.insights.scoreImpact[index]}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
