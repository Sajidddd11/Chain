-- Create nutrient_analysis_cache table for caching AI-generated nutrient analysis
CREATE TABLE IF NOT EXISTS nutrient_analysis_cache (
    id SERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Index for faster lookups
    CONSTRAINT unique_user_cache UNIQUE (user_id, created_at)
);

-- Create index on user_id and created_at for efficient cache retrieval
CREATE INDEX IF NOT EXISTS idx_nutrient_cache_user_date 
ON nutrient_analysis_cache(user_id, created_at DESC);

-- Add comment
COMMENT ON TABLE nutrient_analysis_cache IS 'Caches AI-generated nutrient gap analysis results for faster loading';
