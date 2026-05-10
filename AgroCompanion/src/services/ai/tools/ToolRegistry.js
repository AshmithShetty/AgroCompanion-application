import { PriceForecastingService } from '../../market/PriceForecastingService';
import { WeatherService } from '../../../services/external/WeatherService';
import { InventoryRepository } from '../../../services/inventory/InventoryRepository';
import { MarketDataService } from '../../../services/market/MarketDataService';
import { SchemeService } from '../../../services/market/SchemeService';
import { SensorHistoryService } from '../../../services/iot/SensorHistoryService';
import { useUserSessionStore } from '../../../store';

export const ToolRegistry = {
  getToolsDefinition: () => [
    {
      type: 'function',
      function: {
        name: 'get_market_price',
        description: 'Fetch the predicted market price for a specific crop on a specific future or past date.',
        parameters: {
          type: 'object',
          properties: {
            date: {
              type: 'string',
              description: 'The target date in YYYY-MM-DD format. Required.',
            },
            cropType: {
              type: 'string',
              description: 'The name of the crop. Required.',
            }
          },
          required: ['date', 'cropType']
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_weather_forecast',
        description: 'Fetch the 5-day weather forecast for the user\'s farm location.',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_inventory',
        description: 'Fetch the current farm inventory and supplies (e.g., seeds, fertilizers, pesticides).',
        parameters: {
          type: 'object',
          properties: {},
          required: []
        }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_government_schemes',
        description: 'Fetch eligible government schemes and subsidies for the farmer.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_sustainability_impact',
        description: 'Fetch the farm\'s sustainability and environmental impact metrics.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_user_and_farm_details',
        description: 'Fetch the details of the user and their farm (like crop type, area, location, soil details).',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_recent_tasks',
        description: 'Fetch all tasks for the farm, including past, present, and future ones.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_sensor_averages',
        description: 'Fetch the 7-day average values from the farm sensors.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_impact_events',
        description: 'Fetch the actual impact events logged and the baseline expected totals.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    },
    {
      type: 'function',
      function: {
        name: 'get_workflow_facts',
        description: 'Fetch the current workflow facts for the active query.',
        parameters: { type: 'object', properties: {}, required: [] }
      }
    }
  ],

  executeTool: async (toolCall) => {
    const functionName = toolCall.function.name;
    let args = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch (e) {
      return { error: 'Invalid arguments format JSON' };
    }

    try {
      if (functionName === 'get_market_price') {
        const { date, cropType } = args;
        const { currentFarm, currentSession } = useUserSessionStore.getState();
        const state = currentFarm?.stateName || currentFarm?.state || '';
        const district = currentFarm?.districtName || '';
        
        const prices = await MarketDataService.getMandiPrices(cropType, state, district);
        let currentLivePrice = 2000; // Fallback
        if (prices && prices.length > 0) {
          const modalPrices = prices.map(p => Number(p.modal_price)).filter(p => !isNaN(p) && p > 0);
          if (modalPrices.length > 0) {
            currentLivePrice = Math.max(...modalPrices);
          }
        }

        const plantingDate = currentSession?.startDate || currentSession?.createdAt || new Date().toISOString();
        const forecasts = PriceForecastingService.getForecasts(currentLivePrice, cropType, plantingDate, date);
        
        return { 
          targetDate: date,
          crop: cropType,
          forecasts: forecasts,
          note: `Base price calculated from live Mandi data: ${currentLivePrice} INR/Quintal`
        };
      }

      if (functionName === 'get_weather_forecast') {
        const { currentFarm } = useUserSessionStore.getState();
        const lat = Number(currentFarm?.latitude);
        const lon = Number(currentFarm?.longitude);
        if (!lat || !lon) return { error: 'Farm location not set.' };
        const forecast = await WeatherService.getForecast(lat, lon);
        return forecast;
      }

      if (functionName === 'get_inventory') {
        const inventory = await InventoryRepository.getInventory();
        return inventory.map(i => ({
          id: i.id,
          itemName: i.itemName,
          category: i.category,
          quantity: i.quantity,
          unit: i.unit,
          status: i.status
        }));
      }

      if (functionName === 'get_government_schemes') {
        const { currentFarm, currentSession } = useUserSessionStore.getState();
        const state = currentFarm?.stateName || currentFarm?.state || '';
        const crop = currentSession?.cropType || '';
        return await SchemeService.getEligibleSchemes(state, crop);
      }

      if (functionName === 'get_sustainability_impact') {
        const { MetricsCalculator } = require('../../../services/analytics/MetricsCalculator');
        const impact = await MetricsCalculator.calculateImpact();
        return {
          waterSavedLiters: impact.waterSavedL,
          chemicalReductionPercentage: impact.chemicalSavedPct,
          carbonFootprintReductionKg: impact.co2AvoidedKg,
          overallSustainabilityRating: impact.rating
        };
      }

      if (functionName === 'get_user_and_farm_details') {
        const { currentUser, currentFarm, currentSession } = useUserSessionStore.getState();
        return {
          user: currentUser ? { name: currentUser.name, phone: currentUser.phoneNumber } : null,
          farm: currentFarm ? { 
            name: currentFarm.name, 
            areaHectares: currentFarm.boundaryAreaHectares, 
            state: currentFarm.stateName || currentFarm.state, 
            district: currentFarm.districtName 
          } : null,
          session: currentSession ? { 
            cropType: currentSession.cropType, 
            plantingDate: currentSession.createdAt 
          } : null
        };
      }

      if (functionName === 'get_recent_tasks') {
        const { TaskRepository } = require('../../../services/TaskRepository');
        const tasks = await TaskRepository.getAllTasks();
        return tasks.map(t => ({
          id: t.id,
          title: t.title,
          description: t.description,
          date: t.date,
          status: t.status,
          priority: t.priority,
          source: t.source
        }));
      }

      if (functionName === 'get_sensor_averages') {
        const averages = await SensorHistoryService.get7DayAverages();
        return {
          soilMoisture: averages.soil_moisture || null,
          temperature: averages.temperature || null,
          humidity: averages.humidity || null,
          nitrogen: averages.nitrogen || null,
          phosphorus: averages.phosphorus || null,
          potassium: averages.potassium || null,
          capturedAt: new Date().toISOString()
        };
      }

      if (functionName === 'get_impact_events') {
        const { MetricsCalculator } = require('../../../services/analytics/MetricsCalculator');
        const rawData = await MetricsCalculator.getRawImpactData();
        const carbonBaseline = await MetricsCalculator.getCarbonBaseline();
        return {
          events: rawData.events,
          baselines: {
            waterLiters: rawData.baselineTotals?.irrigationL || 0,
            chemicalKg: (rawData.baselineTotals?.fertilizerKg || 0) + (rawData.baselineTotals?.pesticideG || 0) / 1000,
            carbonKg: carbonBaseline
          },
          resolvedTaskCount: rawData.resolvedTaskCount
        };
      }

      if (functionName === 'get_workflow_facts') {
        const { WorkflowRouter } = require('../workflows/WorkflowRouter');
        const { currentFarm } = useUserSessionStore.getState();
        const lat = Number(currentFarm?.latitude);
        const lon = Number(currentFarm?.longitude);
        
        let forecast = null;
        if (Number.isFinite(lat) && Number.isFinite(lon)) {
          try { forecast = await WeatherService.getForecast(lat, lon); } catch {}
        }
        
        const wf = WorkflowRouter.pick(useUserSessionStore.getState().currentQuery || '');
        if (wf) {
          const result = wf.run({ forecast });
          return {
            activeWorkflow: wf.name || 'Generic',
            facts: result.facts || {},
            hint: result.narrativeHint || "No active diagnostic workflow detected."
          };
        }
        return { activeWorkflow: 'None', facts: {}, hint: "No active diagnostic workflow detected." };
      }

      return { error: `Unknown tool function: ${functionName}` };
    } catch (error) {
      return { error: error.message };
    }
  }
};
