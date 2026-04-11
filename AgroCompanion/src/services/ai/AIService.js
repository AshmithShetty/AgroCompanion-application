import { ConfigService } from '../../utils/ConfigService';
import { LanguageService } from '../LanguageService';
import { AICacheService } from './AICacheService';
import { NetworkMonitor } from '../NetworkMonitor';
import i18n from 'i18next';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const normalizeBase64Image = (base64) => {
  if (typeof base64 !== 'string') return null;
  const trimmed = base64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
};

class AIServiceImpl {
  constructor() {
  }

  async generateResponse(systemPrompt, userPrompt, base64Image = null, options = {}) {
    const isOnline = await NetworkMonitor.checkConnection();
    const currentLang = LanguageService.getCurrentLanguage();
    const expectJsonEnvelope = Boolean(options?.expectJsonEnvelope);
    const noCache = Boolean(options?.noCache);

    const languageInstruction = `You must reply in the language with ISO 639-1 code: ${currentLang}.`;
    const finalSystemPrompt = `${systemPrompt}\n${languageInstruction}`;

    if (!noCache) {
      const cached = await AICacheService.getCachedResponse(finalSystemPrompt, userPrompt);
      if (cached) {
        return cached;
      }
    }

    if (!isOnline) {
      const msg = i18n.t('errors:ai.offline');
      return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
    }

    if (!ConfigService.ENABLE_AI || !ConfigService.GROQ_API_KEY) {
      const msg = i18n.t('errors:ai.notConfigured');
      return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
    }

    try {
      const hasImage = typeof base64Image === 'string' && base64Image.trim().length > 0;
      const model = hasImage ? ConfigService.GROQ_VISION_MODEL : ConfigService.GROQ_TEXT_MODEL;
      const chatHistoryObj = Array.isArray(options?.chatLog) ? options.chatLog : [];
      let historyMessages = chatHistoryObj.slice(-8)
        .filter(m => m.text !== userPrompt) // Avoid duplicate last prompt
        .map(m => ({
          role: m.role === 'ai' ? 'assistant' : 'user',
          content: m.text
        }));

      const messages = hasImage
        ? [
          { role: 'system', content: finalSystemPrompt },
          ...historyMessages,
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              { type: 'image_url', image_url: { url: normalizeBase64Image(base64Image) } }
            ]
          }
        ]
        : [
          { role: 'system', content: finalSystemPrompt },
          ...historyMessages,
          { role: 'user', content: userPrompt }
        ];

      const response = await fetch(GROQ_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ConfigService.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.4,
          max_completion_tokens: 3000,
          stream: false
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const detail = err?.error?.message || err?.error || err?.message || response.statusText || '';
        const msg = i18n.t('errors:ai.serviceError', { status: response.status, message: detail });
        return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
      }

      const data = await response.json();
      const aiText = data?.choices?.[0]?.message?.content;

      if (!aiText) {
        const msg = i18n.t('errors:ai.emptyResponse');
        return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
      }

      console.log('AI Response:', aiText);

      await AICacheService.setCachedResponse(finalSystemPrompt, userPrompt, aiText);
      return aiText;
    } catch (error) {
      console.error('AIService error:', error);
      const msg = i18n.t('errors:ai.requestFailed', { message: error.message || '' });
      return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
    }
  }
}

export const AIService = new AIServiceImpl();
