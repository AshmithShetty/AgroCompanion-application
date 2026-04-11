import { buildEmptyEnvelope } from './ActionSchema';

const normalizeText = (value) => (value || '').toString().trim();

const extractJsonCandidate = (rawText) => {
  const text = normalizeText(rawText);
  if (!text) return '';
  const startTag = '<AGRO_JSON>';
  const endTag = '</AGRO_JSON>';
  const start = text.indexOf(startTag);
  const end = text.lastIndexOf(endTag);
  if (start >= 0 && end > start) {
    return text.slice(start + startTag.length, end).trim();
  }
  const fenced = text.match(/```json\s*([\s\S]+?)```/i) || text.match(/```\s*([\s\S]+?)```/i);
  if (fenced?.[1]) {
    return fenced[1].trim();
  }
  return text.trim();
};

export const ActionEnvelope = {
  parse: (rawText) => {
    const candidate = extractJsonCandidate(rawText);
    if (!candidate) {
      return { ok: false, error: 'empty' };
    }
    try {
      const parsed = JSON.parse(candidate);
      if (!parsed || typeof parsed !== 'object') {
        return { ok: false, error: 'not_object' };
      }
      const envelope = {
        message: typeof parsed.message === 'string' ? parsed.message : '',
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
        meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : undefined,
      };
      return { ok: true, envelope };
    } catch {
      const text = normalizeText(candidate);
      const first = text.indexOf('{');
      const last = text.lastIndexOf('}');
      if (first !== -1 && last !== -1 && last > first) {
        try {
          const parsed = JSON.parse(text.slice(first, last + 1));
          const envelope = {
            message: typeof parsed.message === 'string' ? parsed.message : '',
            actions: Array.isArray(parsed.actions) ? parsed.actions : [],
            meta: parsed.meta && typeof parsed.meta === 'object' ? parsed.meta : undefined,
          };
          return { ok: true, envelope };
        } catch {
          return { ok: false, error: 'invalid_json' };
        }
      }
      return { ok: false, error: 'invalid_json' };
    }
  },

  formatForModel: () => {
    return `Return a single JSON object (no markdown) with this shape:\n${JSON.stringify(buildEmptyEnvelope('...'))}\nYou may also include an optional "meta" object.`;
  },
};
