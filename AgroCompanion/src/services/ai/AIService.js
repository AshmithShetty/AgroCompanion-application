import { ConfigService } from '../../utils/ConfigService';
import { LanguageService } from '../LanguageService';
import { AICacheService } from './AICacheService';
import { NetworkMonitor } from '../NetworkMonitor';
import { AIAuditService } from './AIAuditService';
import { resolveAIRequestProfile } from './AIRequestProfiles';
import { buildChatHistoryMessages, estimateMessageTokens, estimateTextTokens } from './PromptUtils';
import { ToolRegistry } from './tools/ToolRegistry';
import { AIGatekeeper } from './AIGatekeeper';
import i18n from 'i18next';

const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

const normalizeBase64Image = (base64) => {
  if (typeof base64 !== 'string') return null;
  const trimmed = base64.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('data:image/')) return trimmed;
  return `data:image/jpeg;base64,${trimmed}`;
};

const fetchWithRetry = async (url, options, maxRetries = 5) => {
  let attempt = 0;
  while (attempt < maxRetries) {
    const response = await AIGatekeeper.run(() => fetch(url, options));
    if (response.status === 429 || response.status >= 500) {
      attempt++;
      if (attempt >= maxRetries) return response;
      const retryAfter = response.headers.get('Retry-After');
      const baseDelay = retryAfter ? parseInt(retryAfter, 10) * 1000 : Math.pow(2, attempt) * 1000;
      const jitter = Math.random() * 500;
      const delay = baseDelay + jitter;
      console.warn(`[AIService] API error (${response.status}). Retrying in ${Math.round(delay)}ms (Attempt ${attempt}/${maxRetries})...`);
      await new Promise(r => setTimeout(r, delay));
      continue;
    }
    return response;
  }
};

const safeLogMetric = async (payload) => {
  await AIAuditService.logEvent({
    type: 'ai_request_metric',
    ...payload,
  }).catch(() => {});
};

const extractContentText = (content) => {
  if (Array.isArray(content)) {
    return content.map(part => {
      if (part?.type === 'text') return part.text || '';
      if (part?.type === 'image_url') return '[image]';
      return '';
    }).join(' ');
  }
  return (content || '').toString();
};

const shouldFallbackModel = (detail, model, fallbackModel) => {
  if (!detail || !model || !fallbackModel || model === fallbackModel) return false;
  const normalized = detail.toLowerCase();
  return normalized.includes('model') && (
    normalized.includes('not found') ||
    normalized.includes('does not exist') ||
    normalized.includes('unsupported') ||
    normalized.includes('invalid')
  );
};

class AIServiceImpl {
  constructor() {
  }

