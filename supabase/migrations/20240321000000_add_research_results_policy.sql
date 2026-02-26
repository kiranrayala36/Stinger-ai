-- Add insert policy for research_results
CREATE POLICY "Users can insert results for their queries"
    ON research_results FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM research_queries
        WHERE research_queries.id = research_results.query_id
        AND research_queries.user_id = auth.uid()
    )); 