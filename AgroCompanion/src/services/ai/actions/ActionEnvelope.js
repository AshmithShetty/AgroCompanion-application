import { buildEmptyEnvelope } from './ActionSchema';

const normalizeText = (value) => (value || '').toString().trim();

const buildExampleAction = (type) => {
  if (type === 'update_task') {
    return {
      type: 'update_task',
      task_id: 'task_id_here',
      patch: {
        date: 'YYYY-MM-DD (optional)',
        priority: 'High|Medium|Low (optional)',
        description: 'Only include fields you explicitly want to change. Leave out fields that should remain unmodified.',
      },
    };
  }
  if (type === 'delete_task') {
    return {
      type: 'delete_task',
      task_id: 'task_id_here',
    };
  }
  return buildEmptyEnvelope('...').actions[0];
};

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

  formatForModel: (options = {}) => {
    const allowedActionTypes = Array.isArray(options.allowedActionTypes) ? options.allowedActionTypes : ['create_task', 'update_task', 'delete_task'];
    const includeMeta = Boolean(options.includeMeta);
    const messagePlaceholder = typeof options.messagePlaceholder === 'string' ? options.messagePlaceholder : '...';
    const envelope = buildEmptyEnvelope(messagePlaceholder);

    if (allowedActionTypes.length === 0) {
      envelope.actions = [];
    } else {
      envelope.actions = allowedActionTypes.map(type => buildExampleAction(type));
    }

    if (includeMeta) {
      envelope.meta = { confidence: 'low|medium|high' };
    }

    return `Return only one JSON object wrapped in <AGRO_JSON> and </AGRO_JSON>. Do not write markdown or any other text. Shape: <AGRO_JSON>${JSON.stringify(envelope)}</AGRO_JSON>`;
  },
};
