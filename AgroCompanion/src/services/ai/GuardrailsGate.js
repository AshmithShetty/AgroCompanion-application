import i18n from 'i18next';
import { useUserSessionStore } from '../../store';
import { PolicyEvaluator } from './policy/PolicyEvaluator';
import { PolicyContext } from './policy/PolicyContext';

const normalize = (value) => (value || '').toString().trim().toLowerCase();

const containsAny = (text, needles) => needles.some(needle => text.includes(needle));

const safeT = (key) => {
  const out = i18n.t(key);
  return typeof out === 'string' && out.trim() ? out : key;
};

const WATER_SOURCE_SIGNALS = ['canal', 'borewell', 'tube well', 'tubewell', 'well water', 'groundwater', 'pond', 'tank', 'reservoir', 'stored rainwater', 'rainfed', 'snowmelt', 'river lift', 'drip', 'sprinkler'];
const DRAINAGE_SIGNALS = ['drainage', 'drain', 'waterlog', 'waterlogged', 'standing water', 'raised bed', 'ridge', 'furrow', 'channel', 'outlet'];
const WATER_QUALITY_SIGNALS = ['saline', 'brackish', 'ec', 'tds', 'water test', 'water quality', 'white crust', 'alkali'];
const COLD_CONTEXT_SIGNALS = ['frost', 'freezing', 'snow', 'snowmelt', 'cold wave', 'temperature', 'dormant', 'pink bud', 'petal fall', 'fruit set'];
const HEAT_CONTEXT_SIGNALS = ['heat stress', 'hot wind', 'loo', 'heat wave', 'shade', 'mulch', 'cooling', 'high temperature'];
const SOIL_TYPE_SIGNALS = ['black soil', 'deep black', 'medium black', 'red soil', 'sandy loam', 'clay loam', 'loam', 'laterite', 'alluvial', 'soil type'];
const LANDFORM_SIGNALS = ['upland', 'midland', 'lowland', 'valley', 'floodplain', 'river bank', 'plain'];
const MONSOON_STATUS_SIGNALS = ['delayed monsoon', 'late monsoon', 'dry spell', 'break in monsoon', 'high rainfall', 'heavy rain', 'flood', 'waterlogging', 'monsoon'];

const isTimingOrInputSensitive = (text) => {
  const t = normalize(text);
  const en = ['fertil', 'urea', 'dap', 'npk', 'spray', 'pesticide', 'fungicide', 'herbicide', 'apply', 'topdress', 'irrigat', 'drip', 'dose', 'mix', 'dilut', 'prun', 'graft', 'sow', 'resow', 're-sow', 'transplant', 'drainage', 'waterlog', 'frost', 'snow'];
  const hi = ['खाद', 'उर्वरक', 'यूरिया', 'डीएपी', 'छिड़क', 'स्प्रे', 'कीटनाशक', 'फफूंद', 'सिंचाई'];
  const kn = ['ಗೊಬ್ಬರ', 'ಯೂರಿಯಾ', 'ಡಿ ಎ ಪಿ', 'ಸಿಂಚನ', 'ಸಿಂಚೈ', 'ಸ್ಪ್ರೇ', 'ಕೀಟ'];
  const mr = ['खत', 'युरिया', 'डीएपी', 'फवार', 'स्प्रे', 'कीटक', 'बुरशी', 'सिंचन', 'पाणी'];
  return containsAny(t, en) || containsAny(t, hi) || containsAny(t, kn) || containsAny(t, mr);
};

const missingCriticalSoilSignals = (sensorSnapshot) => {
  const moisture = sensorSnapshot?.soil_moisture;
  const ph = sensorSnapshot?.soil_ph;
  const nitrogen = sensorSnapshot?.nitrogen;
  const phosphorus = sensorSnapshot?.phosphorus;
  const potassium = sensorSnapshot?.potassium;
  return [moisture, ph, nitrogen, phosphorus, potassium].some(value => value === null || typeof value === 'undefined');
};

const forecastUnavailable = (forecastSummary) => {
  const s = normalize(forecastSummary);
  return !s || s.includes('unavailable') || s.includes('no forecast') || s.includes('no forecast data');
};

