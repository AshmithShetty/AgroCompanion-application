import { WorkflowUtils } from './WorkflowUtils';

const normalize = (value) => (value || '').toString().trim().toLowerCase();

export const IrrigationWorkflow = {
  canHandle: (userPrompt) => {
    const t = normalize(userPrompt);
    return t.includes('irrig') || t.includes('watering') || t.includes('water ') || t.includes('drip') || t.includes('सिंच') || t.includes('पाणी');
  },

  run: ({ userPrompt, sensorSnapshot, forecast }) => {
    const moisture = sensorSnapshot?.soil_moisture;
    if (moisture === null || typeof moisture === 'undefined') {
      return { ok: false, kind: 'clarify', code: 'missing_soil' };
    }
    const summary = WorkflowUtils.summarizeNextHours(forecast, 24);
    const rainMm = Number(summary.rainMm || 0);
    const recommendedDate = WorkflowUtils.toDateKey(Date.now());

    const lowMoisture = Number(moisture) < 30;
    const wetEnough = Number(moisture) >= 45;
    const rainySoon = rainMm >= 2;

    if (wetEnough) {
      return {
        ok: true,
        facts: { moisture, rainMm },
        actions: [],
        narrativeHint: 'hold_irrigation',
      };
    }

    if (lowMoisture && !rainySoon) {
      return {
        ok: true,
        facts: { moisture, rainMm },
        actions: [
          {
            type: 'create_task',
            title: 'Irrigation check and apply',
            date: recommendedDate,
            priority: 'High',
            description: 'Check field moisture and irrigate to avoid crop stress. Follow local recommended practice and avoid over-irrigation.',
            source: 'workflow_irrigation',
          },
        ],
        narrativeHint: 'irrigate_now',
      };
    }

    if (rainySoon) {
      return {
        ok: true,
        facts: { moisture, rainMm },
        actions: [
          {
            type: 'create_task',
            title: 'Pause irrigation and monitor',
            date: recommendedDate,
            priority: 'Medium',
            description: 'Rain is expected soon. Pause irrigation and re-check soil moisture after rainfall before applying water.',
            source: 'workflow_irrigation',
          },
        ],
        narrativeHint: 'pause_due_to_rain',
      };
    }

    return {
      ok: true,
      facts: { moisture, rainMm },
      actions: [
        {
          type: 'create_task',
          title: 'Monitor soil moisture',
          date: recommendedDate,
          priority: 'Low',
          description: 'Re-check soil moisture and crop condition before deciding the next irrigation.',
          source: 'workflow_irrigation',
        },
      ],
      narrativeHint: 'monitor',
    };
  },
};

