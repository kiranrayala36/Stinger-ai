import { RealtimeClientOptions } from '@supabase/supabase-js';

interface CustomWebSocketOptions extends RealtimeClientOptions {
  autoReconnect?: boolean;
}

export class CustomWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private options: CustomWebSocketOptions;
  private reconnectTimer: any = null;
  private messageQueue: string[] = [];
  private listeners: { [key: string]: ((event: any) => void)[] } = {};

  constructor(url: string, options: CustomWebSocketOptions = {}) {
    this.url = url;
    this.options = options;
  }

  connect() {
    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.emit('open');
        // Send any queued messages
        while (this.messageQueue.length > 0) {
          const msg = this.messageQueue.shift();
          if (msg) this.send(msg);
        }
      };

      this.ws.onclose = () => {
        this.emit('close');
        // Attempt to reconnect
        if (this.options.autoReconnect !== false) {
          this.reconnectTimer = setTimeout(() => {
            this.connect();
          }, 1000);
        }
      };

      this.ws.onerror = (error) => {
        this.emit('error', error);
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.emit('message', data);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };
    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.emit('error', error);
    }
  }

  send(data: string) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    } else {
      // Queue message if not connected
      this.messageQueue.push(data);
    }
  }

  close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  on(event: string, callback: (event: any) => void) {
    if (!this.listeners[event]) {
      this.listeners[event] = [];
    }
    this.listeners[event].push(callback);
  }

  private emit(event: string, data?: any) {
    const callbacks = this.listeners[event] || [];
    callbacks.forEach(callback => callback(data));
  }
} 