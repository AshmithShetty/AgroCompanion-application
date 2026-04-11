import { useUserSessionStore } from '../../../store';
import { ConfigService } from '../../../utils/ConfigService';

const normalizeJurisdiction = (value) => (value || '').toString().trim().toUpperCase();

export const PolicyContext = {
  resolveJurisdiction: () => {
    const { currentFarm } = useUserSessionStore.getState();
    const explicit = normalizeJurisdiction(currentFarm?.jurisdictionCode || currentFarm?.countryCode || '');
    const fromEnv = normalizeJurisdiction(ConfigService.DEFAULT_JURISDICTION || '');
    const fallback = 'IN';
    return explicit || fromEnv || fallback;
  },
};

