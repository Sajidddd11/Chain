import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import {
    Apple,
    TrendingUp,
    AlertTriangle,
    CheckCircle,
    Zap,
    Droplets,
    Heart,
    Sparkles,
    Target,
    Info,
    Award,
    Activity,
    Flame
} from 'lucide-react';
import { SkeletonGrid } from './SkeletonLoader';

interface NutrientData {
    name: string;
    percentage: number;
    status: 'good' | 'warning' | 'critical';
    dailyValue: string;
}

interface Deficiency {
    nutrient: string;
    severity: 'high' | 'medium' | 'low';
    reason: string;
    icon: string;
}

interface FoodSuggestion {
    name: string;
    priority: 'high' | 'medium' | 'low';
    nutrients: string[];
    description: string;
    servingSize: string;
    impact: string;
}

interface MealSuggestion {
    name: string;
    description: string;
    nutrients: string[];
    difficulty: string;
}

export function NutrientGapPrediction() {
    const { token } = useAuth();
    const [loading, setLoading] = useState(true);
    const [nutrients, setNutrients] = useState<NutrientData[]>([]);
    const [deficiencies, setDeficiencies] = useState<Deficiency[]>([]);
    const [foodSuggestions, setFoodSuggestions] = useState<FoodSuggestion[]>([]);
    const [mealSuggestions, setMealSuggestions] = useState<MealSuggestion[]>([]);
    const [cached, setCached] = useState(false);
    const [cacheAge, setCacheAge] = useState<number | null>(null);

    useEffect(() => {
        if (!token) return;

        const fetchNutrientData = async () => {
            try {
                // Check localStorage cache first (1 hour cache)
                const CACHE_KEY = `nutrient_analysis_${token}`;
                const CACHE_DURATION = 60 * 60 * 1000; // 1 hour in milliseconds

                const cachedData = localStorage.getItem(CACHE_KEY);
                if (cachedData) {
                    try {
                        const parsed = JSON.parse(cachedData);
                        const cacheAge = Date.now() - parsed.timestamp;

                        // Use cache if less than 1 hour old
                        if (cacheAge < CACHE_DURATION) {
                            setNutrients(parsed.data.nutrients);
                            setDeficiencies(parsed.data.deficiencies);
                            setFoodSuggestions(parsed.data.foodSuggestions);
                            setMealSuggestions(parsed.data.mealSuggestions);
                            setCached(true);
                            setCacheAge(Math.round(cacheAge / 1000 / 60)); // minutes
                            setLoading(false);
                            return; // Don't fetch from API
                        }
                    } catch (e) {
                        // Invalid cache, continue to fetch
                        console.error('Invalid cache data:', e);
                    }
                }

                setLoading(true);

                const response = await api.getNutrientAnalysis(token);

                setNutrients(response.nutrients);
                setDeficiencies(response.deficiencies);
                setFoodSuggestions(response.foodSuggestions);
                setMealSuggestions(response.mealSuggestions);
                setCached(response.cached || false);
                setCacheAge(response.cacheAge || null);

                // Store in localStorage
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    timestamp: Date.now(),
                    data: {
                        nutrients: response.nutrients,
                        deficiencies: response.deficiencies,
                        foodSuggestions: response.foodSuggestions,
                        mealSuggestions: response.mealSuggestions
                    }
                }));

                setLoading(false);
            } catch (err) {
                console.error('Failed to fetch nutrient data:', err);
                setLoading(false);
            }
        };

        fetchNutrientData();
    }, [token]);

    if (loading) {
        return (
            <div className="animate-fade-in">
                <div className="card" style={{ marginBottom: '1.5rem', padding: '1.5rem' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1.5rem' }}>
                        <div style={{
                            width: '48px',
                            height: '48px',
                            background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)',
                            backgroundSize: '1000px 100%',
                            animation: 'shimmer 2s infinite linear',
                            borderRadius: '12px'
                        }}></div>
                        <div style={{ flex: 1 }}>
                            <div style={{
                                height: '20px',
                                width: '60%',
                                background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)',
                                backgroundSize: '1000px 100%',
                                animation: 'shimmer 2s infinite linear',
                                borderRadius: '6px',
                                marginBottom: '0.5rem'
                            }}></div>
                            <div style={{
                                height: '14px',
                                width: '40%',
                                background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)',
                                backgroundSize: '1000px 100%',
                                animation: 'shimmer 2s infinite linear',
                                borderRadius: '6px'
                            }}></div>
                        </div>
                    </div>
                </div>
                <div className="card" style={{ padding: '1.5rem' }}>
                    <div style={{
                        height: '24px',
                        width: '200px',
                        background: 'linear-gradient(90deg, #f0f0f0 0%, #e0e0e0 50%, #f0f0f0 100%)',
                        backgroundSize: '1000px 100%',
                        animation: 'shimmer 2s infinite linear',
                        borderRadius: '6px',
                        marginBottom: '1.5rem'
                    }}></div>
                    <SkeletonGrid count={6} />
                </div>
                <style>{`
                    @keyframes shimmer {
                        0% { background-position: -1000px 0; }
                        100% { background-position: 1000px 0; }
                    }
                `}</style>
            </div>
        );
    }

    if (nutrients.length === 0) {
        return (
            <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <AlertTriangle size={48} color="#f59e0b" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: 'var(--green-900)', marginBottom: '0.5rem' }}>No Data Available</h3>
                <p style={{ color: 'rgba(0, 0, 0, 0.6)' }}>Start tracking your food consumption to see nutrient analysis.</p>
            </div>
        );
    }

    const overallScore = Math.round(nutrients.reduce((acc, n) => acc + n.percentage, 0) / nutrients.length);

    return (
        <div className="animate-fade-in">
            {/* Hero Section */}
            <div className="card" style={{ marginBottom: '1.5rem', background: 'var(--green-900)', color: 'white' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '2rem' }}>
                    <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                            <div style={{
                                width: '56px',
                                height: '56px',
                                background: 'rgba(255, 255, 255, 0.2)',
                                borderRadius: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                <Apple size={28} />
                            </div>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: '700' }}>Nutrient Gap Analysis</h2>
                                <p style={{ margin: '0.25rem 0 0 0', opacity: 0.9, fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <Sparkles size={16} />
                                    AI-powered nutritional insights
                                    {cached && cacheAge && (
                                        <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>
                                            (Cached {cacheAge} min ago)
                                        </span>
                                    )}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div style={{
                        background: 'rgba(255, 255, 255, 0.15)',
                        borderRadius: '12px',
                        padding: '1.25rem 1.5rem',
                        textAlign: 'center',
                        minWidth: '140px'
                    }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            <Award size={18} />
                            <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                Overall Score
                            </span>
                        </div>
                        <div style={{ fontSize: '2.5rem', fontWeight: '900', lineHeight: 1 }}>{overallScore}</div>
                        <div style={{ fontSize: '0.8rem', opacity: 0.9, marginTop: '0.25rem' }}>out of 100</div>
                    </div>
                </div>
            </div>

            {/* Nutrient Levels */}
            <div className="card" style={{ marginBottom: '1.5rem' }}>
                <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--green-900)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Activity size={20} />
                    Nutrient Levels
                </h3>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '1rem' }}>
                    {nutrients.map((nutrient, index) => (
                        <div
                            key={index}
                            style={{
                                background: 'var(--sage-50)',
                                borderRadius: '12px',
                                padding: '1rem',
                                border: '1px solid rgba(31, 122, 77, 0.1)',
                                transition: 'all 0.2s ease'
                            }}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-2px)';
                                e.currentTarget.style.boxShadow = '0 8px 20px rgba(31, 122, 77, 0.12)';
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)';
                                e.currentTarget.style.boxShadow = 'none';
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                                <span style={{ fontSize: '0.875rem', fontWeight: '700', color: 'var(--green-900)' }}>{nutrient.name}</span>
                                <div style={{
                                    width: '8px',
                                    height: '8px',
                                    borderRadius: '50%',
                                    background: nutrient.status === 'good' ? '#22c55e' : nutrient.status === 'warning' ? '#f59e0b' : '#ef4444'
                                }}></div>
                            </div>

                            <div style={{ marginBottom: '0.75rem' }}>
                                <div style={{ fontSize: '1.75rem', fontWeight: '900', color: 'var(--green-900)', lineHeight: 1 }}>
                                    {nutrient.percentage}%
                                </div>
                            </div>

                            <div style={{
                                height: '6px',
                                background: 'rgba(31, 122, 77, 0.1)',
                                borderRadius: '999px',
                                overflow: 'hidden',
                                marginBottom: '0.5rem'
                            }}>
                                <div style={{
                                    height: '100%',
                                    width: `${nutrient.percentage}%`,
                                    background: nutrient.status === 'good' ? 'linear-gradient(90deg, #22c55e, #16a34a)' :
                                        nutrient.status === 'warning' ? 'linear-gradient(90deg, #f59e0b, #d97706)' :
                                            'linear-gradient(90deg, #ef4444, #dc2626)',
                                    borderRadius: '999px',
                                    transition: 'width 1s ease-out'
                                }}></div>
                            </div>

                            <p style={{ fontSize: '0.75rem', color: 'rgba(0, 0, 0, 0.6)', margin: 0 }}>{nutrient.dailyValue}</p>
                        </div>
                    ))}
                </div>
            </div>

            {/* Deficiencies */}
            {deficiencies.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--green-900)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <AlertTriangle size={20} />
                        Areas Needing Attention
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem' }}>
                        {deficiencies.map((deficiency, index) => {
                            const IconComponent = deficiency.icon === 'droplets' ? Droplets :
                                deficiency.icon === 'zap' ? Zap :
                                    deficiency.icon === 'heart' ? Heart : Flame;
                            const bgColor = deficiency.severity === 'high' ? '#fee2e2' :
                                deficiency.severity === 'medium' ? '#fed7aa' : '#fef3c7';
                            const iconBg = deficiency.severity === 'high' ? '#ef4444' :
                                deficiency.severity === 'medium' ? '#f97316' : '#f59e0b';

                            return (
                                <div
                                    key={index}
                                    style={{
                                        background: bgColor,
                                        borderRadius: '12px',
                                        padding: '1.25rem',
                                        border: `2px solid ${iconBg}20`,
                                        display: 'flex',
                                        gap: '1rem',
                                        alignItems: 'flex-start'
                                    }}
                                >
                                    <div style={{
                                        width: '44px',
                                        height: '44px',
                                        background: iconBg,
                                        borderRadius: '10px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        flexShrink: 0
                                    }}>
                                        <IconComponent size={22} color="white" />
                                    </div>
                                    <div style={{ flex: 1, minWidth: 0 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                            <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: '#111827' }}>{deficiency.nutrient}</h4>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '700',
                                                textTransform: 'uppercase',
                                                padding: '0.25rem 0.5rem',
                                                borderRadius: '4px',
                                                background: iconBg,
                                                color: 'white',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {deficiency.severity}
                                            </span>
                                        </div>
                                        <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: 0, lineHeight: 1.5 }}>{deficiency.reason}</p>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Food Recommendations */}
            {foodSuggestions.length > 0 && (
                <div className="card" style={{ marginBottom: '1.5rem' }}>
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--green-900)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Apple size={20} />
                        Recommended Foods
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                        {foodSuggestions.map((food, index) => (
                            <div
                                key={index}
                                style={{
                                    background: 'var(--sage-50)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    border: '1px solid rgba(31, 122, 77, 0.15)'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'var(--green-900)', flex: 1 }}>{food.name}</h4>
                                    <span style={{
                                        fontSize: '0.7rem',
                                        fontWeight: '700',
                                        textTransform: 'uppercase',
                                        padding: '0.375rem 0.75rem',
                                        borderRadius: '999px',
                                        background: food.priority === 'high' ? '#dc2626' : food.priority === 'medium' ? '#2563eb' : '#16a34a',
                                        color: 'white',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {food.priority}
                                    </span>
                                </div>

                                <p style={{ fontSize: '0.875rem', color: '#4b5563', margin: '0 0 0.75rem 0', lineHeight: 1.5 }}>{food.description}</p>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
                                    {food.nutrients.map((nutrient, nIndex) => (
                                        <span
                                            key={nIndex}
                                            style={{
                                                fontSize: '0.75rem',
                                                fontWeight: '600',
                                                padding: '0.25rem 0.625rem',
                                                background: 'white',
                                                border: '1px solid rgba(31, 122, 77, 0.2)',
                                                borderRadius: '999px',
                                                color: 'var(--green-900)'
                                            }}
                                        >
                                            {nutrient}
                                        </span>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: '#6b7280', fontWeight: '600' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <Target size={14} />
                                        <span>{food.servingSize}</span>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                                        <TrendingUp size={14} />
                                        <span>{food.impact}</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Meal Suggestions */}
            {mealSuggestions.length > 0 && (
                <div className="card">
                    <h3 style={{ margin: '0 0 1.5rem 0', color: 'var(--green-900)', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <Target size={20} />
                        Nutrient-Rich Meals
                    </h3>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '1rem' }}>
                        {mealSuggestions.map((meal, index) => (
                            <div
                                key={index}
                                style={{
                                    background: 'var(--sage-50)',
                                    borderRadius: '12px',
                                    padding: '1.25rem',
                                    border: '1px solid rgba(31, 122, 77, 0.15)',
                                    display: 'flex',
                                    flexDirection: 'column'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem', marginBottom: '0.75rem' }}>
                                    <h4 style={{ margin: 0, fontSize: '0.9375rem', fontWeight: '700', color: 'var(--green-900)', flex: 1 }}>{meal.name}</h4>
                                    <CheckCircle size={20} color="var(--green-900)" />
                                </div>

                                <p style={{ fontSize: '0.8125rem', color: '#4b5563', margin: '0 0 0.75rem 0', lineHeight: 1.5, flex: 1 }}>{meal.description}</p>

                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', marginBottom: '0.75rem' }}>
                                    {meal.nutrients.map((nutrient, nIndex) => (
                                        <span
                                            key={nIndex}
                                            style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '600',
                                                padding: '0.25rem 0.5rem',
                                                background: 'white',
                                                border: '1px solid rgba(31, 122, 77, 0.2)',
                                                borderRadius: '999px',
                                                color: 'var(--green-900)'
                                            }}
                                        >
                                            {nutrient}
                                        </span>
                                    ))}
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', fontSize: '0.8125rem', color: '#6b7280', fontWeight: '600' }}>
                                    <Info size={14} />
                                    <span>Difficulty: {meal.difficulty}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
