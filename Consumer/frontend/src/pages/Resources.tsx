import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { RecipeCard } from '../components/RecipeCard';
import type { RecommendedResource, Resource } from '../types';
import {
  ChefHat,
  Sparkles,
  Search,
  Loader2,
  BookOpen,
  Star,
  ExternalLink,
  Package,
  Clock,
  Users,
  X,
  Camera,
  Wand2,
  ArrowRight,
  Utensils,
  Mic,
  MicOff
} from 'lucide-react';

// Type declarations for Speech Recognition API
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}



type RecipeSuggestion = {
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    priority: 'expiring-soon' | 'expiring-week' | 'fresh';
    expiryDays: number;
  }>;
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  calories?: number;
};

export function Resources() {
  const { token } = useAuth();
  const [allResources, setAllResources] = useState<Resource[]>([]);
  const [recommended, setRecommended] = useState<RecommendedResource[]>([]);
  const [loading, setLoading] = useState(true);
  const [inventoryCount, setInventoryCount] = useState<number | null>(null);

  // Inventory-based recipes
  const [inventoryRecipes, setInventoryRecipes] = useState<RecipeSuggestion[]>([]);
  const [generatingInventory, setGeneratingInventory] = useState(false);
  const [inventoryError, setInventoryError] = useState<string | null>(null);
  const [forceRegenerateInventory, setForceRegenerateInventory] = useState(false);

  // Custom recipe search
  const [customQuery, setCustomQuery] = useState('');
  const [customRecipes, setCustomRecipes] = useState<RecipeSuggestion[]>([]);
  const [generatingCustom, setGeneratingCustom] = useState(false);
  const [customError, setCustomError] = useState<string | null>(null);

  const [selectedCuisine, setSelectedCuisine] = useState<string>('All');

  // Transformer State
  const [transformerInput, setTransformerInput] = useState('');
  const [transformerLoading, setTransformerLoading] = useState(false);
  const [transformerResults, setTransformerResults] = useState<RecipeSuggestion[] | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isListeningTransformer, setIsListeningTransformer] = useState(false);
  const [isListeningCustom, setIsListeningCustom] = useState(false);
  // Speech synthesis state (voice selection for TTS)
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
  const [speechRate] = useState<number>(1);
  const [speechPitch] = useState<number>(1);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const imageUrl = URL.createObjectURL(file);
      setSelectedImage(imageUrl);
      setTransformerInput("Analyzing photo...");
      setTransformerLoading(true);

      if (!token) {
        // Fallback for demo if no token
        setTimeout(() => {
          setTransformerInput("Roasted Chicken, Vegetables, Rice");
          setTransformerLoading(false);
          handleTransformLeftovers("Roasted Chicken, Vegetables, Rice");
        }, 2000);
        return;
      }

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await api.scanLeftovers(token, formData);

        if (response.ingredients) {
          setTransformerInput(response.ingredients);
          handleTransformLeftovers(response.ingredients);
        } else {
          setTransformerInput("Could not identify items.");
          setTransformerLoading(false);
        }
      } catch (error) {
        console.error("Scan error:", error);
        setTransformerInput("Error scanning photo.");
        setTransformerLoading(false);
      }
    }
  };

  const triggerFileUpload = () => {
    fileInputRef.current?.click();
  };

  const handleTransformLeftovers = async (overrideInput?: string) => {
    const inputToUse = typeof overrideInput === 'string' ? overrideInput : transformerInput;
    if (!inputToUse.trim() || inputToUse === "Analyzing photo...") return;

    setTransformerLoading(true);

    if (!token) {
      // Fallback mock for demo if not logged in
      await new Promise(r => setTimeout(r, 1500));
      // ... (keep simple mock or just return empty)
      setTransformerLoading(false);
      return;
    }

    try {
      const response = await api.getRecipeSuggestions(token, {
        query: inputToUse,
        cuisine: selectedCuisine === 'All' ? undefined : selectedCuisine
      });

      if (response.suggestions) {
        setTransformerResults(response.suggestions);
      }
    } catch (error) {
      console.error("Transform error:", error);
    } finally {
      setTransformerLoading(false);
    }
  };

  // Modal state for recipe details
  const [selectedRecipe, setSelectedRecipe] = useState<RecipeSuggestion | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openRecipeModal = (recipe: RecipeSuggestion) => {
    setSelectedRecipe(recipe);
    setIsModalOpen(true);
  };

  const closeRecipeModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedRecipe(null), 300);
  };

  useEffect(() => {
    const fetchResources = async () => {
      try {
        setLoading(true);
        const resourcesResponse = await api.getResources();
        setAllResources(resourcesResponse.resources);

        if (token) {
          try {
            const recommendedResponse = await api.getRecommendedResources(token);
            setRecommended(recommendedResponse.recommendations);
          } catch (err) {
            console.error('Failed to fetch recommendations:', err);
          }

          try {
            const inventoryResponse = await api.getInventory(token);
            setInventoryCount(inventoryResponse.items?.length || 0);
          } catch (err) {
            console.error('Failed to fetch inventory count:', err);
          }
        }
      } catch (err) {
        console.error('Failed to load resources:', err);
      } finally {
        setLoading(false);
      }
    };

    const loadVoices = () => {
      if (!('speechSynthesis' in window)) return;
      const available = window.speechSynthesis.getVoices() || [];
      setVoices(available);
      if (!selectedVoiceURI && available.length > 0) {
        setSelectedVoiceURI(available[0].voiceURI);
      }
    };

    fetchResources();
    loadVoices();

    if ('speechSynthesis' in window) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, [token]);

  // Load custom query from localStorage on component mount
  useEffect(() => {
    const savedCustomQuery = localStorage.getItem('customSearchQuery');
    if (savedCustomQuery) {
      setCustomQuery(savedCustomQuery);
    }

    // Load cached custom recipes on mount
    const savedCustomRecipes = localStorage.getItem('lastCustomRecipes');
    const savedCustomRecipesTimestamp = localStorage.getItem('lastCustomRecipes_timestamp');
    
    if (savedCustomRecipes && savedCustomRecipesTimestamp) {
      try {
        const parsedRecipes = JSON.parse(savedCustomRecipes);
        const cacheAge = Date.now() - parseInt(savedCustomRecipesTimestamp);
        
        // Use cache if it's less than 24 hours old
        if (Array.isArray(parsedRecipes) && parsedRecipes.length > 0 && cacheAge < 24 * 60 * 60 * 1000) {
          console.log('Loading previous custom search results from cache');
          setCustomRecipes(parsedRecipes);
        } else {
          // Clear expired cache
          localStorage.removeItem('lastCustomRecipes');
          localStorage.removeItem('lastCustomRecipes_timestamp');
        }
      } catch (e) {
        console.error('Error parsing cached custom recipes', e);
        localStorage.removeItem('lastCustomRecipes');
        localStorage.removeItem('lastCustomRecipes_timestamp');
      }
    }
  }, []);

  // Save custom query to localStorage whenever it changes
  useEffect(() => {
    if (customQuery.trim()) {
      localStorage.setItem('customSearchQuery', customQuery);
    }
  }, [customQuery]);

  const generateInventoryRecipes = useCallback(async () => {
    if (!token) {
      setInventoryError('Please log in to generate recipes');
      return;
    }

    // Check cache first - only use cache if we haven't generated new recipes yet
    const cacheKey = `cachedInventoryRecipes_${selectedCuisine}`;
    const cachedRecipes = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    
    // Only use cache if it exists and we haven't explicitly requested regeneration
    if (cachedRecipes && cacheTimestamp && !forceRegenerateInventory) {
      try {
        const parsedRecipes = JSON.parse(cachedRecipes);
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        
        // Use cache if it's less than 24 hours old and we have recipes
        if (Array.isArray(parsedRecipes) && parsedRecipes.length > 0 && cacheAge < 24 * 60 * 60 * 1000) {
          console.log('Using cached inventory recipes');
          setInventoryRecipes(parsedRecipes);
          return;
        }
      } catch (e) {
        console.error('Error parsing cached recipes', e);
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_timestamp`);
      }
    }

    setGeneratingInventory(true);
    setInventoryError(null);
    setForceRegenerateInventory(false);

    try {
      const response = await api.getRecipeSuggestions(token, {
        query: '',
        cuisine: selectedCuisine === 'All' ? undefined : selectedCuisine
      });

      if (!response.suggestions || response.suggestions.length === 0) {
        setInventoryError('No recipes found. Make sure you have items in your pantry with expiry dates set.');
        return;
      }

      // Cache the new recipes with timestamp
      localStorage.setItem(cacheKey, JSON.stringify(response.suggestions));
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());

      setInventoryRecipes(response.suggestions);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate recipes';
      setInventoryError(errorMsg);
      console.error('Inventory recipe generation error:', err);
    } finally {
      setGeneratingInventory(false);
    }
  }, [token, selectedCuisine, forceRegenerateInventory]);

  const generateCustomRecipes = async () => {
    if (!token) {
      setCustomError('Please log in to generate recipes');
      return;
    }

    if (!customQuery.trim()) {
      setCustomError('Please enter ingredients or a dish name');
      return;
    }

    // Check cache first for custom recipes
    const cacheKey = `cachedCustomRecipes_${customQuery.trim().toLowerCase()}_${selectedCuisine}`;
    const cachedRecipes = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    
    // Only use cache if it exists and is recent (24 hours)
    if (cachedRecipes && cacheTimestamp) {
      try {
        const parsedRecipes = JSON.parse(cachedRecipes);
        const cacheAge = Date.now() - parseInt(cacheTimestamp);
        
        if (Array.isArray(parsedRecipes) && parsedRecipes.length > 0 && cacheAge < 24 * 60 * 60 * 1000) {
          console.log('Using cached custom recipes');
          setCustomRecipes(parsedRecipes);
          
          // Also save as the last custom recipes for persistence
          localStorage.setItem('lastCustomRecipes', JSON.stringify(parsedRecipes));
          localStorage.setItem('lastCustomRecipes_timestamp', Date.now().toString());
          return;
        }
      } catch (e) {
        console.error('Error parsing cached custom recipes', e);
        localStorage.removeItem(cacheKey);
        localStorage.removeItem(`${cacheKey}_timestamp`);
      }
    }

    setGeneratingCustom(true);
    setCustomError(null);

    try {
      const response = await api.getRecipeSuggestions(token, {
        query: customQuery.trim(),
        cuisine: selectedCuisine === 'All' ? undefined : selectedCuisine
      });

      if (!response.suggestions || response.suggestions.length === 0) {
        setCustomError('No recipes found. Try different ingredients.');
        return;
      }

      // Cache the new recipes with timestamp
      localStorage.setItem(cacheKey, JSON.stringify(response.suggestions));
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());

      // Also save as the last custom recipes for persistence across page loads
      localStorage.setItem('lastCustomRecipes', JSON.stringify(response.suggestions));
      localStorage.setItem('lastCustomRecipes_timestamp', Date.now().toString());

      setCustomRecipes(response.suggestions);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to generate recipes';
      setCustomError(errorMsg);
      console.error('Custom recipe generation error:', err);
    } finally {
      setGeneratingCustom(false);
    }
  };

  // Voice input functions
  const startVoiceInput = async (type: 'transformer' | 'custom') => {
    // Check if running on HTTPS (required for Web Speech API)
    if (window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
      console.warn('Voice input requires HTTPS. Running on HTTP may cause issues.');
      return;
    }

    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      console.warn('Voice input is not supported in this browser. Please use Chrome, Edge, or Safari.');
      return;
    }

    // Request microphone access explicitly
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately, we just needed permission
      stream.getTracks().forEach(track => track.stop());
    } catch (err) {
      console.warn('Microphone access denied or not available:', err);
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();

    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    // Set a timeout to stop listening after 5 seconds of silence
    let timeoutId: number | undefined;
    const resetTimeout = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.log('Speech recognition timeout - stopping');
        recognition.stop();
      }, 5000);
    };

    recognition.onstart = () => {
      console.log('Speech recognition started');
      resetTimeout();
      if (type === 'transformer') {
        setIsListeningTransformer(true);
      } else {
        setIsListeningCustom(true);
      }
    };

    recognition.onresult = (event: any) => {
      console.log('Speech recognition result:', event);
      const transcript = event.results[0][0].transcript;
      console.log('Transcript:', transcript);
      resetTimeout(); // Reset timeout on result
      if (type === 'transformer') {
        setTransformerInput(transcript);
      } else {
        setCustomQuery(transcript);
      }
    };

    recognition.onerror = (event: any) => {
      if (timeoutId) clearTimeout(timeoutId);

      console.error('Speech recognition error:', event.error);

      // Reset listening state on error (no user-facing error messages)
      if (type === 'transformer') {
        setIsListeningTransformer(false);
      } else {
        setIsListeningCustom(false);
      }
    };

    recognition.onend = () => {
      console.log('Speech recognition ended');
      if (timeoutId) clearTimeout(timeoutId);
      if (type === 'transformer') {
        setIsListeningTransformer(false);
      } else {
        setIsListeningCustom(false);
      }
    };

    try {
      console.log('Starting speech recognition...');
      recognition.start();
    } catch (err) {
      console.error('Failed to start speech recognition:', err);
      if (timeoutId) clearTimeout(timeoutId);
      if (type === 'transformer') {
        setIsListeningTransformer(false);
      } else {
        setIsListeningCustom(false);
      }
    }
  };

  const stopVoiceInput = (type: 'transformer' | 'custom') => {
    // Note: We can't directly stop the recognition from here since it's created in startVoiceInput
    // The recognition will stop automatically via timeout or when the user stops speaking
    // We just update the UI state
    if (type === 'transformer') {
      setIsListeningTransformer(false);
    } else {
      setIsListeningCustom(false);
    }
  };

  // Text-to-speech helper
  const speakText = (text: string) => {
    if (!text) return;
    if (!('speechSynthesis' in window)) {
      console.warn('Text-to-speech is not supported in this browser.');
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(text);
      const voice = voices.find(v => v.voiceURI === selectedVoiceURI) || voices[0] || null;
      if (voice) utter.voice = voice;
      utter.rate = speechRate;
      utter.pitch = speechPitch;
      window.speechSynthesis.speak(utter);
    } catch (err) {
      console.error('TTS error', err);
    }
  };

  return (
    <div className="resources-page-modern">
      <div className="page-header-modern">
        <div>
          <h2>Recipe Generator & Resources</h2>
          <p className="subtitle">AI-powered recipe suggestions and sustainable living tips</p>
        </div>
        <div className="header-stats">
          <div className="stat-pill">
            <span className="stat-value">{inventoryRecipes.length + customRecipes.length}</span>
            <span className="stat-label">Recipes</span>
          </div>
          {inventoryCount !== null && (
            <div className="stat-pill">
              <span className="stat-value">{inventoryCount}</span>
              <span className="stat-label">Pantry Items</span>
            </div>
          )}
        </div>
      </div>

      {/* AI Leftover Transformer Section */}
      <div className="transformer-section">
        <div className="transformer-header">
          <h2 className="transformer-title">
            <Wand2 size={32} /> AI Leftover Transformer
          </h2>
          <p className="transformer-subtitle">
            Upload a photo or list your leftovers, and our AI will magically transform them into delicious new recipes.
          </p>
        </div>

        <div className="transformer-input-area">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageUpload}
            accept="image/*"
            style={{ display: 'none' }}
          />

          <button
            className="photo-upload-btn"
            title="Upload Photo"
            onClick={triggerFileUpload}
          >
            {selectedImage ? (
              <img src={selectedImage} alt="Selected" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
            ) : (
              <Camera size={20} />
            )}
          </button>

          <div className="input-with-voice">
            <input
              type="text"
              className="transformer-input"
              placeholder="e.g., leftover rice, roasted chicken..."
              value={transformerInput}
              onChange={(e) => setTransformerInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTransformLeftovers()}
            />
            <button
              className={`voice-btn ${isListeningTransformer ? 'listening' : ''}`}
              onClick={() => {
                if (isListeningTransformer) {
                  stopVoiceInput('transformer');
                } else {
                  startVoiceInput('transformer');
                }
              }}
              title={isListeningTransformer ? 'Stop voice input' : 'Start voice input (requires HTTPS and internet)'}
            >
              {isListeningTransformer ? <MicOff size={18} /> : <Mic size={18} />}
            </button>
          </div>

          <button
            className="transformer-btn"
            onClick={() => handleTransformLeftovers()}
            disabled={transformerLoading || (!transformerInput.trim() && !selectedImage)}
          >
            {transformerLoading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <Sparkles size={18} />
            )}
            <span style={{ marginLeft: '0.5rem' }}>{transformerLoading ? 'Analyzing...' : 'Transform'}</span>
          </button>
        </div>

        {transformerResults && (
          <div className="transformer-results">
            {transformerResults.map((result, index) => (
              <div key={index} className="suggestion-card">
                <span className="suggestion-icon">
                  <Utensils size={24} color="#1f7a4d" />
                </span>
                <h3 className="suggestion-title">{result.title}</h3>
                <p className="suggestion-desc">{result.description}</p>
                <div className="suggestion-meta">
                  <span className="meta-tag">
                    <Clock size={14} /> {result.cookTime} min
                  </span>
                  <span className="meta-tag">
                    <ChefHat size={14} /> {result.difficulty}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button
                    className="suggestion-action"
                    onClick={() => openRecipeModal(result)}
                  >
                    View Details <ArrowRight size={16} />
                  </button>
                  <button
                    className="suggestion-action"
                    onClick={() => speakText(`${result.title}. ${result.description}. Takes ${result.cookTime} minutes. Difficulty ${result.difficulty}.`) }
                  >
                    Speak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="desktop-grid-layout">
        {/* Inventory-Based Recipe Section */}
        <div className="recipe-section-modern compact-section">
          <div className="section-header-modern compact-header">
            <div className="section-icon-wrapper compact-icon">
              <ChefHat size={24} color="#1f7a4d" />
            </div>
            <div className="section-text">
              <h3>Smart Suggestions</h3>
              <p className="section-subtitle">
                Recipes from your pantry items
              </p>
            </div>
          </div>

          <div className="cuisine-filter-modern compact-filter">
            <label className="filter-label">
              <Sparkles size={14} className="inline-icon" />
              Cuisine
            </label>
            <div className="cuisine-pills compact-pills">
              {[
                'All',
                'Italian',
                'Indian',
                'Asian',
                'Mexican',
                'Mediterranean',
                'American',
                'Bangladeshi'
              ].map((cuisine) => (
                <button
                  key={cuisine}
                  onClick={() => setSelectedCuisine(cuisine)}
                  className={`cuisine-pill ${selectedCuisine === cuisine ? 'active' : ''}`}
                >
                  {cuisine}
                </button>
              ))}
            </div>
          </div>

          <div className="action-row-modern compact-action">
            <button
              className="primary-btn-modern full-width-btn"
              onClick={generateInventoryRecipes}
              disabled={generatingInventory || !token}
            >
              {generatingInventory ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <ChefHat size={18} />
                  Generate Recipes
                </>
              )}
            </button>
          </div>

          {inventoryCount === 0 && token && (
            <div className="warning-badge compact-badge">
              <Package size={14} />
              Add items first
            </div>
          )}

          {inventoryError && (
            <div className="error-message-modern compact-error">
              {inventoryError}
            </div>
          )}

          {generatingInventory && (
            <div className="recipe-loading-container">
              <div className="recipe-loading-progress-bar">
                <div className="recipe-loading-progress-fill"></div>
              </div>
              <div className="recipe-loading-skeleton-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="recipe-loading-skeleton">
                    <div className="recipe-loading-skeleton-image"></div>
                    <div className="recipe-loading-skeleton-content">
                      <div className="recipe-loading-skeleton-title"></div>
                      <div className="recipe-loading-skeleton-text"></div>
                      <div className="recipe-loading-skeleton-text short"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {inventoryRecipes.length > 0 && (
            <div className="recipes-preview-grid">
              {inventoryRecipes.map((recipe, index) => (
                <div
                  key={index}
                  className="recipe-preview-card"
                  onClick={() => openRecipeModal(recipe)}
                >
                  <div className="recipe-preview-header">
                    <h4>{recipe.title}</h4>
                    <span className="difficulty-badge">{recipe.difficulty}</span>
                  </div>
                  <div className="recipe-preview-meta">
                    <span><Clock size={14} /> {recipe.prepTime + recipe.cookTime} min</span>
                    <span><Users size={14} /> {recipe.servings}</span>
                  </div>
                  <p className="recipe-preview-desc">{recipe.description}</p>
                  <div className="recipe-preview-details">
                    <div className="detail-pill">
                      <Package size={12} />
                      <span>{recipe.ingredients.length} ingredients</span>
                    </div>
                    <div className="detail-pill">
                      <BookOpen size={12} />
                      <span>{recipe.instructions.length} steps</span>
                    </div>
                  </div>
                  <div className="recipe-preview-footer">
                    <span className="view-details">View Full Recipe</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Custom Recipe Search Section */}
        <div className="recipe-section-modern compact-section">
          <div className="section-header-modern compact-header">
            <div className="section-icon-wrapper compact-icon">
              <Search size={24} color="#1f7a4d" />
            </div>
            <div className="section-text">
              <h3>Custom Search</h3>
              <p className="section-subtitle">
                Find specific recipes
              </p>
            </div>
          </div>

          <div className="search-container-modern compact-search-container">
            <div className="search-input-wrapper" style={{ display: 'flex', alignItems: 'center', flex: 1, position: 'relative' }}>
              <Search size={18} className="search-icon" />
              <input
                type="text"
                placeholder='e.g., "pasta"'
                value={customQuery}
                onChange={(e) => setCustomQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && !generatingCustom) {
                    generateCustomRecipes();
                  }
                }}
                className="modern-input search-input-large compact-input"
                style={{ paddingRight: '3rem' }}
              />
              <button
                className={`voice-btn ${isListeningCustom ? 'listening' : ''}`}
                onClick={() => {
                  if (isListeningCustom) {
                    stopVoiceInput('custom');
                  } else {
                    startVoiceInput('custom');
                  }
                }}
                title={isListeningCustom ? 'Stop voice input' : 'Start voice input'}
                style={{ position: 'absolute', right: '0.5rem' }}
              >
                {isListeningCustom ? <MicOff size={18} /> : <Mic size={18} />}
              </button>
            </div>
            <button
              className="primary-btn-modern compact-search-btn"
              onClick={generateCustomRecipes}
              disabled={generatingCustom || !customQuery.trim() || !token}
            >
              {generatingCustom ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Search size={18} />
              )}
            </button>
          </div>

          {customError && (
            <div className="error-message-modern compact-error">
              {customError}
            </div>
          )}

          {generatingCustom && (
            <div className="recipe-loading-container">
              <div className="recipe-loading-progress-bar">
                <div className="recipe-loading-progress-fill"></div>
              </div>
              <div className="recipe-loading-skeleton-grid">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="recipe-loading-skeleton">
                    <div className="recipe-loading-skeleton-image"></div>
                    <div className="recipe-loading-skeleton-content">
                      <div className="recipe-loading-skeleton-title"></div>
                      <div className="recipe-loading-skeleton-text"></div>
                      <div className="recipe-loading-skeleton-text short"></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {customRecipes.length > 0 && (
            <div className="recipes-preview-grid">
              {customRecipes.map((recipe, index) => (
                <div
                  key={index}
                  className="recipe-preview-card"
                  onClick={() => openRecipeModal(recipe)}
                >
                  <div className="recipe-preview-header">
                    <h4>{recipe.title}</h4>
                    <span className="difficulty-badge">{recipe.difficulty}</span>
                  </div>
                  <div className="recipe-preview-meta">
                    <span><Clock size={14} /> {recipe.prepTime + recipe.cookTime} min</span>
                    <span><Users size={14} /> {recipe.servings}</span>
                  </div>
                  <p className="recipe-preview-desc">{recipe.description}</p>
                  <div className="recipe-preview-details">
                    <div className="detail-pill">
                      <Package size={12} />
                      <span>{recipe.ingredients.length} ingredients</span>
                    </div>
                    <div className="detail-pill">
                      <BookOpen size={12} />
                      <span>{recipe.instructions.length} steps</span>
                    </div>
                  </div>
                  <div className="recipe-preview-footer">
                    <span className="view-details">View Full Recipe</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recommended Resources */}
      {token && recommended.length > 0 && (
        <div className="resources-section-modern">
          <div className="section-header-modern">
            <div className="section-icon-wrapper">
              <Star size={32} color="#1f7a4d" />
            </div>
            <div className="section-text">
              <h3>Recommended for You</h3>
              <p className="section-subtitle">Personalized resources based on your inventory</p>
            </div>
          </div>
          <div className="resources-grid-modern">
            {recommended.map((resource) => (
              <div key={resource.id} className="resource-card-modern">
                <div className="resource-header-modern">
                  <h4>{resource.title}</h4>
                  <div className="resource-badges-modern">
                    <span className="resource-badge-modern category">{resource.category}</span>
                    <span className="resource-badge-modern type">{resource.resource_type}</span>
                  </div>
                </div>
                <p className="resource-description-modern">{resource.description}</p>
                {resource.reason && (
                  <div className="resource-reason-modern">
                    <Sparkles size={14} />
                    <span>{resource.reason}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All Resources */}
      <div className="resources-section-modern">
        <div className="section-header-modern">
          <div className="section-icon-wrapper">
            <BookOpen size={32} color="#1f7a4d" />
          </div>
          <div className="section-text">
            <h3>Sustainable Living Tips</h3>
            <p className="section-subtitle">Expert advice for reducing waste and living sustainably</p>
          </div>
        </div>
        {loading ? (
          <div className="loading-state-modern">
            <Loader2 size={48} className="animate-spin" color="#1f7a4d" />
            <p>Loading resources...</p>
          </div>
        ) : (
          <div className="resources-grid-modern">
            {allResources.map((resource) => (
              <div key={resource.id} className="resource-card-modern">
                <div className="resource-header-modern">
                  <h4>{resource.title}</h4>
                  <div className="resource-badges-modern">
                    <span className="resource-badge-modern category">{resource.category}</span>
                    <span className="resource-badge-modern type">{resource.resource_type}</span>
                  </div>
                </div>
                <p className="resource-description-modern">{resource.description}</p>
                {resource.url && (
                  <a href={resource.url} target="_blank" rel="noreferrer" className="resource-link-modern">
                    <span>View Resource</span>
                    <ExternalLink size={16} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recipe Details Modal */}
      {isModalOpen && selectedRecipe && (
        <div className="recipe-modal-overlay" onClick={closeRecipeModal}>
          <div className="recipe-modal-content" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close-btn" onClick={closeRecipeModal}>
              <X size={24} />
            </button>
            <RecipeCard recipe={selectedRecipe} onSpeak={speakText} />
          </div>
        </div>
      )}
    </div>
  );
}
