import { AIService } from './AIService';
import { useUserSessionStore } from '../../store';
import { districtKnowledgeBase } from '../../data/districtKnowledgeBase';

export const YieldPredictorAgent = {
  predictYieldAndFinance: async (mandiPrices, forecastedPrices = null) => {
    const { currentFarm, currentSession } = useUserSessionStore.getState();
    const cropType = currentSession?.cropType || 'Unknown';
    const area = Number(currentFarm?.boundaryAreaHectares || 1);
    const districtName = currentFarm?.districtName || 'Unknown';
    const state = districtName !== 'Unknown' ? (districtKnowledgeBase[districtName.toLowerCase()]?.state || 'India') : 'India';
    
    const systemPrompt = `You are an expert Agricultural Economist and Yield Predictor.
Calculate the predicted harvest yield and net profit using STRICT mathematical logic based on the inputs provided. Do not invent arbitrary numbers.

CRITICAL AGRONOMIC AND ECONOMIC FORMULAS YOU MUST FOLLOW:
1. Predicted Yield (Quintals):
   Yield = Base Potential (Quintals/ha) * (1 - Pest/Disease Stress %) * (1 - Weather Stress %) * Farm Area (ha)
   (Assume base potential of 40 q/ha for Wheat/Rice, 600 q/ha for Sugarcane, 20 q/ha for Pulses, unless you know a better localized baseline).
2. Estimated Revenue:
   Gross Revenue = Predicted Yield * Predicted Price Per Quintal
3. Estimated Cost:
   Total Cost = Baseline Input Cost per Hectare * Farm Area (ha)
   (Assume average input cost of ~35,000 INR/ha for staples, adjust for crop type).
4. Net Profit = Gross Revenue - Total Cost

We have tools to mathematically calculate future price forecasts (Harvest, +1 Month, +2 Months) using historical seasonal indices. Use the 'get_market_price' tool to fetch current and forecasted prices for the crop. Your task is to analyze these fetched prices against the estimated production costs and recommend whether the farmer should sell immediately at harvest or store the crop. 

Output strictly as JSON. You MUST show your step-by-step mathematical calculations in calculation_log:
{
  "calculation_log": "Yield: 40q/ha * (1 - 0.05) * 2ha = 76q. Revenue: 76 * 2000 = 152000 INR...",
  "predictedYieldQuintals": number,
  "predictedPricePerQuintal": number,
  "estimatedRevenue": number,
  "estimatedCosts": number,
  "estimatedNetProfit": number,
  "confidenceScore": number,
  "reasoning": "string",
  "recommendation": "string",
  "priceTrends": [
    { "period": "string", "dateStr": "string", "predictedPrice": number, "trend": "up|down|stable" }
  ]
}`;

    const userPrompt = `Crop: ${cropType}
Farm Area: ${area.toFixed(2)} hectares
Location: ${districtName}, ${state}

Current Live Mandi Prices for ${cropType} in ${state}:
${JSON.stringify(mandiPrices, null, 2)}

Forecasted Future Prices:
${JSON.stringify(forecastedPrices, null, 2)}

Use the above REAL market data for your calculations. Do not use placeholder values.
Calculate the yield, revenue, costs, and profit. Provide a recommendation on whether to sell now or wait based on the price trends.`;

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, null, {
        expectJsonEnvelope: false,
        responseFormat: { type: 'json_object' },
        feature: 'yield_predictor',
        useTools: true
      });
      
      const cleaned = rawResponse.replace(/```json/g, '').replace(/```/g, '').trim();
      return JSON.parse(cleaned);
    } catch (e) {
      return null;
    }
  }
};
