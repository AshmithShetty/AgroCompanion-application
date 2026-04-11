import { ACTION_TYPES, PRIORITIES } from './ActionSchema';

const normalizeText = (value) => (value || '').toString().trim();

const toDateKey = (value) => {
  if (!value || typeof value !== 'string') return null;
  const s = value.includes('T') ? value.split('T')[0] : value.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
};

const todayKey = () => {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const addDays = (dateKey, days) => {
  const [y, m, d] = dateKey.split('-').map(n => Number(n));
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + Number(days || 0));
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
};

const isPastDate = (dateKey) => {
  const t = todayKey();
  return dateKey < t;
};

const withinHorizon = (dateKey, horizonDays) => {
  const limit = addDays(todayKey(), horizonDays);
  return dateKey <= limit;
};

const normalizePriority = (value) => {
  const s = normalizeText(value);
  if (!s) return null;
  const exact = PRIORITIES.find(p => p.toLowerCase() === s.toLowerCase());
  return exact || null;
};

const normalizePatch = (patch) => {
  if (!patch || typeof patch !== 'object') return null;
  const out = {};
  if (patch.title !== undefined) out.title = String(patch.title);
  if (patch.date !== undefined) out.date = String(patch.date);
  if (patch.priority !== undefined) out.priority = String(patch.priority);
  if (patch.description !== undefined) out.description = String(patch.description);
  return out;
};

const normalizeLower = (value) => normalizeText(value).toLowerCase();

const containsAny = (text, needles) => needles.some(n => text.includes(n));

const isTimingSensitive = (text) => {
  const t = normalizeLower(text);
  const en = ['fertil', 'urea', 'dap', 'npk', 'spray', 'pesticide', 'fungicide', 'herbicide', 'apply', 'topdress', 'irrigat', 'drip'];
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
  const missingAny = [moisture, ph, nitrogen, phosphorus, potassium].some(v => v === null || typeof v === 'undefined');
  return missingAny;
};

const forecastUnavailable = (forecastSummary) => {
  const s = normalizeLower(forecastSummary);
  return !s || s.includes('unavailable') || s.includes('no forecast') || s.includes('no forecast data');
};

export const ActionValidator = {
  validateEnvelope: ({ envelope, context }) => {
    const errors = [];
    if (!envelope || typeof envelope !== 'object') {
      return { ok: false, errors: ['envelope_missing'] };
    }

    const message = typeof envelope.message === 'string' ? envelope.message : '';
    const actions = Array.isArray(envelope.actions) ? envelope.actions : [];

    const maxActions = Number(context?.maxActions ?? 3);
    if (actions.length > maxActions) {
      errors.push('actions_too_many');
    }

    const horizonDays = Number(context?.horizonDays ?? 180);
    const strict = Boolean(context?.strict);
    const sensorSnapshot = context?.sensorSnapshot || null;
    const forecastSummary = context?.forecastSummary || '';
    const enforceTimingContext = Boolean(context?.enforceTimingContext);

    const normalized = { message, actions: [] };
    const criticalErrors = [];

    for (const action of actions) {
      if (!action || typeof action !== 'object') {
        if (strict) criticalErrors.push('action_not_object');
        continue;
      }

      const type = normalizeText(action.type);
      if (![ACTION_TYPES.CREATE_TASK, ACTION_TYPES.UPDATE_TASK, ACTION_TYPES.DELETE_TASK].includes(type)) {
        if (strict) criticalErrors.push('action_type_invalid');
        continue;
      }

      if (type === ACTION_TYPES.CREATE_TASK) {
        const title = normalizeText(action.title || action.task);
        const dateKey = toDateKey(action.date);
        const priority = normalizePriority(action.priority) || 'Medium';
        const description = normalizeText(action.description);

        const actionErrors = [];
        if (!title) actionErrors.push('create_task_title_missing');
        if (!dateKey) actionErrors.push('create_task_date_invalid');
        if (dateKey && isPastDate(dateKey)) actionErrors.push('create_task_date_past');
        if (dateKey && !withinHorizon(dateKey, horizonDays)) actionErrors.push('create_task_date_outside_horizon');
        if (!description) actionErrors.push('create_task_description_missing');

        if (enforceTimingContext) {
          const sensitive = isTimingSensitive(`${title} ${description}`);
          if (sensitive && missingCriticalSoilSignals(sensorSnapshot)) {
            actionErrors.push('missing_soil_context');
          }
          if (sensitive && forecastUnavailable(forecastSummary)) {
            actionErrors.push('missing_forecast_context');
          }
        }

        if (actionErrors.length > 0) {
          errors.push(...actionErrors);
          if (strict) criticalErrors.push(...actionErrors);
          continue;
        }

        normalized.actions.push({
          type,
          title,
          date: dateKey,
          priority,
          description,
          source: action.source ? String(action.source) : null,
        });
      }

      if (type === ACTION_TYPES.UPDATE_TASK) {
        const taskId = normalizeText(action.task_id || action.taskId);
        const patch = normalizePatch(action.patch);
        const actionErrors = [];
        if (!taskId) actionErrors.push('update_task_id_missing');
        if (!patch) actionErrors.push('update_task_patch_invalid');

        if (patch?.date) {
          const dk = toDateKey(patch.date);
          if (!dk) actionErrors.push('update_task_date_invalid');
          if (dk && isPastDate(dk)) actionErrors.push('update_task_date_past');
          if (dk && !withinHorizon(dk, horizonDays)) actionErrors.push('update_task_date_outside_horizon');
          patch.date = dk;
        }

        if (patch?.priority) {
          const pr = normalizePriority(patch.priority);
          if (!pr) actionErrors.push('update_task_priority_invalid');
          patch.priority = pr;
        }

        if (actionErrors.length > 0) {
          errors.push(...actionErrors);
          if (strict) criticalErrors.push(...actionErrors);
          continue;
        }

        normalized.actions.push({ type, task_id: taskId, patch });
      }

      if (type === ACTION_TYPES.DELETE_TASK) {
        const taskId = normalizeText(action.task_id || action.taskId);
        if (!taskId) {
          errors.push('delete_task_id_missing');
          if (strict) criticalErrors.push('delete_task_id_missing');
          continue;
        }
        normalized.actions.push({ type, task_id: taskId });
      }
    }

    if (strict && criticalErrors.length > 0) {
      return { ok: false, errors: criticalErrors, envelope: normalized };
    }

    if (normalized.actions.length === 0 && actions.length > 0) {
      return { ok: false, errors: errors.length > 0 ? errors : ['all_actions_invalid'], envelope: normalized };
    }

    return { ok: true, errors, envelope: normalized };
  },
};