const parseForecastNumbers = (forecastSummary) => {
  const text = (forecastSummary || '').toString();
  const rainMatches = [...text.matchAll(/(\d+(?:\.\d+)?)mm\s+rain/gi)].map(match => Number(match[1])).filter(Number.isFinite);
  const tempMatches = [...text.matchAll(/(\d+)-(\d+)c/gi)].map(match => [Number(match[1]), Number(match[2])]).filter(pair => pair.every(Number.isFinite));

  return {
    maxRainMm: rainMatches.length ? Math.max(...rainMatches) : null,
    minTempC: tempMatches.length ? Math.min(...tempMatches.map(pair => pair[0])) : null,
    maxTempC: tempMatches.length ? Math.max(...tempMatches.map(pair => pair[1])) : null,
  };
};

const collectFarmSignals = () => {
  const { currentFarm, currentSession } = useUserSessionStore.getState();
  return normalize([
    currentFarm?.districtName,
    currentFarm?.farmContext,
    currentSession?.cropType,
    currentSession?.soilType,
    currentSession?.farmingMethod,
    currentSession?.farmContextSnapshot,
  ].filter(Boolean).join(' '));
};

const resolveClarifyResult = ({ code, tags, message, jurisdiction, languageCode }) => ({
  ok: false,
  kind: 'clarify',
  code,
  tags,
  message,
  jurisdiction,
  languageCode,
});

const shouldRequire = (text, signals = []) => Array.isArray(signals) && signals.length > 0 && containsAny(text, signals);

