import i18n from 'i18next';
import { AgAdvicePolicyV1 } from './AgAdvicePolicyV1';

const normalizeJurisdiction = (value) => (value || '').toString().trim().toUpperCase();

const normalizeText = (value) => (value || '').toString().trim();

const normalizeLower = (value) => normalizeText(value).toLowerCase();

const safeT = (key) => {
  const text = i18n.t(key);
  return typeof text === 'string' && text.trim() ? text : key;
};

const detectUserProvidedLabel = (userPrompt) => {
  const text = normalizeLower(userPrompt);
  if (!text) return false;
  const labelSignals = [
    'label says',
    'as per label',
    'on the label',
    'recommended dose',
    'dose on label',
    'label rate',
    'product label',
    'लेबल',
    'लॅबल',
    'लेबलवर',
  ];
  if (labelSignals.some(s => text.includes(s))) return true;
  const hasRate = /(?:\b\d+(\.\d+)?\s*(ml|g|kg|%)\b).*?(?:\bper\b|\b\/\b).*?(?:\b(l|litre|liter|ha|acre)\b)/i.test(text);
  return hasRate;
};

const anyRuleMatches = (text, patterns) => {
  if (!text) return false;
  return patterns.some((p) => {
    try {
      return p.test(text);
    } catch {
      return false;
    }
  });
};

export const PolicyEvaluator = {
  policy: AgAdvicePolicyV1,

  evaluate: ({ stage, userPrompt, outputText, jurisdiction, languageCode, contextTags = [] }) => {
    const policy = AgAdvicePolicyV1;
    const text = stage === 'pre' ? normalizeText(userPrompt) : normalizeText(outputText);
    const juris = normalizeJurisdiction(jurisdiction || policy.jurisdiction.default);
    const lang = (languageCode || 'en').toString().trim().toLowerCase();

    const userProvidedLabel = detectUserProvidedLabel(userPrompt);

    const matches = [];
    for (const rule of policy.rules) {
      if (!Array.isArray(rule.stage) || !rule.stage.includes(stage)) {
        continue;
      }
      if (!anyRuleMatches(text, rule.patterns || [])) {
        continue;
      }
      if (rule.requiresUserProvidedLabel && !userProvidedLabel) {
        matches.push(rule);
        continue;
      }
      if (!rule.requiresUserProvidedLabel) {
        matches.push(rule);
        continue;
      }
    }

    if (matches.length === 0) {
      return {
        ok: true,
        kind: 'allow',
        tags: [],
        jurisdiction: juris,
        languageCode: lang,
      };
    }

    const top = matches[0];
    return {
      ok: false,
      kind: top.kind || 'refuse',
      tags: Array.from(new Set([...(top.tags || []), ...contextTags])),
      message: safeT(top.messageKey || 'errors:ai.blocked_generic'),
      jurisdiction: juris,
      languageCode: lang,
      ruleId: top.id,
    };
  },
};
