import AsyncStorage from '@react-native-async-storage/async-storage';
import { handleError, AppError } from '../utils/errorHandler';

export interface ChecklistItem {
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;
  title: string;
  content?: string; // Only for plain notes
  type: 'plain' | 'checklist';
  checklist?: ChecklistItem[]; // Only for checklist notes
  date: string;
  color: string;
  category: string;
  tags: string[];
  isArchived: boolean;
  isTemplate: boolean;
  lastModified: string;
  sharedWith?: string[];
  isTrashed?: boolean;
  createdAt: string;
  updatedAt: string;
  isPinned: boolean;
  isDeleted: boolean;
  attachments: string[];
  userId: string;
}

const NOTES_STORAGE_KEY = '@stingerai_notes';
const TEMPLATES_STORAGE_KEY = '@stingerai_templates';

export const noteService = {
  async getNotes(): Promise<Note[]> {
    try {
      const notesJson = await AsyncStorage.getItem(NOTES_STORAGE_KEY);
      return notesJson ? JSON.parse(notesJson) : [];
    } catch (error) {
      handleError(error, 'noteService:getNotes');
      throw new AppError('Failed to retrieve notes.', { cause: error });
    }
  },

  async saveNotes(notes: Note[]): Promise<void> {
    try {
      await AsyncStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(notes));
    } catch (error) {
      handleError(error, 'noteService:saveNotes');
      throw new AppError('Failed to save notes.', { cause: error });
    }
  },

  async addNote(note: Note): Promise<void> {
    try {
      const notes = await this.getNotes();
      notes.unshift(note);
      await this.saveNotes(notes);
    } catch (error) {
      handleError(error, 'noteService:addNote');
      throw new AppError('Failed to add note.', { cause: error });
    }
  },

  async deleteNote(id: string): Promise<void> {
    try {
      const notes = await this.getNotes();
      const updatedNotes = notes.filter(note => note.id !== id);
      await this.saveNotes(updatedNotes);
    } catch (error) {
      handleError(error, 'noteService:deleteNote');
      throw new AppError('Failed to delete note.', { cause: error });
    }
  },

  async updateNote(id: string, updates: Partial<Note>): Promise<void> {
    try {
      const notes = await this.getNotes();
      const index = notes.findIndex(note => note.id === id);
      if (index !== -1) {
        notes[index] = { ...notes[index], ...updates };
        await this.saveNotes(notes);
      }
    } catch (error) {
      handleError(error, 'noteService:updateNote');
      throw new AppError('Failed to update note.', { cause: error });
    }
  },

  async getNotesByCategory(category: string): Promise<Note[]> {
    try {
      const notes = await this.getNotes();
      return notes.filter(note => note.category === category);
    } catch (error) {
      handleError(error, 'noteService:getNotesByCategory');
      throw new AppError('Failed to retrieve notes by category.', { cause: error });
    }
  },

  async getNotesByTag(tag: string): Promise<Note[]> {
    try {
      const notes = await this.getNotes();
      return notes.filter(note => note.tags.includes(tag));
    } catch (error) {
      handleError(error, 'noteService:getNotesByTag');
      throw new AppError('Failed to retrieve notes by tag.', { cause: error });
    }
  },

  async archiveNote(id: string): Promise<void> {
    try {
      const notes = await this.getNotes();
      const index = notes.findIndex(note => note.id === id);
      if (index !== -1) {
        notes[index].isArchived = true;
        notes[index].lastModified = new Date().toISOString();
        await this.saveNotes(notes);
      }
    } catch (error) {
      handleError(error, 'noteService:archiveNote');
      throw new AppError('Failed to archive note.', { cause: error });
    }
  },

  async unarchiveNote(id: string): Promise<void> {
    try {
      const notes = await this.getNotes();
      const index = notes.findIndex(note => note.id === id);
      if (index !== -1) {
        notes[index].isArchived = false;
        notes[index].lastModified = new Date().toISOString();
        await this.saveNotes(notes);
      }
    } catch (error) {
      handleError(error, 'noteService:unarchiveNote');
      throw new AppError('Failed to unarchive note.', { cause: error });
    }
  },

  async getArchivedNotes(): Promise<Note[]> {
    try {
      const notes = await this.getNotes();
      return notes.filter(note => note.isArchived);
    } catch (error) {
      handleError(error, 'noteService:getArchivedNotes');
      throw new AppError('Failed to retrieve archived notes.', { cause: error });
    }
  },

  async getActiveNotes(): Promise<Note[]> {
    try {
      const notes = await this.getNotes();
      return notes.filter(note => !note.isArchived);
    } catch (error) {
      handleError(error, 'noteService:getActiveNotes');
      throw new AppError('Failed to retrieve active notes.', { cause: error });
    }
  },

  async saveAsTemplate(note: Note): Promise<void> {
    try {
      const templates = await this.getTemplates();
      const template = {
        ...note,
        id: Date.now().toString(),
        isTemplate: true,
        date: new Date().toISOString(),
      };
      templates.push(template);
      await AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
    } catch (error) {
      handleError(error, 'noteService:saveAsTemplate');
      throw new AppError('Failed to save as template.', { cause: error });
    }
  },

  async getTemplates(): Promise<Note[]> {
    try {
      const templatesJson = await AsyncStorage.getItem(TEMPLATES_STORAGE_KEY);
      return templatesJson ? JSON.parse(templatesJson) : [];
    } catch (error) {
      handleError(error, 'noteService:getTemplates');
      throw new AppError('Failed to retrieve templates.', { cause: error });
    }
  },

  async deleteTemplate(id: string): Promise<void> {
    try {
      const templates = await this.getTemplates();
      const updatedTemplates = templates.filter(template => template.id !== id);
      await AsyncStorage.setItem(TEMPLATES_STORAGE_KEY, JSON.stringify(updatedTemplates));
    } catch (error) {
      handleError(error, 'noteService:deleteTemplate');
      throw new AppError('Failed to delete template.', { cause: error });
    }
  },

  async shareNote(id: string, email: string): Promise<void> {
    try {
      const notes = await this.getNotes();
      const index = notes.findIndex(note => note.id === id);
      if (index !== -1) {
        if (!notes[index].sharedWith) {
          notes[index].sharedWith = [];
        }
        if (!notes[index].sharedWith.includes(email)) {
          notes[index].sharedWith.push(email);
          notes[index].lastModified = new Date().toISOString();
          await this.saveNotes(notes);
        }
      }
    } catch (error) {
      handleError(error, 'noteService:shareNote');
      throw new AppError('Failed to share note.', { cause: error });
    }
  },

  async unshareNote(id: string, email: string): Promise<void> {
    try {
      const notes = await this.getNotes();
      const index = notes.findIndex(note => note.id === id);
      if (index !== -1 && notes[index].sharedWith) {
        notes[index].sharedWith = notes[index].sharedWith.filter(e => e !== email);
        notes[index].lastModified = new Date().toISOString();
        await this.saveNotes(notes);
      }
    } catch (error) {
      handleError(error, 'noteService:unshareNote');
      throw new AppError('Failed to unshare note.', { cause: error });
    }
  },

  async exportNotes(): Promise<string> {
    try {
      const notes = await this.getNotes();
      return JSON.stringify(notes, null, 2);
    } catch (error) {
      handleError(error, 'noteService:exportNotes');
      throw new AppError('Failed to export notes.', { cause: error });
    }
  },

  async importNotes(jsonString: string): Promise<void> {
    try {
      const importedNotes = JSON.parse(jsonString);
      if (Array.isArray(importedNotes)) {
        const existingNotes = await this.getNotes();
        const mergedNotes = [...existingNotes, ...importedNotes];
        await this.saveNotes(mergedNotes);
      }
    } catch (error) {
      handleError(error, 'noteService:importNotes');
      throw new AppError('Failed to import notes.', { cause: error });
    }
  },

  async sortNotes(notes: Note[], sortBy: 'date' | 'title'): Promise<Note[]> {
    try {
    return [...notes].sort((a, b) => {
      switch (sortBy) {
        case 'date':
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        case 'title':
          return a.title.localeCompare(b.title);
        default:
          return 0;
      }
    });
    } catch (error) {
      handleError(error, 'noteService:sortNotes');
      throw new AppError('Failed to sort notes.', { cause: error });
    }
  }
}; 