const runRegionalPreChecks = ({ districtProfile, userPrompt, forecastSummary, jurisdiction, languageCode }) => {
  const profile = districtProfile;
  const guardrails = profile?.guardrails || {};
  const promptText = normalize(userPrompt);
  const farmText = collectFarmSignals();
  const combinedText = `${promptText}\n${farmText}`.trim();
  const forecastMetrics = parseForecastNumbers(forecastSummary);
  const heavyRainRisk = Number.isFinite(forecastMetrics.maxRainMm) && forecastMetrics.maxRainMm >= 15;
  const frostRisk = Number.isFinite(forecastMetrics.minTempC) && forecastMetrics.minTempC <= 2;
  const heatRisk = Number.isFinite(forecastMetrics.maxTempC) && forecastMetrics.maxTempC >= 35;

  if (shouldRequire(promptText, guardrails.requireWaterSourceFor) && !containsAny(combinedText, WATER_SOURCE_SIGNALS)) {
    return resolveClarifyResult({
      code: 'missing_water_source',
      tags: ['missing_water_source', profile.id],
      message: guardrails.waterSourceMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireDrainageCheckFor)
    && !containsAny(combinedText, DRAINAGE_SIGNALS)
    && (guardrails.highRainOrFloodRisk || heavyRainRisk || containsAny(promptText, ['rain', 'monsoon', 'flood', 'waterlog', 'drain']))
  ) {
    return resolveClarifyResult({
      code: 'missing_drainage_context',
      tags: ['missing_drainage_context', profile.id],
      message: guardrails.drainageMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireColdRiskCheckFor)
    && !containsAny(combinedText, COLD_CONTEXT_SIGNALS)
    && (frostRisk || forecastUnavailable(forecastSummary) || containsAny(promptText, ['frost', 'snow', 'cold', 'prun', 'graft', 'orchard', 'spray']))
  ) {
    return resolveClarifyResult({
      code: 'missing_cold_context',
      tags: ['missing_cold_context', profile.id],
      message: guardrails.coldRiskMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireHeatRiskCheckFor)
    && !containsAny(combinedText, HEAT_CONTEXT_SIGNALS)
    && (heatRisk || forecastUnavailable(forecastSummary) || containsAny(promptText, ['heat', 'summer', 'temperature']))
  ) {
    return resolveClarifyResult({
      code: 'missing_heat_context',
      tags: ['missing_heat_context', profile.id],
      message: guardrails.heatMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireSalinityCheckFor)
    && !containsAny(combinedText, WATER_QUALITY_SIGNALS)
    && containsAny(promptText, ['irrigat', 'borewell', 'tubewell', 'groundwater', 'water quality', 'salinity', 'fertig'])
  ) {
    return resolveClarifyResult({
      code: 'missing_water_quality_context',
      tags: ['missing_water_quality_context', profile.id],
      message: guardrails.salinityMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireSoilTypeFor)
    && !containsAny(combinedText, SOIL_TYPE_SIGNALS)
  ) {
    return resolveClarifyResult({
      code: 'missing_soil_type_context',
      tags: ['missing_soil_type_context', profile.id],
      message: guardrails.soilTypeMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireWaterPositionCheckFor)
    && !containsAny(combinedText, LANDFORM_SIGNALS)
  ) {
    return resolveClarifyResult({
      code: 'missing_landform_context',
      tags: ['missing_landform_context', profile.id],
      message: guardrails.landPositionMessage,
      jurisdiction,
      languageCode,
    });
  }

  if (
    shouldRequire(promptText, guardrails.requireMonsoonStatusFor)
    && !containsAny(combinedText, MONSOON_STATUS_SIGNALS)
  ) {
    return resolveClarifyResult({
      code: 'missing_monsoon_context',
      tags: ['missing_monsoon_context', profile.id],
      message: guardrails.monsoonStatusMessage,
      jurisdiction,
      languageCode,
    });
  }

  return null;
};

const runRegionalPostChecks = ({ districtProfile, outputText, jurisdiction, languageCode }) => {
  const profile = districtProfile;
  const patterns = Array.isArray(profile?.guardrails?.blockedOutputPatterns) ? profile.guardrails.blockedOutputPatterns : [];
  const text = (outputText || '').toString();

  for (const pattern of patterns) {
    try {
      if (pattern.test(text)) {
        return {
          ok: false,
          kind: 'refuse',
          code: 'regional_policy_block',
          tags: ['regional_policy_block', profile.id],
          message: profile.guardrails.postcheckMessage,
          jurisdiction,
          languageCode,
        };
      }
    } catch {
      continue;
    }
  }

  return null;
};

export const GuardrailsGate = {
  preCheck: ({ userPrompt, languageCode, sensorSnapshot, forecastSummary, jurisdiction, intent }) => {
    const policyContext = PolicyContext.resolveContext();
    const juris = jurisdiction || policyContext.jurisdiction;
    const districtProfile = policyContext.districtProfile;
    const policy = PolicyEvaluator.evaluate({
      stage: 'pre',
      userPrompt,
      outputText: '',
      jurisdiction: juris,
      languageCode,
      districtProfile,
    });
    if (!policy.ok) {
      return { ...policy, code: policy.ruleId || 'policy_block' };
    }

    const regionalPre = runRegionalPreChecks({
      districtProfile,
      userPrompt,
      forecastSummary,
      jurisdiction: juris,
      languageCode,
    });
    if (regionalPre) {
      return regionalPre;
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

    return {
      ok: true,
      kind: 'allow',
      code: 'allow',
      tags: districtProfile?.id && districtProfile.id !== 'default' ? [districtProfile.id] : [],
      message: null,
      jurisdiction: juris,
      languageCode,
      districtProfile,
    };
  },

  postCheckText: ({ userPrompt, outputText, languageCode, jurisdiction }) => {
    const policyContext = PolicyContext.resolveContext();
    const juris = jurisdiction || policyContext.jurisdiction;
    const districtProfile = policyContext.districtProfile;
    const policy = PolicyEvaluator.evaluate({
      stage: 'post',
      userPrompt,
      outputText,
      jurisdiction: juris,
      languageCode,
      districtProfile,
    });
    if (!policy.ok) {
      return { ...policy, code: policy.ruleId || 'policy_block' };
    }

    const regionalPost = runRegionalPostChecks({
      districtProfile,
      outputText,
      jurisdiction: juris,
      languageCode,
    });
    if (regionalPost) {
      return regionalPost;
    }

    return {
      ok: true,
      kind: 'allow',
      code: 'allow',
      tags: districtProfile?.id && districtProfile.id !== 'default' ? [districtProfile.id] : [],
      message: outputText,
      jurisdiction: juris,
      languageCode,
      districtProfile,
    };
  },
};
