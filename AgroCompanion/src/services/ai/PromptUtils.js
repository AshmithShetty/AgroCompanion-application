import { useUserSessionStore } from '../../store';
import { LanguageService } from '../LanguageService';
import { PolicyContext } from './policy/PolicyContext';
import { RegionalAdvisoryPolicy } from './policy/RegionalAdvisoryPolicy';

export const normalizeWhitespace = (value) => (value || '').toString().replace(/\s+/g, ' ').trim();

export const truncateText = (value, maxLength = 280) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return '';
  if (normalized.length <= maxLength) return normalized;
  return `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
};

export const estimateTextTokens = (value) => {
  const normalized = normalizeWhitespace(value);
  if (!normalized) return 0;
  return Math.max(1, Math.ceil(normalized.length / 4));
};

export const estimateMessageTokens = (messages = []) => messages.reduce((sum, message) => {
  const content = Array.isArray(message?.content)
    ? message.content.map(part => {
      if (part?.type === 'text') return part.text || '';
      if (part?.type === 'image_url') return '[image]';
      return '';
    }).join(' ')
    : (message?.content || '');
  return sum + estimateTextTokens(content) + 4;
}, 0);

export const buildChatHistoryMessages = (chatLog = [], currentUserPrompt = '', options = {}) => {
  const maxRecentMessages = Math.max(0, Number(options.maxRecentMessages) || 4);
  const maxMessageChars = Math.max(80, Number(options.maxMessageChars) || 240);
  const maxSummaryChars = Math.max(120, Number(options.maxSummaryChars) || 420);
  const maxTotalChars = Math.max(240, Number(options.maxTotalChars) || 1200);
  const normalizedUserPrompt = normalizeWhitespace(currentUserPrompt);

  const normalizedLog = (Array.isArray(chatLog) ? chatLog : [])
    .filter(item => item && typeof item.text === 'string')
    .map(item => ({
      role: item.role === 'ai' ? 'assistant' : 'user',
      content: truncateText(item.text, maxMessageChars),
    }))
    .filter(item => item.content && item.content !== normalizedUserPrompt);

  if (normalizedLog.length === 0) {
    return [];
  }

  const recent = normalizedLog.slice(-maxRecentMessages);
  const older = normalizedLog.slice(0, -maxRecentMessages);
  const messages = [];

  if (older.length > 0) {
    const summary = older
      .slice(-6)
      .map(item => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`)
      .join('\n');
    const compactSummary = truncateText(summary, maxSummaryChars);
    if (compactSummary) {
      messages.push({
        role: 'system',
        content: `Conversation summary:\n${compactSummary}`,
      });
    }
  }

  let runningChars = messages.reduce((sum, item) => sum + item.content.length, 0);
  for (const item of recent) {
    if (runningChars + item.content.length > maxTotalChars && messages.length > 0) {
      continue;
    }
    messages.push(item);
    runningChars += item.content.length;
  }

  return messages;
};

export const ContextBuilder = {
  buildFarmContext: (options = {}) => {
    const { currentSession, currentFarm, currentUser } = useUserSessionStore.getState();
    const intent = options.intent || 'general';
    const langCode = LanguageService.getCurrentLanguage() || 'en';
    const languageMap = { en: 'English', hi: 'Hindi', kn: 'Kannada', mr: 'Marathi' };
    const language = languageMap[langCode] || 'English';
    const crop = currentSession?.cropType || 'Unknown Crop';
    const method = currentSession?.farmingMethod || 'Conventional';
    const soil = currentSession?.soilType || 'Unknown Soil';
    const farmContext = currentSession?.farmContextSnapshot || currentFarm?.farmContext || '';
    const district = currentFarm?.districtName || 'Unknown District';
    const area = Number(currentFarm?.boundaryAreaHectares || 0);
    const districtProfile = PolicyContext.resolveDistrictProfile();

    let daysSinceStart = 0;
    if (currentSession?.startDate) {
      const start = new Date(currentSession.startDate).getTime();
      const now = Date.now();
      daysSinceStart = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    }

    const lines = [
      `Farm: ${currentFarm?.name || 'My Farm'}`,
      `Farmer: ${currentUser?.username || 'User'}`,
      `District: ${district}`,
      `Area hectares: ${area.toFixed(2)}`,
      `Crop: ${crop}`,
      `Crop age days: ${daysSinceStart}`,
      `Current date: ${new Date().toISOString().split('T')[0]}`,
      `Reply language: ${language}`,
    ];

    if (intent !== 'market') {
      lines.push(`Soil type: ${soil}`);
      lines.push(`Farming method: ${method}`);
    }

    const contextLimit = intent === 'market' ? 260 : intent === 'image' ? 420 : 560;
    const compactFarmContext = truncateText(farmContext, contextLimit);
    if (compactFarmContext) {
      lines.push(`Farm notes: ${compactFarmContext}`);
    }

    const regionalSummary = RegionalAdvisoryPolicy.buildCompactSummary(districtProfile);
    if (regionalSummary) {
      lines.push(`Regional agronomy profile: ${truncateText(regionalSummary, intent === 'market' ? 180 : 320)}`);
    }

    return lines.join('\n');
  }
};

export const ResponseFormatter = {
  format: (rawText) => {
    return rawText.trim();
  }
};

export const hashString = (str) => {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
  }
  return hash.toString();
};
