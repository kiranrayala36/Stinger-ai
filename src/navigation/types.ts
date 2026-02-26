import { ResearchResult } from '../types/research';

export type RootStackParamList = {
  Home: undefined;
  Tasks: undefined;
  Notes: undefined;
  Profile: undefined;
  AIChat: { sessionId?: string };
  ChatHistory: undefined;
  ViewTask: { taskId: string };
  EditTask: { taskId: string };
  Trash: undefined;
  ResearchSearch: undefined;
  ResearchDetail: { paperId: string; paperData: ResearchResult };
  Bookmarks: undefined;
  PDFHistory: undefined;
}; 