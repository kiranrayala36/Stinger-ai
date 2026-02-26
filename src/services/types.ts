import { Audio } from 'expo-av';
 
export interface SpeechService {
  startRecording: () => Promise<void>;
  stopRecording: () => Promise<string>;
} 