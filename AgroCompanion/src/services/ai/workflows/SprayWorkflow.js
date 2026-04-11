import { WorkflowUtils } from './WorkflowUtils';

const normalize = (value) => (value || '').toString().trim().toLowerCase();

export const SprayWorkflow = {
  canHandle: (userPrompt) => {
    const t = normalize(userPrompt);
    return t.includes('spray') || t.includes('pesticide') || t.includes('fungicide') || t.includes('herbicide') || t.includes('insecticide') || t.includes('छिड़क') || t.includes('स्प्रे') || t.includes('फवार') || t.includes('स्प्रे');
  },

  run: ({ forecast }) => {
    if (!forecast || !Array.isArray(forecast?.list) || forecast.list.length === 0) {
      return { ok: false, kind: 'clarify', code: 'missing_forecast' };
    }

    const bestDate = WorkflowUtils.pickBestWindowDate(forecast, { maxRainMm: 1, maxWind: 6 });
    const next24 = WorkflowUtils.summarizeNextHours(forecast, 24);

    const actions = [
      {
        type: 'create_task',
        title: 'Spray timing check',
        date: bestDate,
        priority: 'High',
        description: 'Choose a calm, dry window. Avoid spraying during rain or strong wind. Follow label directions and local extension guidance; do not provide or follow mixing/dosage instructions without the product label.',
        source: 'workflow_spray',
      },
    ];

    return {
      ok: true,
      facts: { bestDate, rainMm24h: next24.rainMm, maxWind24h: next24.maxWind },
      actions,
      narrativeHint: 'spray_window',
    };
  },
};

