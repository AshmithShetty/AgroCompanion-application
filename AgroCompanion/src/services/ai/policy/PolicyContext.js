import { useUserSessionStore } from '../../../store';
import { ConfigService } from '../../../utils/ConfigService';
import { RegionalAdvisoryPolicy } from './RegionalAdvisoryPolicy';

const normalizeJurisdiction = (value) => (value || '').toString().trim().toUpperCase();
const normalizeDistrictCode = (value) => (value || '').toString().trim().toLowerCase();

export const PolicyContext = {
  resolveContext: () => {
    const { currentFarm, currentSession } = useUserSessionStore.getState();
    const explicit = normalizeJurisdiction(currentFarm?.jurisdictionCode || currentFarm?.countryCode || '');
    const fromEnv = normalizeJurisdiction(ConfigService.DEFAULT_JURISDICTION || '');
    const jurisdiction = explicit || fromEnv || 'IN';
    const districtCode = normalizeDistrictCode(currentFarm?.districtCode || '');
    const districtLookup = districtCode || currentFarm?.districtName || '';
    const districtProfile = RegionalAdvisoryPolicy.getDistrictProfile(districtLookup);

    return {
      jurisdiction,
      districtCode: districtProfile?.id || districtCode || '',
      districtName: currentFarm?.districtName || districtProfile?.name || '',
      districtProfile,
      currentFarm: currentFarm || null,
      currentSession: currentSession || null,
    };
  },

  resolveJurisdiction: () => {
    return PolicyContext.resolveContext().jurisdiction;
  },

  resolveDistrictCode: () => PolicyContext.resolveContext().districtCode,

  resolveDistrictProfile: () => PolicyContext.resolveContext().districtProfile,

  buildRegionalPromptBlock: () => RegionalAdvisoryPolicy.buildPromptBlock(PolicyContext.resolveDistrictProfile()),
};
