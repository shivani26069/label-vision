// TTS abstraction: expo-speech on native, Web Speech API on web
import * as Speech from 'expo-speech';

let isSpeaking = false;

export const speak = async (text, options = {}) => {
  try {
    if (isSpeaking) {
      await Speech.stop();
    }
    isSpeaking = true;
    await Speech.speak(text, {
      language: 'en-US',
      pitch: options.pitch || 1.0,
      rate: options.rate || 0.9,
      onDone: () => { isSpeaking = false; },
      onError: () => { isSpeaking = false; },
    });
  } catch (e) {
    isSpeaking = false;
    console.log('TTS unavailable:', e);
  }
};

export const stopSpeaking = async () => {
  try {
    await Speech.stop();
    isSpeaking = false;
  } catch (e) {
    console.log('TTS stop error:', e);
  }
};

export const getSpeakingStatus = () => isSpeaking;