  async generateResponse(systemPrompt, userPrompt, base64Image = null, options = {}) {
    const isOnline = await NetworkMonitor.checkConnection();
    const currentLang = LanguageService.getCurrentLanguage() || 'en';
    const expectJsonEnvelope = Boolean(options?.expectJsonEnvelope);
    const noCache = Boolean(options?.noCache);
    const feature = options?.feature || 'default';
    const profile = resolveAIRequestProfile(feature, options?.profileOverrides || {});
    const attempt = Math.max(1, Number(options?.retryAttempt) || 1);
    const hasImage = typeof base64Image === 'string' && base64Image.trim().length > 0;
    const allowHistory = Boolean(
      profile.allowHistory &&
      !hasImage &&
      (!profile.disableHistoryAfterFirstAttempt || attempt === 1)
    );

    const languageInstruction = expectJsonEnvelope
      ? `You must reply in the language with ISO 639-1 code: ${currentLang}. Keep JSON keys, action types, and field names in English.`
      : `You must reply in the language with ISO 639-1 code: ${currentLang}.`;
    const finalSystemPrompt = `${systemPrompt}\n${languageInstruction}`;
    const historyMessages = allowHistory
      ? buildChatHistoryMessages(options?.chatLog, userPrompt, {
        maxRecentMessages: profile.maxRecentMessages,
        maxMessageChars: profile.maxMessageChars,
        maxSummaryChars: profile.maxSummaryChars,
        maxTotalChars: profile.maxTotalHistoryChars,
      })
      : [];
    const initialModel = options?.model || (hasImage ? ConfigService.GROQ_VISION_MODEL : profile.model);
    const cacheRequest = {
      feature,
      model: initialModel,
      responseKind: profile.responseKind,
      systemPrompt: finalSystemPrompt,
      userPrompt,
      historyMessages,
      base64Image: hasImage ? base64Image : null,
    };

    if (!noCache) {
      const cached = await AICacheService.getCachedResponse(cacheRequest);
      if (cached) {
        const promptTokensEstimated = estimateTextTokens(finalSystemPrompt) + estimateTextTokens(userPrompt) + estimateMessageTokens(historyMessages);
        const completionTokensEstimated = estimateTextTokens(cached);
        await safeLogMetric({
          feature,
          model: initialModel,
          cacheHit: true,
          retryAttempt: attempt,
          historyMessagesIncluded: historyMessages.length,
          promptTokensEstimated,
          completionTokensEstimated,
        });
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

      const useTools = options?.useTools === true;
      const tools = useTools ? ToolRegistry.getToolsDefinition() : undefined;

      let activeModel = initialModel;
      let finalAiText = null;
      let currentMessages = messages;
      let toolCallCount = 0;
      let maxToolLoops = 3;

      while (toolCallCount < maxToolLoops) {
        const promptTokensEstimated = estimateMessageTokens(currentMessages);
        const maxCompletionTokens = Math.max(
          profile.minCompletionTokens || 120,
          Math.min(
            profile.maxCompletionTokens || 900,
            Math.round((promptTokensEstimated * (profile.completionRatio || 1)) + (profile.completionBuffer || 0))
          )
        );
        const requestBody = {
          model: activeModel,
          messages: currentMessages,
          temperature: typeof options?.temperature === 'number' ? options.temperature : profile.temperature,
          max_completion_tokens: typeof options?.maxCompletionTokens === 'number' ? options.maxCompletionTokens : maxCompletionTokens,
          stream: false,
        };
        if (useTools) {
          requestBody.tools = tools;
          requestBody.tool_choice = "auto";
        } else {
          if (options?.responseFormat) {
            requestBody.response_format = options.responseFormat;
          } else if (expectJsonEnvelope) {
            requestBody.response_format = { type: 'json_object' };
          }
        }

        let response = await fetchWithRetry(GROQ_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${ConfigService.GROQ_API_KEY}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const detail = err?.error?.message || err?.error || err?.message || response.statusText || '';
          const fallbackModel = hasImage ? null : (profile.fallbackModel || ConfigService.GROQ_TEXT_MODEL_FAST);
          if (toolCallCount === 0 && shouldFallbackModel(detail, initialModel, fallbackModel)) {
            activeModel = fallbackModel;
            requestBody.model = fallbackModel;
            response = await fetchWithRetry(GROQ_CHAT_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${ConfigService.GROQ_API_KEY}`,
              },
              body: JSON.stringify(requestBody),
            });
          }
        }

        if (!response.ok) {
          const err = await response.json().catch(() => ({}));
          const detail = err?.error?.message || err?.error || err?.message || response.statusText || '';
          const msg = i18n.t('errors:ai.serviceError', { status: response.status, message: detail });
          return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
        }

        const data = await response.json();
        const responseMessage = data?.choices?.[0]?.message;

        if (!responseMessage) {
          const msg = i18n.t('errors:ai.emptyResponse');
          return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
        }

        if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
          currentMessages.push(responseMessage);
          for (const toolCall of responseMessage.tool_calls) {
            console.log(`[AIService] Executing tool: ${toolCall.function.name}`);
            const result = await ToolRegistry.executeTool(toolCall);
            currentMessages.push({
              role: 'tool',
              tool_call_id: toolCall.id,
              name: toolCall.function.name,
              content: JSON.stringify(result)
            });
          }
          toolCallCount++;
          continue; // Loop again with tool results
        } else {
          finalAiText = responseMessage.content;
          break; // Final textual response
        }
      }

      if (!finalAiText && toolCallCount > 0) {
        const synthBody = {
          model: activeModel,
          messages: currentMessages,
          temperature: typeof options?.temperature === 'number' ? options.temperature : profile.temperature,
          max_completion_tokens: typeof options?.maxCompletionTokens === 'number' ? options.maxCompletionTokens : 512,
          stream: false,
          tools,
          tool_choice: 'none',
        };
        try {
          const synthResponse = await fetchWithRetry(GROQ_CHAT_URL, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${ConfigService.GROQ_API_KEY}`,
            },
            body: JSON.stringify(synthBody),
          });
          if (synthResponse.ok) {
            const synthData = await synthResponse.json();
            const synthText = synthData?.choices?.[0]?.message?.content;
            if (synthText) {
              finalAiText = synthText;
            }
          }
        } catch (_) {}
      }

      if (!finalAiText) {
        const msg = i18n.t('errors:ai.emptyResponse');
        return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
      }

      console.log('AI Response:', finalAiText);

      await AICacheService.setCachedResponse({
        ...cacheRequest,
        model: activeModel,
      }, finalAiText, options?.cacheTtlDays || profile.cacheTtlDays || 30);
      return finalAiText;
    } catch (error) {
      console.error('AIService error:', error);
      const msg = i18n.t('errors:ai.requestFailed', { message: error.message || '' });
      await safeLogMetric({
        feature,
        model: initialModel,
        cacheHit: false,
        retryAttempt: attempt,
        historyMessagesIncluded: historyMessages.length,
        promptTokensEstimated: estimateTextTokens(finalSystemPrompt) + estimateTextTokens(userPrompt),
        completionTokensEstimated: 0,
        error: error.message || 'request_failed',
      });
      return expectJsonEnvelope ? JSON.stringify({ message: msg, actions: [] }) : msg;
    }
  }
}

export const AIService = new AIServiceImpl();
