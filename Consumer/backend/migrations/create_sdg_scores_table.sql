-- Create SDG scores table
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; -- ensure UUID support

CREATE TABLE IF NOT EXISTS sdg_scores (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  waste_score DECIMAL(5,2) NOT NULL,
  nutrition_score DECIMAL(5,2) NOT NULL,
  inventory_score DECIMAL(5,2) NOT NULL,
  insights JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_sdg_scores_user_id ON sdg_scores(user_id);
CREATE INDEX IF NOT EXISTS idx_sdg_scores_created_at ON sdg_scores(created_at);
