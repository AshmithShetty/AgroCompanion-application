import { GuardrailsGate } from './GuardrailsGate';

export const GuardrailsService = {
  preCheck: ({ userPrompt, languageCode, sensorSnapshot, forecastSummary, jurisdiction, intent }) => {
    return GuardrailsGate.preCheck({ userPrompt, languageCode, sensorSnapshot, forecastSummary, jurisdiction, intent });
  },

  postCheck: ({ userPrompt, rawResponse, languageCode, jurisdiction }) => {
    return GuardrailsGate.postCheckText({ userPrompt, outputText: rawResponse, languageCode, jurisdiction });
  },
};
