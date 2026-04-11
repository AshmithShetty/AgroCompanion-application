import { WorkflowUtils } from './WorkflowUtils';

const normalize = (value) => (value || '').toString().trim().toLowerCase();

export const FertilizationWorkflow = {
  canHandle: (userPrompt) => {
    const t = normalize(userPrompt);
    return t.includes('fertil') || t.includes('urea') || t.includes('dap') || t.includes('npk') || t.includes('topdress') || t.includes('खाद') || t.includes('उर्वरक') || t.includes('यूरिया') || t.includes('खत') || t.includes('युरिया');
  },

  run: ({ sensorSnapshot, forecast }) => {
    const moisture = sensorSnapshot?.soil_moisture;
    const ph = sensorSnapshot?.soil_ph;
    const n = sensorSnapshot?.nitrogen;
    const p = sensorSnapshot?.phosphorus;
    const k = sensorSnapshot?.potassium;

    if ([moisture, ph, n, p, k].some(v => v === null || typeof v === 'undefined')) {
      return { ok: false, kind: 'clarify', code: 'missing_soil' };
    }

    const next48 = WorkflowUtils.summarizeNextHours(forecast, 48);
    const rainySoon = Number(next48.rainMm || 0) >= 5;
    const recommendedDate = WorkflowUtils.toDateKey(Date.now());

    const actions = [
      {
        type: 'create_task',
        title: 'Fertilizer decision with soil context',
        date: recommendedDate,
        priority: 'Medium',
        description: 'Review soil moisture, pH, and NPK. Use soil test/label guidance and local extension recommendations. Do not mix or dose chemicals without the product label and local agronomist confirmation.',
        source: 'workflow_fertilization',
      },
    ];

    if (rainySoon) {
      actions.push({
        type: 'create_task',
        title: 'Avoid fertilizer before heavy rain',
        date: recommendedDate,
        priority: 'High',
        description: 'Rain is expected soon. Avoid applying fertilizer immediately before heavy rain to reduce runoff and loss. Re-evaluate after rainfall.',
        source: 'workflow_fertilization',
      });
    }

    return {
      ok: true,
      facts: { moisture, ph, n, p, k, rainMm48h: next48.rainMm },
      actions,
      narrativeHint: rainySoon ? 'delay_due_to_rain' : 'review_and_apply_safely',
    };
  },
};

