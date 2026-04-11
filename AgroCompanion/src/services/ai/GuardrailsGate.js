import i18n from 'i18next';
import { PolicyEvaluator } from './policy/PolicyEvaluator';
import { PolicyContext } from './policy/PolicyContext';

const normalize = (value) => (value || '').toString().trim().toLowerCase();

const containsAny = (text, needles) => needles.some(n => text.includes(n));

const safeT = (key) => {
  const out = i18n.t(key);
  return typeof out === 'string' && out.trim() ? out : key;
};

const isTimingOrInputSensitive = (text) => {
  const t = normalize(text);
  const en = ['fertil', 'urea', 'dap', 'npk', 'spray', 'pesticide', 'fungicide', 'herbicide', 'apply', 'topdress', 'irrigat', 'drip', 'dose', 'mix', 'dilut'];
  const hi = ['खाद', 'उर्वरक', 'यूरिया', 'डीएपी', 'छिड़क', 'स्प्रे', 'कीटनाशक', 'फफूंद', 'सिंचाई', 'डोज', 'मिलाकर', 'घोल'];
  const kn = ['ಗೊಬ್ಬರ', 'ಯೂರಿಯಾ', 'ಡಿ ಎ ಪಿ', 'ಸಿಂಚನ', 'ಸಿಂಚೈ', 'ಸ್ಪ್ರೇ', 'ಕೀಟ'];
  const mr = ['खत', 'खते', 'युरिया', 'डीएपी', 'फवार', 'स्प्रे', 'कीटक', 'बुरशी', 'सिंचन', 'पाणी', 'डोस', 'मिश्रण', 'द्रावण'];
  return containsAny(t, en) || containsAny(t, hi) || containsAny(t, kn) || containsAny(t, mr);
};

const missingCriticalSoilSignals = (sensorSnapshot) => {
  const moisture = sensorSnapshot?.soil_moisture;
  const ph = sensorSnapshot?.soil_ph;
  const nitrogen = sensorSnapshot?.nitrogen;
  const phosphorus = sensorSnapshot?.phosphorus;
  const potassium = sensorSnapshot?.potassium;
  const missingAny = [moisture, ph, nitrogen, phosphorus, potassium].some(v => v === null || typeof v === 'undefined');
  return missingAny;
};

const forecastUnavailable = (forecastSummary) => {
  const s = normalize(forecastSummary);
  return !s || s.includes('unavailable') || s.includes('no forecast') || s.includes('no forecast data');
};

export const GuardrailsGate = {
  preCheck: ({ userPrompt, languageCode, sensorSnapshot, forecastSummary, jurisdiction, intent }) => {
    const juris = jurisdiction || PolicyContext.resolveJurisdiction();
    const policy = PolicyEvaluator.evaluate({
      stage: 'pre',
      userPrompt,
      outputText: '',
      jurisdiction: juris,
      languageCode,
    });
    if (!policy.ok) {
      return { ...policy, code: policy.ruleId || 'policy_block' };
    }

    if (intent !== 'schedule' && isTimingOrInputSensitive(userPrompt)) {
      if (missingCriticalSoilSignals(sensorSnapshot)) {
        return {
          ok: false,
          kind: 'clarify',
          code: 'missing_soil',
          tags: ['missing_soil'],
          message: safeT('errors:ai.missing_soil'),
          jurisdiction: juris,
          languageCode,
        };
      }
      if (forecastUnavailable(forecastSummary)) {
        return {
          ok: false,
          kind: 'clarify',
          code: 'missing_forecast',
          tags: ['missing_forecast'],
          message: safeT('errors:ai.missing_forecast'),
          jurisdiction: juris,
          languageCode,
        };
      }
    }

    return { ok: true, kind: 'allow', code: 'allow', tags: [], message: null, jurisdiction: juris, languageCode };
  },

  postCheckText: ({ userPrompt, outputText, languageCode, jurisdiction }) => {
    const juris = jurisdiction || PolicyContext.resolveJurisdiction();
    const policy = PolicyEvaluator.evaluate({
      stage: 'post',
      userPrompt,
      outputText,
      jurisdiction: juris,
      languageCode,
    });
    if (!policy.ok) {
      return { ...policy, code: policy.ruleId || 'policy_block' };
    }
    return { ok: true, kind: 'allow', code: 'allow', tags: [], message: outputText, jurisdiction: juris, languageCode };
  },
};

