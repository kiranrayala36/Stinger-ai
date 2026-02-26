import { EventEmitter } from 'events';
import { SYSTEM_PROMPT } from '../config/systemPrompt';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface StreamingResponse {
  content: string;
  done: boolean;
}

// Get API key from environment variables only
const API_KEY = process.env.OPENROUTER_API_KEY;

if (!API_KEY) {
  console.error('WARNING: OPENROUTER_API_KEY environment variable is not set. AI functionality will not work.');
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

export class AIChatService extends EventEmitter {
  private static instance: AIChatService;
  private abortController: AbortController | null = null;

  private constructor() {
    super();
  }

  static getInstance(): AIChatService {
    if (!AIChatService.instance) {
      AIChatService.instance = new AIChatService();
    }
    return AIChatService.instance;
  }

  cancelCurrentStream() {
    if (this.abortController) {
      this.abortController.abort();
      this.abortController = null;
    }
  }

  async sendMessageToAI(messages: ChatMessage[], retryCount = 0): Promise<string> {
    try {
      if (!API_KEY) {
        throw new Error('OpenRouter API key is not configured. Please set the OPENROUTER_API_KEY environment variable.');
      }
      
      this.abortController = new AbortController();

      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'HTTP-Referer': 'https://stingerai.app',
          'X-Title': 'StingerAI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek/deepseek-r1-distill-llama-70b:free',
          messages: [
            {
              role: 'system',
              content: SYSTEM_PROMPT
            },
            ...messages
          ],
          stream: false,
          temperature: 0.7,
          max_tokens: 1000,
        }),
        signal: this.abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error Details:', errorData);
        
        if (retryCount < MAX_RETRIES && this.shouldRetry(response.status)) {
          console.log(`Retrying request (${retryCount + 1}/${MAX_RETRIES})...`);
          await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * (retryCount + 1)));
          return this.sendMessageToAI(messages, retryCount + 1);
        }
        
        throw new Error(`API request failed with status ${response.status}`);
      }

      try {
      const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
      
        // Split content into lines to preserve formatting
        const lines = content.split('\n');
        let currentLine = '';
        
        for (const line of lines) {
          // If it's a markdown heading or list item, emit it as a complete chunk
          if (line.trim().startsWith('#') || line.trim().startsWith('-') || line.trim().startsWith('*')) {
            if (currentLine) {
              this.emit('chunk', { content: currentLine + '\n', done: false });
              await new Promise(resolve => setTimeout(resolve, 15));
            }
            this.emit('chunk', { content: line + '\n', done: false });
            await new Promise(resolve => setTimeout(resolve, 15));
            currentLine = '';
            continue;
          }

          // For regular text, split into words and emit in small groups
          const words = line.split(' ');
          let currentChunk = '';
      
      for (const word of words) {
        if (this.abortController?.signal.aborted) {
          throw new Error('Request was cancelled');
        }
        
            // If the word contains markdown formatting, emit it as a complete unit
            if (word.includes('**') || word.includes('`') || word.includes('_')) {
              if (currentChunk) {
                this.emit('chunk', { content: currentChunk + ' ', done: false });
                await new Promise(resolve => setTimeout(resolve, 15));
                currentChunk = '';
              }
              this.emit('chunk', { content: word + ' ', done: false });
              await new Promise(resolve => setTimeout(resolve, 15));
            } else {
              currentChunk += word + ' ';
              if (currentChunk.length > 20) {
                this.emit('chunk', { content: currentChunk, done: false });
                await new Promise(resolve => setTimeout(resolve, 15));
                currentChunk = '';
              }
            }
          }

          if (currentChunk) {
            this.emit('chunk', { content: currentChunk + '\n', done: false });
            await new Promise(resolve => setTimeout(resolve, 15));
          } else {
            this.emit('chunk', { content: '\n', done: false });
            await new Promise(resolve => setTimeout(resolve, 15));
          }
        }
        
      this.emit('done', content);
      return content;
      } catch (parseError) {
        console.error('Error parsing JSON response:', parseError);
        throw new Error('Failed to parse API response');
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new Error('Request was cancelled');
        }
        console.error('Error calling AI API:', error.message);
        throw error;
      }
      const errorMessage = String(error);
      console.error('Error calling AI API:', errorMessage);
      throw new Error(errorMessage);
    } finally {
      this.abortController = null;
    }
  }

  private shouldRetry(statusCode: number): boolean {
    // Retry on rate limits, gateway timeouts, and server errors
    return statusCode === 429 || statusCode === 504 || (statusCode >= 500 && statusCode < 600);
  }
}

export const aiChatService = AIChatService.getInstance(); 