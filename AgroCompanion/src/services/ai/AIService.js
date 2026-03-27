import { ConfigService } from '../../utils/ConfigService';
import { LanguageService } from '../LanguageService';
import { AICacheService } from './AICacheService';
import { NetworkMonitor } from '../NetworkMonitor';

class AIServiceImpl {
  constructor() {
    this.endpoint = ConfigService.AZURE_OPENAI_ENDPOINT;
    this.apiKey = ConfigService.AZURE_OPENAI_KEY;
  }

  async generateResponse(systemPrompt, userPrompt, base64Image = null) {
    const isOnline = await NetworkMonitor.checkConnection();
    const currentLang = LanguageService.getCurrentLanguage();

    const languageInstruction = `You must reply in the language with ISO 639-1 code: ${currentLang}.`;
    const finalSystemPrompt = `${systemPrompt}\n${languageInstruction}`;

    const cached = await AICacheService.getCachedResponse(finalSystemPrompt, userPrompt);
    if (cached) {
      return cached;
    }

    if (!isOnline) {
      return 'You are currently offline. Please connect to the internet to use the AI assistant.';
    }

    if (!this.apiKey || !this.endpoint) {
      return 'AI service is not configured. Please add your Azure OpenAI key and endpoint to the .env file.';
    }

    try {
      const cleanEndpoint = this.endpoint.replace(/\/$/, '');
      const deploymentName = ConfigService.AZURE_OPENAI_DEPLOYMENT_NAME;
      const apiVersion = ConfigService.AZURE_OPENAI_API_VERSION;
      const hasImage = typeof base64Image === 'string' && base64Image.trim().length > 0;
      const response = await fetch(`${cleanEndpoint}/openai/deployments/${deploymentName}/chat/completions?api-version=${apiVersion}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey,
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: finalSystemPrompt },
            { role: 'user', content: hasImage ? [
                { type: 'text', text: userPrompt },
                { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
              ] : userPrompt },
          ],
          temperature: 0.4,
          max_tokens: 800,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        return `AI service error (${response.status}): ${err?.error?.message || response.statusText}`;
      }

      const data = await response.json();
      const aiText = data.choices?.[0]?.message?.content;

      if (!aiText) {
        return 'Received an empty response from the AI service.';
      }

      console.log('AI Response:', aiText);

      await AICacheService.setCachedResponse(finalSystemPrompt, userPrompt, aiText);
      return aiText;
    } catch (error) {
      console.error('AIService error:', error);
      return `AI request failed: ${error.message}`;
    }
  }
}

export const AIService = new AIServiceImpl();
