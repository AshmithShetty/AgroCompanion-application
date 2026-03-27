import * as sdk from 'microsoft-cognitiveservices-speech-sdk';
import { ConfigService } from '../../utils/ConfigService';
import { NetworkMonitor } from '../NetworkMonitor';
import { LanguageService } from '../LanguageService';

class VoiceServiceImpl {
  constructor() {
    this.speechConfig = null;
  }

  init() {
    const key = ConfigService.AZURE_SPEECH_KEY;
    const region = ConfigService.AZURE_SPEECH_REGION;
    if (key && region) {
      this.speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
    }
  }

  getLocale() {
    const lang = LanguageService.getCurrentLanguage();
    if (lang === 'hi') return 'hi-IN';
    if (lang === 'kn') return 'kn-IN';
    return 'en-US';
  }

  async startSpeechToText(audioConfig) {
    const isOnline = await NetworkMonitor.checkConnection();
    if (!isOnline) {
      return this.startLocalSpeechToText(audioConfig);
    }

    return new Promise((resolve, reject) => {
      if (!this.speechConfig) {
        reject(new Error('Azure_Speech_Config_Missing'));
        return;
      }

      const autoDetectSourceLanguageConfig = sdk.AutoDetectSourceLanguageConfig.fromLanguages(['en-US', 'hi-IN', 'kn-IN']);
      const recognizer = sdk.SpeechRecognizer.FromConfig(this.speechConfig, autoDetectSourceLanguageConfig, audioConfig);

      recognizer.recognizeOnceAsync(
        result => {
          if (result.reason === sdk.ResultReason.RecognizedSpeech) {
            resolve(result.text);
          } else {
            reject(new Error('Speech_Recognition_Failed'));
          }
          recognizer.close();
        },
        error => {
          reject(error);
          recognizer.close();
        }
      );
    });
  }

  async startLocalSpeechToText(audioConfig) {
    return "LOCAL_STT_READY_MODEL_NOT_DOWNLOADED";
  }

  async textToSpeech(text) {
    const isOnline = await NetworkMonitor.checkConnection();
    if (!isOnline) {
      return this.localTextToSpeech(text);
    }

    return new Promise((resolve, reject) => {
      if (!this.speechConfig) {
        reject(new Error('Azure_Speech_Config_Missing'));
        return;
      }

      this.speechConfig.speechSynthesisLanguage = this.getLocale();
      const synthesizer = new sdk.SpeechSynthesizer(this.speechConfig);

      synthesizer.speakTextAsync(
        text,
        result => {
          if (result.reason === sdk.ResultReason.SynthesizingAudioCompleted) {
            resolve(result.audioData);
          } else {
            reject(new Error('Speech_Synthesis_Failed'));
          }
          synthesizer.close();
        },
        error => {
          reject(error);
          synthesizer.close();
        }
      );
    });
  }

  async localTextToSpeech(text) {
    return "LOCAL_TTS_READY_MODEL_NOT_DOWNLOADED";
  }
}

export const VoiceService = new VoiceServiceImpl();