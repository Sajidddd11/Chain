type RecipeSuggestion = {
  title: string;
  description: string;
  ingredients: Array<{
    name: string;
    quantity: number;
    unit: string;
    priority?: 'expiring-soon' | 'expiring-week' | 'fresh';
    expiryDays?: number;
    availability?: 'available' | 'not available';
  }>;
  instructions: string[];
  prepTime: number;
  cookTime: number;
  servings: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
};

interface RecipeCardProps {
  recipe: RecipeSuggestion;
  onSpeak?: (text: string) => void;
}

export function RecipeCard({ recipe, onSpeak }: RecipeCardProps) {
  const getPriorityLabel = (ingredient: any) => {
    // If availability is present (user query mode), use that
    if (ingredient.availability) {
      return ingredient.availability === 'available' ? 'Available' : 'Not Available';
    }
    // Otherwise use priority (pantry mode)
    switch (ingredient.priority) {
      case 'expiring-soon': return 'Use Soon';
      case 'expiring-week': return 'Use This Week';
      case 'fresh': return 'Fresh';
      default: return 'Available';
    }
  };

  const getPriorityColor = (ingredient: any) => {
    // If availability is present (user query mode), use that
    if (ingredient.availability) {
      return ingredient.availability === 'available' ? '#27ae60' : '#e74c3c';
    }
    // Otherwise use priority (pantry mode)
    switch (ingredient.priority) {
      case 'expiring-soon': return '#e74c3c';
      case 'expiring-week': return '#f39c12';
      case 'fresh': return '#27ae60';
      default: return '#95a5a6';
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty.toLowerCase()) {
      case 'easy': return '#27ae60';
      case 'medium': return '#f39c12';
      case 'hard': return '#e74c3c';
      default: return '#95a5a6';
    }
  };

  const totalTime = recipe.prepTime + recipe.cookTime;

  return (
    <div className="recipe-card-modern">
      <div className="recipe-card-header-modern">
        <div className="recipe-title-section-modern">
          <h3 className="recipe-title-modern">{recipe.title}</h3>
          <div style={{ marginTop: 8 }}>
            <button
              className="primary-btn-modern"
              onClick={() => {
                const textParts: string[] = [];
                textParts.push(`${recipe.title}.`);
                if (recipe.description) textParts.push(recipe.description + '.');
                if (recipe.ingredients && recipe.ingredients.length > 0) {
                  textParts.push('Ingredients: ' + recipe.ingredients.map(i => `${i.quantity} ${i.unit} ${i.name}`).join(', ') + '.');
                }
                if (recipe.instructions && recipe.instructions.length > 0) {
                  textParts.push('Instructions: ' + recipe.instructions.join('. ') + '.');
                }
                const full = textParts.join(' ');
                if (typeof onSpeak === 'function') {
                  onSpeak(full);
                } else if ('speechSynthesis' in window) {
                  // fallback local speak
                  const utter = new SpeechSynthesisUtterance(full);
                  window.speechSynthesis.cancel();
                  window.speechSynthesis.speak(utter);
                }
              }}
            >
              Speak
            </button>
          </div>
          <div className="recipe-meta-modern">
            <div className="recipe-meta-item">
              <div className="meta-icon time-icon"></div>
              <span className="meta-text">{totalTime} min</span>
            </div>
            <div className="recipe-meta-item">
              <div className="meta-icon servings-icon"></div>
              <span className="meta-text">{recipe.servings} servings</span>
            </div>
            <div className="recipe-meta-item">
              <div
                className="meta-icon difficulty-icon"
                style={{ backgroundColor: getDifficultyColor(recipe.difficulty) }}
              ></div>
              <span className="meta-text">{recipe.difficulty}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="recipe-content-modern">
        <p className="recipe-description-modern">{recipe.description}</p>

        <div className="recipe-section-modern">
          <h4 className="section-title-modern">Ingredients</h4>
          <div className="ingredients-grid-modern">
            {recipe.ingredients.map((ingredient, index) => (
              <div key={index} className="ingredient-item-modern">
                <div className="ingredient-info-modern">
                  <span className="ingredient-name-modern">{ingredient.name}</span>
                  <span className="ingredient-quantity-modern">
                    {ingredient.quantity} {ingredient.unit}
                  </span>
                </div>
                <div
                  className="priority-indicator-modern"
                  style={{ backgroundColor: getPriorityColor(ingredient) }}
                >
                  {getPriorityLabel(ingredient)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="recipe-section-modern">
          <h4 className="section-title-modern">Instructions</h4>
          <ol className="instructions-list-modern">
            {recipe.instructions.map((instruction, index) => (
              <li key={index} className="instruction-step-modern">
                <span className="step-number-modern">{index + 1}</span>
                <span className="step-text-modern">{instruction}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}