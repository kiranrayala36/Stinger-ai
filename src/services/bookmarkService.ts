import AsyncStorage from '@react-native-async-storage/async-storage';
import { ResearchResult } from '../types/research';

const BOOKMARKS_KEY = '@stingerai_bookmarks';
const INIT_RETRY_DELAY = 1000;
const MAX_INIT_RETRIES = 3;

export interface BookmarkedPaper extends ResearchResult {
    bookmarkedAt: string;
}

class BookmarkService {
    private bookmarks: BookmarkedPaper[] = [];
    private initialized: boolean = false;
    private initializationPromise: Promise<void> | null = null;

    async initialize() {
        if (this.initialized) return;
        
        // If initialization is already in progress, wait for it
        if (this.initializationPromise) {
            await this.initializationPromise;
            return;
        }

        let retries = 0;
        const initializeWithRetry = async (): Promise<void> => {
            try {
                const storedBookmarks = await AsyncStorage.getItem(BOOKMARKS_KEY);
                if (storedBookmarks) {
                    this.bookmarks = JSON.parse(storedBookmarks);
                }
                this.initialized = true;
            } catch (error) {
                console.error('Error initializing bookmarks:', error);
                if (retries < MAX_INIT_RETRIES) {
                    retries++;
                    await new Promise(resolve => setTimeout(resolve, INIT_RETRY_DELAY * retries));
                    return initializeWithRetry();
                }
                throw error;
            }
        };

        this.initializationPromise = initializeWithRetry();
        await this.initializationPromise;
        this.initializationPromise = null;
    }

    private async ensureInitialized() {
        if (!this.initialized) {
            await this.initialize();
        }
    }

    async toggleBookmark(paper: ResearchResult): Promise<boolean> {
        await this.ensureInitialized();
        
        try {
            const isBookmarked = this.bookmarks.some(b => b.id === paper.id);
            
            if (isBookmarked) {
                this.bookmarks = this.bookmarks.filter(b => b.id !== paper.id);
            } else {
                const bookmarkedPaper: BookmarkedPaper = {
                    ...paper,
                    bookmarkedAt: new Date().toISOString()
                };
                this.bookmarks.push(bookmarkedPaper);
            }

            await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(this.bookmarks));
            return !isBookmarked;
        } catch (error) {
            console.error('Error toggling bookmark:', error);
            // Retry once on failure
            try {
                await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(this.bookmarks));
                return !this.bookmarks.some(b => b.id === paper.id);
            } catch (retryError) {
                console.error('Error in retry toggle bookmark:', retryError);
                return false;
            }
        }
    }

    async isBookmarked(paperId: string): Promise<boolean> {
        await this.ensureInitialized();
        return this.bookmarks.some(b => b.id === paperId);
    }

    async getBookmarks(): Promise<BookmarkedPaper[]> {
        await this.ensureInitialized();
        return [...this.bookmarks]; // Return a copy to prevent external modifications
    }

    async removeBookmark(paperId: string): Promise<void> {
        await this.ensureInitialized();
        
        try {
            this.bookmarks = this.bookmarks.filter(b => b.id !== paperId);
            await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(this.bookmarks));
        } catch (error) {
            console.error('Error removing bookmark:', error);
            // Retry once on failure
            try {
                await AsyncStorage.setItem(BOOKMARKS_KEY, JSON.stringify(this.bookmarks));
            } catch (retryError) {
                console.error('Error in retry remove bookmark:', retryError);
                throw retryError;
            }
        }
    }
}

export const bookmarkService = new BookmarkService(); 