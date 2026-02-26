-- Create research_queries table
CREATE TABLE research_queries (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    query_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create research_results table
CREATE TABLE research_results (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    query_id UUID REFERENCES research_queries(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    abstract TEXT,
    pdf_url TEXT,
    code_url TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create user_interactions table
CREATE TABLE user_interactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    paper_id UUID REFERENCES research_results(id) ON DELETE CASCADE,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create indexes for better query performance
CREATE INDEX idx_research_queries_user_id ON research_queries(user_id);
CREATE INDEX idx_research_results_query_id ON research_results(query_id);
CREATE INDEX idx_user_interactions_user_id ON user_interactions(user_id);
CREATE INDEX idx_user_interactions_paper_id ON user_interactions(paper_id);

-- Add RLS policies
ALTER TABLE research_queries ENABLE ROW LEVEL SECURITY;
ALTER TABLE research_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_interactions ENABLE ROW LEVEL SECURITY;

-- Policies for research_queries
CREATE POLICY "Users can view their own queries"
    ON research_queries FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queries"
    ON research_queries FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Policies for research_results
CREATE POLICY "Users can view results from their queries"
    ON research_results FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM research_queries
        WHERE research_queries.id = research_results.query_id
        AND research_queries.user_id = auth.uid()
    ));

-- Policies for user_interactions
CREATE POLICY "Users can view their own interactions"
    ON user_interactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own interactions"
    ON user_interactions FOR INSERT
    WITH CHECK (auth.uid() = user_id); 