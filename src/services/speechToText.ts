import { Audio } from 'expo-av';
import { SpeechService } from './types';

let recording: Audio.Recording | null = null;

export const startRecording = async (): Promise<void> => {
  try {
    // Request permissions
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      throw new Error('Microphone permission not granted');
    }

    // Configure audio mode
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true,
    });

    // Start recording
    const { recording: newRecording } = await Audio.Recording.createAsync(
      Audio.RecordingOptionsPresets.HIGH_QUALITY
    );
    recording = newRecording;
  } catch (error) {
    console.error('Failed to start recording:', error);
    throw error;
  }
};

export const stopRecording = async (): Promise<string> => {
  try {
    if (!recording) {
      throw new Error('Not recording');
    }

    // Stop recording
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    recording = null;

    if (!uri) {
      throw new Error('No recording URI available');
    }

    // Here you would normally send the audio file to a speech-to-text service
    // For now, we'll just return a placeholder message
    return "Speech to text conversion would happen here. For now, this is a placeholder message.";
  } catch (error) {
    console.error('Failed to stop recording:', error);
    throw error;
  }
};

// Export the service interface implementation
export const speechService: SpeechService = {
  startRecording,
  stopRecording,
}; 