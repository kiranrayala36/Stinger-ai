export interface GenerateAnswersParams {
    topic: string;
    questions: string[];
    length: 'Short' | 'Medium' | 'Long';
    style: 'Simple' | 'Professional' | 'Exam-style';
    instructions?: string;
}

export interface SaveAnswersParams {
    topic: string;
    questions: Array<{
        question: string;
        answer: string;
    }>;
    length: 'Short' | 'Medium' | 'Long';
    style: 'Simple' | 'Professional' | 'Exam-style';
}

export interface AssignmentService {
    generateAnswers(params: GenerateAnswersParams): Promise<{ [key: string]: string }>;
    saveAnswers(params: SaveAnswersParams): Promise<void>;
    getSavedAnswers(): Promise<Array<{
        id: string;
        topic: string;
        questions: Array<{
            question: string;
            answer: string;
        }>;
        length: string;
        style: string;
        created_at: string;
    }>>;
    deleteSavedAnswer(id: string): Promise<void>;
}

export const assignmentService: AssignmentService; 