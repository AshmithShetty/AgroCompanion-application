import { AIService } from './AIService';
import { InventoryRepository } from '../inventory/InventoryRepository';
import { useUserSessionStore } from '../../store';

export const InventoryAgent = {
  processTasksForInventory: async (tasks) => {
    if (!Array.isArray(tasks) || tasks.length === 0) return;
    
    const { currentFarm } = useUserSessionStore.getState();
    const area = Number(currentFarm?.boundaryAreaHectares || 1);

    const systemPrompt = `You are a strict Agricultural Inventory extraction agent.
Analyze the provided list of tasks. Determine if any fertilizer, pesticide, or seed is required to execute them.

CRITICAL AGRONOMIC FORMULAS YOU MUST FOLLOW:
1. Direct Dry Application (e.g., kg/ha):
   Total Required = Rate (per ha) * Farm Area (ha)
2. Foliar Spray (Percentage Concentration):
   Total Required (L or kg) = (Concentration % / 100) * Spray Volume (L/ha) * Farm Area (ha)
   Example: "2% at 500 L/ha" = 0.02 * 500 * Farm Area.

Farm Area for this calculation is exactly: ${area.toFixed(2)} hectares.

Output STRICTLY as a JSON object with a "calculation_log" (showing your step-by-step math for each item) and an "items" array:
{
  "calculation_log": "Item 1: 120 kg/ha * 2.5 ha = 300 kg...",
  "items": [
    { "itemName": "Urea", "deductQuantity": 300 }
  ]
}
}
Use the 'get_inventory' tool to fetch the current inventory.`;

    const userPrompt = tasks.map(t => `Task Title: ${t.title}\nDescription: ${t.description}`).join('\n\n');

    try {
      const rawResponse = await AIService.generateResponse(systemPrompt, userPrompt, null, {
        expectJsonEnvelope: false,
        responseFormat: { type: 'json_object' },
        feature: 'inventory_agent',
        useTools: true
      });
      
      const match = rawResponse.match(/\{[\s\S]*\}/);
      if (match) {
        const payload = JSON.parse(match[0]);
        console.log('[InventoryAgent] Calculation Log:', payload.calculation_log);
        if (Array.isArray(payload.items)) {
          for (const item of payload.items) {
            await InventoryRepository.deductStock(item.itemName, item.deductQuantity);
          }
        }
      } else {
        console.log('Inventory deduction failed: no JSON object found in response');
      }
    } catch (e) {
      console.log('Inventory deduction failed', e);
    }
  }
};
