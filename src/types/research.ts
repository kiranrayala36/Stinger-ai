export interface Author {
    name: string;
    id?: string;
}

export interface CodeRepository {
    repository_url: string;
    stars?: number;
    framework?: string;
    language?: string;
}

export interface PaperMetadata {
    source?: 'semantic_scholar' | 'papers_with_code';
    semanticScholarId?: string;
    authors: Author[];
    year?: number;
    venue?: string;
    citations?: number;
    codeRepository?: CodeRepository;
    analyzed?: boolean;
    analyzedAt?: string;
    insights?: string[];
    concepts?: Array<{
        concept: string;
        explanation: string;
        importance: 'High' | 'Medium' | 'Low';
    }>;
    difficulty?: {
        level: 'Beginner' | 'Intermediate' | 'Advanced';
        explanation: string;
        prerequisites: string[];
    };
    codeSnippets?: Array<{
        title: string;
        description: string;
        code: string;
        language: string;
    }>;
    implementationSteps?: string[];
}

export interface ResearchResult {
    id: string;
    title: string;
    abstract: string;
    pdf_url?: string;
    code_url?: string;
    metadata: PaperMetadata;
    query_id?: string;
    created_at?: string;
}

export interface ResearchQuery {
    id: string;
    user_id: string;
    query_text: string;
    created_at: string;
}

export interface UserInteraction {
    id: string;
    user_id: string;
    paper_id: string;
    interaction_type: string;
    created_at: string;
    question?: string;
    answer?: string;
}

export interface PDFHistory {
    id: string;
    fileName: string;
    summary: string;
    keyPoints: string[];
    uploadDate: string;
    fileSize: number;
} 