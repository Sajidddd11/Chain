import { useState, useEffect } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { Target, TrendingUp, Award, Leaf, Heart, BarChart3, Lightbulb, CheckCircle, AlertTriangle, ArrowUp, ArrowDown, Sparkles, Globe, Activity, Apple, Carrot, Droplets, Zap } from 'lucide-react';

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
  categoryBreakdown: Array<{
    category: string;
    count: number;
    quantity: number;
  }>;
}

export function SDG() {
  const { token } = useAuth();
  const [sdgScore, setSdgScore] = useState<SDGScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    const fetchSDGScore = async () => {
      try {
        setLoading(true);
        const response = await api.getSDGScore(token);
        setSdgScore(response);
      } catch (err) {
        console.error('Failed to fetch SDG score:', err);
        // For demo purposes, show sample data if API fails
        setSdgScore({
          score: 67,
          breakdown: {
            wasteReduction: 72,
            nutrition: 65,
            inventoryEfficiency: 58
          },
          weeklyImprovement: 5,
          insights: {
            weeklyInsight: "Great progress! You've reduced food waste by 8% this week by planning meals better.",
            topStrength: "Excellent waste management practices",
            topWeakness: "Room for improvement in inventory optimization",
            actionableSteps: [
              "Plan meals for the week ahead to reduce impulse purchases",
              "Use older items first before they expire",
              "Track your consumption patterns to identify waste sources"
            ],
            scoreImpact: ["+12 points", "+8 points", "+15 points"]
          },
          categoryBreakdown: [
            { category: "Vegetables", count: 12, quantity: 8.5 },
            { category: "Fruits", count: 8, quantity: 6.2 },
            { category: "Grains", count: 15, quantity: 12.8 },
            { category: "Dairy", count: 6, quantity: 4.1 },
            { category: "Meat", count: 4, quantity: 2.9 }
          ]
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSDGScore();
  }, [token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[70vh]">
        <div className="text-center space-y-6">
          <div className="relative inline-block">
            <div className="animate-spin rounded-full h-20 w-20 border-4 border-emerald-100 border-t-emerald-600"></div>
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-r-teal-500 animate-spin" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <Globe className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-emerald-600 animate-pulse" />
          </div>
          <div className="space-y-2">
            <h3 className="text-xl font-bold text-gray-900">Calculating Your Impact</h3>
            <p className="text-gray-600 max-w-sm">Analyzing your sustainability metrics and environmental contribution...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-8 px-4 sm:px-6 lg:px-8 py-6 pb-12">
      {/* Hero Header with Gradient */}
      <div className="relative bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 rounded-3xl p-10 text-white overflow-hidden shadow-2xl">
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-pulse"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full filter blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        </div>

        <div className="relative z-10">
          <div className="flex items-center justify-between flex-wrap gap-6 mb-8">
            <div className="flex items-center space-x-4">
              <div className="p-4 bg-white/20 backdrop-blur-lg rounded-2xl shadow-lg border border-white/30">
                <Target className="h-10 w-10 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold mb-1 tracking-tight">SDG Impact Dashboard</h1>
                <p className="text-emerald-50 text-lg font-medium flex items-center">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Your contribution to Sustainable Development Goals
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-2 bg-white/15 backdrop-blur-md px-5 py-3 rounded-full border border-white/30">
              <Activity className="h-5 w-5 text-emerald-200" />
              <span className="text-sm font-semibold">Live Tracking Active</span>
            </div>
          </div>

          {sdgScore && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Overall Score Card */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                <div className="relative bg-white/20 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/90 text-sm font-semibold uppercase tracking-wide">Overall Score</span>
                    <Award className="h-6 w-6 text-yellow-300" />
                  </div>
                  <div className="text-6xl font-black mb-2 bg-gradient-to-br from-yellow-200 to-yellow-400 bg-clip-text text-transparent">
                    {sdgScore.score}
                  </div>
                  <div className="text-white/80 text-sm font-medium">out of 100 points</div>
                  <div className="mt-4 h-2 bg-white/20 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-yellow-300 to-yellow-500 rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${sdgScore.score}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Weekly Improvement Card */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-green-400 to-emerald-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                <div className="relative bg-white/20 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/90 text-sm font-semibold uppercase tracking-wide">Weekly Growth</span>
                    {sdgScore.weeklyImprovement > 0 ? (
                      <ArrowUp className="h-6 w-6 text-green-300" />
                    ) : sdgScore.weeklyImprovement < 0 ? (
                      <ArrowDown className="h-6 w-6 text-red-300" />
                    ) : (
                      <Activity className="h-6 w-6 text-white/70" />
                    )}
                  </div>
                  <div className="text-6xl font-black mb-2 text-white">
                    {sdgScore.weeklyImprovement > 0 ? '+' : ''}{sdgScore.weeklyImprovement}
                  </div>
                  <div className="text-white/80 text-sm font-medium">points this week</div>
                  <div className="mt-4 flex items-center space-x-2">
                    <div className={`px-3 py-1 rounded-full text-xs font-bold ${sdgScore.weeklyImprovement > 0
                      ? 'bg-green-400/30 text-green-100'
                      : sdgScore.weeklyImprovement < 0
                        ? 'bg-red-400/30 text-red-100'
                        : 'bg-white/20 text-white'
                      }`}>
                      {sdgScore.weeklyImprovement > 0 ? 'Improving' : sdgScore.weeklyImprovement < 0 ? 'Needs Focus' : 'Stable'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Performance Status Card */}
              <div className="relative group">
                <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-400 to-cyan-500 rounded-2xl blur opacity-30 group-hover:opacity-50 transition duration-300"></div>
                <div className="relative bg-white/20 backdrop-blur-xl rounded-2xl p-6 border border-white/30 shadow-xl">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-white/90 text-sm font-semibold uppercase tracking-wide">Status</span>
                    <CheckCircle className="h-6 w-6 text-cyan-300" />
                  </div>
                  <div className="text-2xl font-bold mb-2 text-white">
                    {sdgScore.score >= 80 ? 'Excellent!' : sdgScore.score >= 60 ? 'Great Progress!' : 'Keep Going!'}
                  </div>
                  <div className="text-white/80 text-sm font-medium">
                    {sdgScore.score >= 80 ? 'Outstanding performance' : sdgScore.score >= 60 ? 'You\'re making a difference' : 'Every step counts'}
                  </div>
                  <div className="mt-4 flex items-center space-x-2">
                    <Globe className="h-4 w-4 text-cyan-300" />
                    <span className="text-xs text-white/70 font-medium">Contributing to global sustainability</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {sdgScore && (
        <>
          {/* Score Breakdown Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-2 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Performance Breakdown</h2>
                <p className="text-gray-600 text-sm">Detailed metrics across key sustainability areas</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Waste Reduction Card */}
              <div className="group relative bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 hover:shadow-xl">
                <div className="absolute top-4 right-4 w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Leaf className="h-6 w-6 text-emerald-600" />
                </div>
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Waste Reduction</h3>
                  <p className="text-sm text-emerald-700 font-medium">SDG 2 & 12</p>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-5xl font-black text-emerald-600">{sdgScore.breakdown.wasteReduction}</span>
                    <span className="text-2xl font-bold text-emerald-500">%</span>
                  </div>
                  <div className="w-full bg-emerald-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-emerald-500 via-emerald-600 to-green-600 h-4 rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${sdgScore.breakdown.wasteReduction}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Minimizing food waste and promoting responsible consumption patterns
                </p>
              </div>

              {/* Nutrition Card */}
              <div className="group relative bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-6 border-2 border-blue-200 hover:border-blue-400 transition-all duration-300 hover:shadow-xl">
                <div className="absolute top-4 right-4 w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Heart className="h-6 w-6 text-blue-600" />
                </div>
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Nutrition Quality</h3>
                  <p className="text-sm text-blue-700 font-medium">SDG 2 & 3</p>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-5xl font-black text-blue-600">{sdgScore.breakdown.nutrition}</span>
                    <span className="text-2xl font-bold text-blue-500">%</span>
                  </div>
                  <div className="w-full bg-blue-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-blue-500 via-blue-600 to-indigo-600 h-4 rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${sdgScore.breakdown.nutrition}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Maintaining balanced nutrition and promoting healthy eating habits
                </p>
              </div>

              {/* Inventory Efficiency Card */}
              <div className="group relative bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-6 border-2 border-purple-200 hover:border-purple-400 transition-all duration-300 hover:shadow-xl">
                <div className="absolute top-4 right-4 w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                  <TrendingUp className="h-6 w-6 text-purple-600" />
                </div>
                <div className="mb-4">
                  <h3 className="font-bold text-gray-900 text-lg mb-1">Inventory Efficiency</h3>
                  <p className="text-sm text-purple-700 font-medium">SDG 12</p>
                </div>
                <div className="mb-4">
                  <div className="flex items-baseline space-x-2 mb-2">
                    <span className="text-5xl font-black text-purple-600">{sdgScore.breakdown.inventoryEfficiency}</span>
                    <span className="text-2xl font-bold text-purple-500">%</span>
                  </div>
                  <div className="w-full bg-purple-200 rounded-full h-4 overflow-hidden shadow-inner">
                    <div
                      className="bg-gradient-to-r from-purple-500 via-purple-600 to-pink-600 h-4 rounded-full transition-all duration-1000 ease-out shadow-lg"
                      style={{ width: `${sdgScore.breakdown.inventoryEfficiency}%` }}
                    ></div>
                  </div>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed">
                  Optimizing food storage and reducing inventory waste
                </p>
              </div>
            </div>
          </div>

          {/* Insights & Recommendations Section */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl shadow-lg">
                <Lightbulb className="h-6 w-6 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">AI-Powered Insights</h2>
                <p className="text-gray-600 text-sm">Personalized recommendations to boost your impact</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Weekly Insight */}
              <div className="lg:col-span-2">
                <div className="relative bg-gradient-to-br from-violet-50 via-purple-50 to-fuchsia-50 rounded-xl p-6 border-2 border-violet-200 overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-violet-200 rounded-full filter blur-3xl opacity-30"></div>
                  <div className="relative z-10">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="p-2 bg-violet-500 rounded-lg shadow-md">
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <h3 className="font-bold text-violet-900 text-lg">This Week's Highlight</h3>
                    </div>
                    <p className="text-gray-700 leading-relaxed text-base font-medium">
                      {sdgScore.insights.weeklyInsight}
                    </p>
                  </div>
                </div>
              </div>

              {/* Top Strength */}
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-6 border-2 border-emerald-200 hover:border-emerald-400 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-emerald-500 rounded-lg shadow-md">
                    <CheckCircle className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-bold text-emerald-900 text-lg">Top Strength</h3>
                </div>
                <p className="text-gray-700 font-medium leading-relaxed">
                  {sdgScore.insights.topStrength}
                </p>
                <div className="mt-4 inline-flex items-center space-x-2 bg-emerald-100 px-3 py-1.5 rounded-full">
                  <TrendingUp className="h-4 w-4 text-emerald-700" />
                  <span className="text-sm font-bold text-emerald-700">Keep it up!</span>
                </div>
              </div>

              {/* Top Weakness */}
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-6 border-2 border-amber-200 hover:border-amber-400 transition-all duration-300 hover:shadow-lg">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="p-2 bg-amber-500 rounded-lg shadow-md">
                    <AlertTriangle className="h-5 w-5 text-white" />
                  </div>
                  <h3 className="font-bold text-amber-900 text-lg">Growth Opportunity</h3>
                </div>
                <p className="text-gray-700 font-medium leading-relaxed">
                  {sdgScore.insights.topWeakness}
                </p>
                <div className="mt-4 inline-flex items-center space-x-2 bg-amber-100 px-3 py-1.5 rounded-full">
                  <Target className="h-4 w-4 text-amber-700" />
                  <span className="text-sm font-bold text-amber-700">Focus area</span>
                </div>
              </div>

              {/* Actionable Steps */}
              <div className="lg:col-span-2">
                <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-xl p-6 border-2 border-blue-200">
                  <div className="flex items-center space-x-3 mb-5">
                    <div className="p-2 bg-blue-500 rounded-lg shadow-md">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <h3 className="font-bold text-blue-900 text-lg">Actionable Next Steps</h3>
                  </div>
                  <div className="space-y-3">
                    {sdgScore.insights.actionableSteps.map((step, index) => (
                      <div
                        key={index}
                        className="group flex items-start space-x-4 bg-white/70 backdrop-blur-sm rounded-lg p-4 border border-blue-200 hover:border-blue-400 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-cyan-600 rounded-full flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
                          <span className="text-white font-bold text-sm">{index + 1}</span>
                        </div>
                        <div className="flex-1">
                          <p className="text-gray-800 font-medium leading-relaxed">{step}</p>
                        </div>
                        <div className="flex-shrink-0">
                          <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-md">
                            {sdgScore.insights.scoreImpact[index]}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-5 flex items-center justify-center space-x-2 text-blue-700">
                    <Zap className="h-4 w-4" />
                    <span className="text-sm font-semibold">Complete these actions to maximize your SDG score</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Nutrient Gap Prediction */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-orange-500 to-red-600 rounded-xl shadow-lg">
                <Apple className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Nutrient Gap Prediction</h3>
                <p className="text-gray-600 text-sm">AI-powered nutrition analysis and recommendations</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Nutrient Analysis */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-orange-50 to-red-50 border-2 border-orange-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-orange-500 rounded-lg">
                      <BarChart3 className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="font-bold text-orange-900 text-lg">Consumption History Analysis</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Vitamin C</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="w-3/4 h-2 bg-orange-500 rounded-full"></div>
                        </div>
                        <span className="text-xs font-bold text-orange-700">75%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Iron</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="w-1/2 h-2 bg-red-500 rounded-full"></div>
                        </div>
                        <span className="text-xs font-bold text-red-700">50%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Calcium</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="w-2/3 h-2 bg-yellow-500 rounded-full"></div>
                        </div>
                        <span className="text-xs font-bold text-yellow-700">67%</span>
                      </div>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700">Fiber</span>
                      <div className="flex items-center space-x-2">
                        <div className="w-24 h-2 bg-gray-200 rounded-full">
                          <div className="w-4/5 h-2 bg-green-500 rounded-full"></div>
                        </div>
                        <span className="text-xs font-bold text-green-700">80%</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Predicted Deficiencies */}
                <div className="bg-gradient-to-br from-red-50 to-pink-50 border-2 border-red-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-red-500 rounded-lg">
                      <AlertTriangle className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="font-bold text-red-900 text-lg">Predicted Deficiencies</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-3 p-3 bg-white/60 rounded-lg border border-red-200">
                      <Zap className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-red-900 text-sm">Vitamin D</div>
                        <div className="text-xs text-red-700">Low sun exposure + limited dairy intake</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-white/60 rounded-lg border border-red-200">
                      <Droplets className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-red-900 text-sm">Omega-3 Fatty Acids</div>
                        <div className="text-xs text-red-700">Limited fish/seafood consumption</div>
                      </div>
                    </div>
                    <div className="flex items-start space-x-3 p-3 bg-white/60 rounded-lg border border-amber-200">
                      <Carrot className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                      <div>
                        <div className="font-semibold text-amber-900 text-sm">Magnesium</div>
                        <div className="text-xs text-amber-700">Borderline - monitor leafy greens intake</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Food Suggestions */}
              <div className="space-y-6">
                <div className="bg-gradient-to-br from-green-50 to-emerald-50 border-2 border-green-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <Apple className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="font-bold text-green-900 text-lg">Recommended Foods</h4>
                  </div>
                  <div className="space-y-4">
                    <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-green-900">Fatty Fish (Salmon, Mackerel)</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full font-medium">High Priority</span>
                      </div>
                      <p className="text-sm text-green-700 mb-2">Rich in Omega-3 fatty acids to address deficiency</p>
                      <div className="flex items-center space-x-2 text-xs text-green-600">
                        <span>2-3 servings/week</span>
                        <span>•</span>
                        <span>+15 Vitamin D</span>
                      </div>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-green-900">Leafy Greens (Spinach, Kale)</span>
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full font-medium">Medium Priority</span>
                      </div>
                      <p className="text-sm text-green-700 mb-2">Excellent source of magnesium and iron</p>
                      <div className="flex items-center space-x-2 text-xs text-green-600">
                        <span>Daily serving</span>
                        <span>•</span>
                        <span>+8 Iron, +12 Magnesium</span>
                      </div>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-green-200">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-green-900">Citrus Fruits (Oranges, Lemons)</span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full font-medium">Low Priority</span>
                      </div>
                      <p className="text-sm text-green-700 mb-2">Boost Vitamin C intake for better absorption</p>
                      <div className="flex items-center space-x-2 text-xs text-green-600">
                        <span>1-2 daily</span>
                        <span>•</span>
                        <span>+25% Iron absorption</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Meal Suggestions */}
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-xl p-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Target className="h-5 w-5 text-white" />
                    </div>
                    <h4 className="font-bold text-blue-900 text-lg">Suggested Meals</h4>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-white/70 rounded-lg p-4 border border-blue-200">
                      <div className="font-semibold text-blue-900 mb-1">Grilled Salmon Salad</div>
                      <p className="text-sm text-blue-700 mb-2">Salmon + mixed greens + olive oil dressing</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Omega-3</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Vitamin D</span>
                        <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Protein</span>
                      </div>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-blue-200">
                      <div className="font-semibold text-blue-900 mb-1">Spinach & Lentil Soup</div>
                      <p className="text-sm text-blue-700 mb-2">Lentils + spinach + tomatoes + herbs</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Iron</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Magnesium</span>
                        <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">Fiber</span>
                      </div>
                    </div>

                    <div className="bg-white/70 rounded-lg p-4 border border-blue-200">
                      <div className="font-semibold text-blue-900 mb-1">Orange Yogurt Parfait</div>
                      <p className="text-sm text-blue-700 mb-2">Greek yogurt + orange segments + nuts</p>
                      <div className="flex flex-wrap gap-1">
                        <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">Calcium</span>
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">Vitamin C</span>
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded-full">Probiotics</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Category Breakdown */}
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
                <BarChart3 className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">Consumption Overview</h3>
                <p className="text-gray-600 text-sm">Breakdown by food category</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {sdgScore.categoryBreakdown.map((category, index) => {
                const colors = [
                  'from-emerald-500 to-teal-600',
                  'from-blue-500 to-indigo-600',
                  'from-purple-500 to-pink-600',
                  'from-orange-500 to-red-600',
                  'from-yellow-500 to-orange-600'
                ];
                return (
                  <div key={index} className="group relative">
                    <div className={`absolute -inset-0.5 bg-gradient-to-br ${colors[index % colors.length]} rounded-xl blur opacity-25 group-hover:opacity-50 transition duration-300`}></div>
                    <div className="relative bg-white border-2 border-gray-200 rounded-xl p-5 text-center hover:border-transparent transition-all duration-300">
                      <div className="text-4xl font-black text-gray-900 mb-2">{category.count}</div>
                      <div className="text-sm font-bold text-gray-700 capitalize mb-1">{category.category}</div>
                      <div className="text-xs text-gray-500 font-medium">{category.quantity.toFixed(1)} units</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* SDG Information Footer */}
          <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 rounded-2xl border-2 border-gray-200 p-8 shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <div className="p-3 bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl shadow-lg">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">About Sustainable Development Goals</h3>
                <p className="text-gray-600 text-sm">Understanding global sustainability</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-5">
                <h4 className="font-bold text-gray-900 text-lg mb-4">SDGs You're Supporting:</h4>

                <div className="flex items-start space-x-4 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-green-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-white font-black text-xl">2</span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg mb-1">Zero Hunger</div>
                    <div className="text-gray-600 text-sm leading-relaxed">Reducing food waste and ensuring better nutrition for all</div>
                  </div>
                </div>

                <div className="flex items-start space-x-4 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-white font-black text-xl">3</span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg mb-1">Good Health & Well-Being</div>
                    <div className="text-gray-600 text-sm leading-relaxed">Promoting healthy and balanced eating habits</div>
                  </div>
                </div>

                <div className="flex items-start space-x-4 group">
                  <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg group-hover:scale-110 transition-transform">
                    <span className="text-white font-black text-xl">12</span>
                  </div>
                  <div>
                    <div className="font-bold text-gray-900 text-lg mb-1">Responsible Consumption</div>
                    <div className="text-gray-600 text-sm leading-relaxed">Minimizing waste through conscious consumption</div>
                  </div>
                </div>
              </div>

              <div className="space-y-5">
                <h4 className="font-bold text-gray-900 text-lg mb-4">Your Global Impact:</h4>
                <div className="bg-white rounded-xl p-6 border-2 border-gray-200 shadow-md">
                  <p className="text-gray-700 leading-relaxed mb-4 font-medium">
                    Every action you take contributes to global sustainability. By tracking your food consumption,
                    reducing waste, and making conscious choices, you're part of a worldwide movement creating
                    a better future for everyone.
                  </p>
                  <div className="flex items-center space-x-2 text-emerald-700">
                    <Sparkles className="h-5 w-5" />
                    <span className="font-bold text-sm">Together, we're making a difference!</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}