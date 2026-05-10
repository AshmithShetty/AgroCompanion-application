import { AIService } from './AIService';
import { useUserSessionStore } from '../../store';

export const ImpactAgent = {
  analyzeImpact: async (actualEvents, baselineTotals, areaHectares) => {
    const { currentSession } = useUserSessionStore.getState();
    const cropType = currentSession?.cropType || 'Unknown';

const systemPrompt = `You are a Sustainability Impact Analysis Agent.
Use the 'get_impact_events' tool to fetch the real logged events and statistical baselines. Calculate the true sustainability impact based on these fetched values.

CRITICAL AGRONOMIC AND PHYSICS FORMULAS YOU MUST FOLLOW:
1. Difference Calculation:
   Savings = Baseline Expected - Actual Logged (If Actual > Baseline, Savings = 0)
2. Water Savings (Hydrology Standard):
   1 mm of irrigation depth = 10,000 Liters per Hectare
   Water Saved (Liters) = (Baseline mm - Actual mm) * 10,000 * Farm Area (ha)
3. CO2e Avoided (IPCC Standard):
   1 kg of synthetic Nitrogen (e.g., Urea is 46% N) = ~3.47 kg CO2e
   CO2e Avoided = (Baseline Nitrogen kg - Actual Nitrogen kg) * 3.47
   (If generic fertilizer, use 2.5 kg CO2e per kg as average).
   Pesticides = ~10 kg CO2e per kg of active ingredient.

Return STRICT JSON output calculating the differences accurately. 
IMPORTANT: If the user has not completed any tasks (resolvedTaskCount is 0), you should report 0 for all impact metrics as the session effectively has not started. Do not assume 'savings' just because usage is zero.
You MUST show your step-by-step math in calculation_log:
{
  "calculation_log": "Water: (20mm - 10mm) * 10000 * 2.5ha = 250000L...",
  "waterSavedL": number,
  "fertilizerReducedKg": number,
  "pesticideReducedG": number,
  "co2eAvoidedKg": number,
  "netIncomeChangeInr": number
}`;

    const safeEvents = (actualEvents || []).map(e => e._raw || e); // Kept for legacy compatibility if passed manually, but instruct AI to fetch.

    const userPrompt = `Crop: ${cropType}
Area Hectares: ${areaHectares}
Use your tools to fetch Actual Events Logged and Baseline Expected Totals.`;

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, null, {
        expectJsonEnvelope: false,
        responseFormat: { type: 'json_object' },
        feature: 'impact_agent',
        useTools: true
      });
      const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }
};
