import { useUserSessionStore } from '../../store';
import { LanguageService } from '../LanguageService';

export const ContextBuilder = {
  buildFarmContext: () => {
    const { currentSession, currentFarm, currentUser } = useUserSessionStore.getState();
    const langCode = LanguageService.getCurrentLanguage() || 'en';
    const languageMap = { en: 'English', hi: 'Hindi', kn: 'Kannada', mr: 'Marathi' };
    const language = languageMap[langCode] || 'English';
    const crop = currentSession?.cropType || 'Unknown Crop';
    const method = currentSession?.farmingMethod || 'Conventional';
    const soil = currentSession?.soilType || 'Unknown Soil';
    const farmContext = currentSession?.farmContextSnapshot || currentFarm?.farmContext || '';
    const district = currentFarm?.districtName || 'Unknown District';
    const area = Number(currentFarm?.boundaryAreaHectares || 0);

    let daysSinceStart = 0;
    if (currentSession?.startDate) {
      const start = new Date(currentSession.startDate).getTime();
      const now = Date.now();
      daysSinceStart = Math.max(0, Math.floor((now - start) / (1000 * 60 * 60 * 24)));
    }

    return `
      Current Farm State:
      - Farmer: ${currentUser?.username || 'User'}
      - Farm: ${currentFarm?.name || 'My Farm'}
      - District: ${district}
      - Area (hectares): ${area.toFixed(2)}
      - Crop: ${crop}
      - Stage: Day ${daysSinceStart} since start date
      - Soil Type: ${soil}
      - Method: ${method}
      - Farm Context: ${farmContext}
      - Language: ${language} (You MUST reply completely in ${language}. If you output JSON, do not translate JSON keys or action field names; keep them in English strictly.)
      - Actual Current Date: ${new Date().toISOString().split('T')[0]}
    `;
  }
};

export const ResponseFormatter = {
  format: (rawText) => {
    return rawText.trim();
  }
};

export const hashString = (str) => {
  let hash = 0;
  for (let i = 0, len = str.length; i < len; i++) {
      const chr = str.charCodeAt(i);
      hash = (hash << 5) - hash + chr;
      hash |= 0;
  }
  return hash.toString();
};
