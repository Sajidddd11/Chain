import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
    Target,
    TrendingUp,
    Award,
    Leaf,
    Heart,
    BarChart3,
    Lightbulb,
    CheckCircle,
    AlertTriangle,
    ArrowUp,
    ArrowDown,
    Activity,
    Zap,
    Globe
} from 'lucide-react';
import { SkeletonGrid } from '../components/SkeletonLoader';

interface SDGScore {
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
}

export function SDGImpact() {
    const { token } = useAuth();
    const [sdgScore, setSdgScore] = useState<SDGScore | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!token) return;

        const fetchSDGScore = async () => {
            try {
                // Check localStorage cache first (1 hour cache)
                const CACHE_KEY = `sdg_score_${token}`;
                const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        const cacheAge = Date.now() - parsed.timestamp;

                        // Use cache if less than 1 hour old
                        if (cacheAge < CACHE_DURATION) {
                            setSdgScore(parsed.data);
                            setLoading(false);
                            return; // Don't fetch from API
                        }
                    } catch (e) {
                        console.error('Invalid cache data:', e);
                    }
                }

                setLoading(true);
                setError(null);

                const response = await api.getSDGScore(token);

                const newScore = {
                    score: response.score,
                    breakdown: response.breakdown,
                    weeklyImprovement: response.weeklyImprovement || 0,
                    insights: response.insights
                };

                setSdgScore(newScore);

                // Store in localStorage
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: newScore
                }));

                setLoading(false);
            } catch (err: any) {
                console.error('Failed to fetch SDG score:', err);
                setError(err.message || 'Failed to load SDG score');
                setLoading(false);
            }
        };

        fetchSDGScore();
    }, [token]);

    if (loading) {
        return (
            <div className="animate-fade-in">
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem', background: 'var(--green-900)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '12px',
                            animation: 'pulse 2s ease-in-out infinite'
                        }}></div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                height: '24px',
                                width: '60%',
                                background: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: '6px',
                                marginBottom: '0.5rem',
                                animation: 'pulse 2s ease-in-out infinite'
                            }}></div>
                            <div style={{
                                height: '16px',
                                width: '40%',
                                background: 'rgba(255, 255, 255, 0.15)',
                                borderRadius: '6px',
                                animation: 'pulse 2s ease-in-out infinite'
                            }}></div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{
                        height: '24px',
                        width: '250px',
                        background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)',
                        backgroundSize: '1000px 100%',
                        animation: 'shimmer 2s infinite linear',
                        borderRadius: '6px',
                        marginBottom: '1.5rem'
                    }}></div>
                    <SkeletonGrid count={3} />
                </div>
                <style>{`
                    @keyframes shimmer {
                        0% { background-position: -1000px 0; }
                        100% { background-position: 1000px 0; }
                    }
                    @keyframes pulse {
                        0%, 100% { opacity: 1; }
                        50% { opacity: 0.6; }
                    }
                `}</style>
            </div>
        );
    }

    if (error) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--green-900)', marginBottom: '0.5rem', fontSize: '1.125rem' }}>Unable to Load Data</h3>
                <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.875rem', margin: 0 }}>{error}</p>
            </div>
        );
    }

    if (!sdgScore) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
                <AlertTriangle size={40} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--green-900)', marginBottom: '0.5rem', fontSize: '1.125rem' }}>No Data Available</h3>
                <p style={{ color: 'rgba(0, 0, 0, 0.6)', fontSize: '0.875rem', margin: 0 }}>Start tracking your food consumption to see your SDG impact score.</p>
            </div>
        );
    }

    return (
        <div className="animate-fade-in">
            {/* Page Header */}
            <div className="page-header-modern">
                <div>
                    <h2>SDG Impact Scoring</h2>
                    <p className="subtitle">Track your contribution to Sustainable Development Goals</p>
                </div>
                <div className="header-stats">
                    <div className="stat-pill success">
                        <span className="stat-value">{sdgScore.score}</span>
                        <span className="stat-label">SDG Score</span>
                    </div>
                    <div className="stat-pill" style={{ background: sdgScore.weeklyImprovement >= 0 ? 'rgba(31, 122, 77, 0.1)' : 'rgba(239, 68, 68, 0.1)' }}>
                        <span className="stat-value" style={{ color: sdgScore.weeklyImprovement >= 0 ? 'var(--green-900)' : '#dc2626' }}>
                            {sdgScore.weeklyImprovement >= 0 ? '+' : ''}{sdgScore.weeklyImprovement}
                        </span>
                        <span className="stat-label">This Week</span>
                    </div>
                </div>
            </div>

            {/* Overall Score Card */}
            <div className="card" style={{ marginBottom: '1.25rem', background: 'var(--green-900)', color: 'white', padding: '1.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: '250px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                            <Award size={24} />
                            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '700' }}>Your SDG Impact Score</h3>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '3rem', fontWeight: '900', lineHeight: 1 }}>{sdgScore.score}</div>
                            <div style={{ fontSize: '1.25rem', opacity: 0.9 }}>/ 100</div>
                        </div>

                        <div style={{
                            height: '8px',
                            background: 'rgba(255, 255, 255, 0.2)',
                            borderRadius: '999px',
                            overflow: 'hidden',
                            maxWidth: '350px'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${sdgScore.score}%`,
                                background: 'rgba(255, 255, 255, 0.9)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }}></div>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '10px',
                        padding: '1rem 1.25rem',
                        textAlign: 'center'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.375rem', marginBottom: '0.5rem' }}>
                            {sdgScore.weeklyImprovement >= 0 ? <ArrowUp size={18} /> : <ArrowDown size={18} />}
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Weekly
                            </span>
                        </div>
                        <div style={{ fontSize: '2rem', fontWeight: '900', lineHeight: 1 }}>
                            {sdgScore.weeklyImprovement >= 0 ? '+' : ''}{sdgScore.weeklyImprovement}
                        </div>
                    </div>
                </div>
            </div>

            {/* Score Breakdown */}
            <div className="card" style={{ marginBottom: '1.25rem', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--green-900)', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <BarChart3 size={20} />
                    Performance Breakdown
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem' }}>
                    {/* Waste Reduction */}
                    <div style={{
                        background: 'var(--sage-50)',
                        borderRadius: '10px',
                        padding: '1rem',
                        border: '2px solid rgba(31, 122, 77, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <Leaf size={18} color="var(--green-900)" />
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: '700', color: 'var(--green-900)' }}>Waste Reduction</h4>
                                <p style={{ margin: 0, fontSize: '0.6875rem', color: 'rgba(0, 0, 0, 0.6)' }}>SDG 2 & 12</p>
                            </div>
                        </div>

                        <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--green-900)', marginBottom: '0.5rem', lineHeight: 1 }}>
                            {sdgScore.breakdown.wasteReduction}%
                        </div>

                        <div style={{
                            height: '6px',
                            background: 'rgba(31, 122, 77, 0.15)',
                            borderRadius: '999px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${sdgScore.breakdown.wasteReduction}%`,
                                background: 'var(--green-900)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }}></div>
                        </div>
                    </div>

                    {/* Nutrition */}
                    <div style={{
                        background: 'var(--sage-50)',
                        borderRadius: '10px',
                        padding: '1rem',
                        border: '2px solid rgba(31, 122, 77, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <Heart size={18} color="var(--green-900)" />
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: '700', color: 'var(--green-900)' }}>Nutrition Quality</h4>
                                <p style={{ margin: 0, fontSize: '0.6875rem', color: 'rgba(0, 0, 0, 0.6)' }}>SDG 2 & 3</p>
                            </div>
                        </div>

                        <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--green-900)', marginBottom: '0.5rem', lineHeight: 1 }}>
                            {sdgScore.breakdown.nutrition}%
                        </div>

                        <div style={{
                            height: '6px',
                            background: 'rgba(31, 122, 77, 0.15)',
                            borderRadius: '999px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${sdgScore.breakdown.nutrition}%`,
                                background: 'var(--green-900)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }}></div>
                        </div>
                    </div>

                    {/* Inventory Efficiency */}
                    <div style={{
                        background: 'var(--sage-50)',
                        borderRadius: '10px',
                        padding: '1rem',
                        border: '2px solid rgba(31, 122, 77, 0.2)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <TrendingUp size={18} color="var(--green-900)" />
                            <div>
                                <h4 style={{ margin: 0, fontSize: '0.8125rem', fontWeight: '700', color: 'var(--green-900)' }}>Inventory Efficiency</h4>
                                <p style={{ margin: 0, fontSize: '0.6875rem', color: 'rgba(0, 0, 0, 0.6)' }}>SDG 12</p>
                            </div>
                        </div>

                        <div style={{ fontSize: '2rem', fontWeight: '900', color: 'var(--green-900)', marginBottom: '0.5rem', lineHeight: 1 }}>
                            {sdgScore.breakdown.inventoryEfficiency}%
                        </div>

                        <div style={{
                            height: '6px',
                            background: 'rgba(31, 122, 77, 0.15)',
                            borderRadius: '999px',
                            overflow: 'hidden'
                        }}>
                            <div style={{
                                height: '100%',
                                width: `${sdgScore.breakdown.inventoryEfficiency}%`,
                                background: 'var(--green-900)',
                                borderRadius: '999px',
                                transition: 'width 1s ease-out'
                            }}></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* AI Insights */}
            <div className="card" style={{ marginBottom: '1.25rem', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--green-900)', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Lightbulb size={20} />
                    AI-Powered Insights
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
                    {/* Weekly Insight */}
                    <div style={{
                        background: 'var(--sage-50)',
                        borderRadius: '10px',
                        padding: '1rem',
                        border: '1px solid rgba(31, 122, 77, 0.15)',
                        gridColumn: 'span 2'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Activity size={16} color="var(--green-900)" />
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--green-900)' }}>This Week's Highlight</h4>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                            {sdgScore.insights.weeklyInsight}
                        </p>
                    </div>

                    {/* Top Strength */}
                    <div style={{
                        background: 'var(--sage-50)',
                        borderRadius: '10px',
                        padding: '1rem',
                        border: '1px solid rgba(31, 122, 77, 0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <CheckCircle size={16} color="var(--green-900)" />
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--green-900)' }}>Top Strength</h4>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                            {sdgScore.insights.topStrength}
                        </p>
                    </div>

                    {/* Top Weakness */}
                    <div style={{
                        background: 'var(--sage-50)',
                        borderRadius: '10px',
                        padding: '1rem',
                        border: '1px solid rgba(31, 122, 77, 0.15)'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Target size={16} color="var(--green-900)" />
                            <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: '700', color: 'var(--green-900)' }}>Growth Opportunity</h4>
                        </div>
                        <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                            {sdgScore.insights.topWeakness}
                        </p>
                    </div>
                </div>

                {/* Actionable Steps */}
                <div style={{
                    background: 'var(--sage-50)',
                    borderRadius: '10px',
                    padding: '1.25rem',
                    border: '1px solid rgba(31, 122, 77, 0.15)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                        <Zap size={18} color="var(--green-900)" />
                        <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '700', color: 'var(--green-900)' }}>Actionable Next Steps</h4>
                    </div>

                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                        {sdgScore.insights.actionableSteps.map((step, index) => (
                            <div
                                key={index}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '0.75rem',
                                    background: 'white',
                                    borderRadius: '8px',
                                    padding: '0.75rem',
                                    border: '1px solid rgba(31, 122, 77, 0.1)'
                                }}
                            >
                                <div style={{
                                    width: '24px',
                                    height: '24px',
                                    background: 'var(--green-900)',
                                    borderRadius: '50%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    color: 'white'
                                }}>
                                    {index + 1}
                                </div>
                                <p style={{ fontSize: '0.875rem', color: '#111827', margin: 0, flex: 1, lineHeight: 1.5 }}>{step}</p>
                                <div style={{
                                    background: 'var(--green-900)',
                                    color: 'white',
                                    padding: '0.25rem 0.625rem',
                                    borderRadius: '999px',
                                    fontSize: '0.6875rem',
                                    fontWeight: '700',
                                    whiteSpace: 'nowrap'
                                }}>
                                    {sdgScore.insights.scoreImpact[index]}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* SDG Information */}
            <div className="card" style={{ background: 'var(--sage-50)', padding: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1rem 0', color: 'var(--green-900)', fontSize: '1.125rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Globe size={20} />
                    Sustainable Development Goals
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--green-900)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '1.125rem',
                            fontWeight: '900',
                            color: 'white'
                        }}>
                            2
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.9375rem', fontWeight: '700', color: 'var(--green-900)' }}>Zero Hunger</h4>
                            <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                                Reducing food waste and ensuring better nutrition
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--green-900)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '1.125rem',
                            fontWeight: '900',
                            color: 'white'
                        }}>
                            3
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.9375rem', fontWeight: '700', color: 'var(--green-900)' }}>Good Health</h4>
                            <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                                Promoting healthy and balanced eating habits
                            </p>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            background: 'var(--green-900)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                            fontSize: '1.125rem',
                            fontWeight: '900',
                            color: 'white'
                        }}>
                            12
                        </div>
                        <div>
                            <h4 style={{ margin: '0 0 0.375rem 0', fontSize: '0.9375rem', fontWeight: '700', color: 'var(--green-900)' }}>Responsible Consumption</h4>
                            <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>
                                Minimizing waste through conscious choices
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
