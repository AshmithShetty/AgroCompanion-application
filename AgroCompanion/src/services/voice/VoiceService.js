import { Audio } from 'expo-av';
import { ConfigService } from '../../utils/ConfigService';
import { NetworkMonitor } from '../NetworkMonitor';
import { LanguageService } from '../LanguageService';

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const mimeFromUri = (uri) => {
  const u = String(uri || '').toLowerCase();
  if (u.endsWith('.m4a')) return 'audio/m4a';
  if (u.endsWith('.mp3')) return 'audio/mpeg';
  if (u.endsWith('.wav')) return 'audio/wav';
  if (u.endsWith('.caf')) return 'audio/x-caf';
  if (u.endsWith('.aac')) return 'audio/aac';
  return 'application/octet-stream';
};

class VoiceServiceImpl {
  constructor() {
    this.recordMs = 4500;
  }

  init() {
    // Placeholder for future voice initialization logic
  }

  async startSpeechToText() {
    const isOnline = await NetworkMonitor.checkConnection();
    if (!isOnline) {
      return 'Offline: speech recognition requires an internet connection.';
    }
    if (!ConfigService.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY_MISSING');
    }

    const perm = await Audio.requestPermissionsAsync();
    if (!perm?.granted) {
      throw new Error('MIC_PERMISSION_DENIED');
    }

    await Audio.setAudioModeAsync({
      allowsRecordingIOS: true,
      playsInSilentModeIOS: true
    });

    const recording = new Audio.Recording();
    await recording.prepareToRecordAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
    await recording.startAsync();
    await sleep(this.recordMs);
    await recording.stopAndUnloadAsync();

    const uri = recording.getURI();
    if (!uri) {
      throw new Error('RECORDING_URI_MISSING');
    }

    const form = new FormData();
    form.append('file', {
      uri,
      name: 'speech.m4a',
      type: mimeFromUri(uri)
    });
    form.append('model', 'whisper-large-v3-turbo');

    const lang = LanguageService.getCurrentLanguage();
    if (lang) {
      form.append('language', lang);
    }

    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${ConfigService.GROQ_API_KEY}`
      },
      body: form
    });

    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(json?.error?.message || json?.error || `STT_FAILED_${response.status}`);
    }
    const text = json?.text;
    if (typeof text !== 'string' || !text.trim()) {
      throw new Error('STT_EMPTY_TEXT');
    }
    return text.trim();
  }

  async textToSpeech() {
    throw new Error('TTS_NOT_IMPLEMENTED');
  }
}

export const VoiceService = new VoiceServiceImpl();
