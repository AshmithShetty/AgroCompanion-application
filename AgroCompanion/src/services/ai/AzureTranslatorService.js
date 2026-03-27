import { ConfigService } from '../../utils/ConfigService';

export const AzureTranslatorService = {
  translateArray: async (texts, targetLang) => {
    if (!texts || texts.length === 0) return [];
    
    const body = texts.map(t => ({ text: t }));
    const url = `${ConfigService.AZURE_TRANSLATOR_ENDPOINT}translate?api-version=3.0&to=${targetLang}`;
    
    console.log(`[AzureTranslator] HTTP POST to ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Ocp-Apim-Subscription-Key': ConfigService.AZURE_TRANSLATOR_KEY,
        'Ocp-Apim-Subscription-Region': ConfigService.AZURE_TRANSLATOR_REGION,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Translation failed: ${response.status}`);
    }

    const json = await response.json();
    return json.map(res => res.translations[0].text);
  }
};
