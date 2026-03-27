import { database } from '../../database';
import { Q } from '@nozbe/watermelondb';
import { useUserSessionStore } from '../../store';
import { CacheManager } from '../CacheManager';
import { ImpactFactors } from './ImpactFactors';

const DAY_MS = 24 * 60 * 60 * 1000;

const getActiveScope = () => {
  const { currentUser, currentFarm, currentSession } = useUserSessionStore.getState();
  return {
    userId: currentUser?.id || null,
    farmId: currentFarm?.id || null,
    sessionId: currentSession?.id || null,
  };
};

const resolveScope = (scope = {}) => {
  const activeScope = getActiveScope();
  return {
    userId: scope.userId ?? activeScope.userId,
    farmId: scope.farmId ?? activeScope.farmId,
    sessionId: scope.sessionId ?? activeScope.sessionId,
  };
};

const buildScopeQueries = ({ userId, farmId, sessionId }) => {
  const queries = [];

  if (userId) {
    queries.push(Q.where('user_id', userId));
  }

  if (farmId) {
    queries.push(Q.where('farm_id', farmId));
  }

  if (sessionId) {
    queries.push(Q.where('session_id', sessionId));
  }

  return queries;
};

const toMs = (value) => {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    const ms = value.getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

const clamp0 = (value) => Math.max(0, Number(value || 0));

const roundTo = (value, digits = 0) => {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }
  const factor = Math.pow(10, digits);
  return Math.round(num * factor) / factor;
};

const median = (values) => {
  const arr = (values || []).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  if (arr.length === 0) {
    return null;
  }
  const mid = Math.floor(arr.length / 2);
  if (arr.length % 2 === 1) {
    return arr[mid];
  }
  return (arr[mid - 1] + arr[mid]) / 2;
};

const defaultUnitForType = (type) => {
  switch (type) {
    case 'irrigation':
      return 'L';
    case 'fertilizer':
      return 'kg';
    case 'pesticide':
      return 'g';
    case 'fuel':
      return 'L';
    case 'electricity':
      return 'kWh';
    case 'sale':
      return 'INR';
    default:
      return '';
  }
};

const normalizeType = (value) => (value || '').toString().trim().toLowerCase();

const parseNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const aggregateEvents = (events, sessionStartMs = null, sessionEndMs = null) => {
  const sums = {
    irrigationL: 0,
    fertilizerKg: 0,
    pesticideG: 0,
    dieselL: 0,
    electricityKwh: 0,
    revenueInr: 0,
    costsInr: 0,
  };

  for (const event of events || []) {
    const type = normalizeType(event?.type);
    const unit = (event?.unit || defaultUnitForType(type)).toString();
    const quantity = parseNumber(event?.quantity);
    const costInInr = event?.costInInr === null || event?.costInInr === undefined ? 0 : parseNumber(event.costInInr);
    const recordedAtMs = toMs(event?.recordedAt) || toMs(event?._raw?.recorded_at) || null;

    if (sessionStartMs && recordedAtMs && recordedAtMs < sessionStartMs) {
      continue;
    }
    if (sessionEndMs && recordedAtMs && recordedAtMs > sessionEndMs) {
      continue;
    }

    if (costInInr > 0) {
      sums.costsInr += costInInr;
    }

    if (type === 'irrigation' && unit.toLowerCase() === 'l') {
      sums.irrigationL += quantity;
    } else if (type === 'fertilizer' && unit.toLowerCase() === 'kg') {
      sums.fertilizerKg += quantity;
    } else if (type === 'pesticide' && unit.toLowerCase() === 'g') {
      sums.pesticideG += quantity;
    } else if (type === 'fuel' && unit.toLowerCase() === 'l') {
      sums.dieselL += quantity;
    } else if (type === 'electricity' && unit.toLowerCase() === 'kwh') {
      sums.electricityKwh += quantity;
    } else if (type === 'sale' && unit.toLowerCase() === 'inr') {
      sums.revenueInr += quantity;
    }
  }

  return sums;
};

const computeCo2eKg = ({ dieselL, electricityKwh }) => {
  const diesel = parseNumber(dieselL) * ImpactFactors.dieselKgCo2ePerLiter;
  const electricity = parseNumber(electricityKwh) * ImpactFactors.electricityKgCo2ePerKwh;
  return diesel + electricity;
};

const computeAgeDays = (session) => {
  const startMs = toMs(session?.startDate);
  if (!startMs) {
    return 1;
  }
  return Math.max(1, Math.floor((Date.now() - startMs) / DAY_MS) + 1);
};

const safeAreaHectares = (farm) => {
  const area = Number(farm?.boundaryAreaHectares || 0);
  return Number.isFinite(area) && area > 0 ? area : 1;
};

const pickBaselineSessions = ({ sessions, cropType, farmingMethod }) => {
  const safeCrop = (cropType || '').toString().trim().toLowerCase();
  const safeMethod = (farmingMethod || '').toString().trim().toLowerCase();

  const cropAndMethod = sessions.filter(s => (s?.cropType || '').toString().trim().toLowerCase() === safeCrop
    && (s?.farmingMethod || '').toString().trim().toLowerCase() === safeMethod);
  if (cropAndMethod.length > 0) {
    return cropAndMethod;
  }

  const cropOnly = sessions.filter(s => (s?.cropType || '').toString().trim().toLowerCase() === safeCrop);
  if (cropOnly.length > 0) {
    return cropOnly;
  }

  return sessions;
};

const buildBaseline = async ({ resolvedScope, currentSession, currentFarm, currentAgeDays }) => {
  const sessionCollection = database.get('sessions');
  const eventCollection = database.get('impact_events');
  const farmId = currentSession?.farmId || resolvedScope.farmId;

  if (!farmId) {
    return { sessionsUsed: 0, baselineTotals: null };
  }

  const sessions = await sessionCollection.query(Q.where('farm_id', farmId)).fetch();
  const candidates = sessions.filter(s => s?.id && s.id !== resolvedScope.sessionId);
  if (candidates.length === 0) {
    return { sessionsUsed: 0, baselineTotals: null };
  }

  const baselineSessions = pickBaselineSessions({
    sessions: candidates,
    cropType: currentSession?.cropType,
    farmingMethod: currentSession?.farmingMethod,
  });

  const areaHa = safeAreaHectares(currentFarm);
  const windowDays = Number.isFinite(Number(currentAgeDays)) ? Number(currentAgeDays) : 1;

  const perHa = {
    irrigationL: [],
    fertilizerKg: [],
    pesticideG: [],
    dieselL: [],
    electricityKwh: [],
    netIncomeInr: [],
  };

  let sessionsUsed = 0;

  for (const session of baselineSessions.slice(0, 12)) {
    const startMs = toMs(session?.startDate);
    const windowEndMs = startMs ? startMs + windowDays * DAY_MS : null;
    const events = await eventCollection.query(
      Q.where('farm_id', farmId),
      Q.where('session_id', session.id),
      ...(resolvedScope.userId ? [Q.where('user_id', resolvedScope.userId)] : []),
      Q.sortBy('recorded_at', Q.desc)
    ).fetch();

    if (!events || events.length === 0) {
      continue;
    }

    const totals = aggregateEvents(events, startMs, windowEndMs);
    const hasAny = totals.irrigationL || totals.fertilizerKg || totals.pesticideG || totals.dieselL || totals.electricityKwh || totals.revenueInr || totals.costsInr;
    if (!hasAny) {
      continue;
    }

    sessionsUsed += 1;
    if (totals.irrigationL > 0) {
      perHa.irrigationL.push(totals.irrigationL / areaHa);
    }
    if (totals.fertilizerKg > 0) {
      perHa.fertilizerKg.push(totals.fertilizerKg / areaHa);
    }
    if (totals.pesticideG > 0) {
      perHa.pesticideG.push(totals.pesticideG / areaHa);
    }
    if (totals.dieselL > 0) {
      perHa.dieselL.push(totals.dieselL / areaHa);
    }
    if (totals.electricityKwh > 0) {
      perHa.electricityKwh.push(totals.electricityKwh / areaHa);
    }
    if (totals.revenueInr > 0 || totals.costsInr > 0) {
      perHa.netIncomeInr.push((totals.revenueInr - totals.costsInr) / areaHa);
    }
  }

  if (sessionsUsed === 0) {
    return { sessionsUsed: 0, baselineTotals: null };
  }

  const baselinePerHa = {
    irrigationL: median(perHa.irrigationL),
    fertilizerKg: median(perHa.fertilizerKg),
    pesticideG: median(perHa.pesticideG),
    dieselL: median(perHa.dieselL),
    electricityKwh: median(perHa.electricityKwh),
    netIncomeInr: median(perHa.netIncomeInr),
  };

  const baselineTotals = {
    irrigationL: baselinePerHa.irrigationL === null ? null : baselinePerHa.irrigationL * areaHa,
    fertilizerKg: baselinePerHa.fertilizerKg === null ? null : baselinePerHa.fertilizerKg * areaHa,
    pesticideG: baselinePerHa.pesticideG === null ? null : baselinePerHa.pesticideG * areaHa,
    dieselL: baselinePerHa.dieselL === null ? null : baselinePerHa.dieselL * areaHa,
    electricityKwh: baselinePerHa.electricityKwh === null ? null : baselinePerHa.electricityKwh * areaHa,
    netIncomeInr: baselinePerHa.netIncomeInr === null ? null : baselinePerHa.netIncomeInr * areaHa,
  };

  return { sessionsUsed, baselineTotals };
};

export const MetricsCalculator = {
  calculateImpact: async (scope = {}) => {
    const resolvedScope = resolveScope(scope);
    const sessionId = resolvedScope.sessionId;

    if (!sessionId) {
      return {
        sessionId: null,
        baselineSessionsUsed: 0,
        waterSavedL: null,
        waterUsedL: 0,
        fertilizerReducedKg: null,
        fertilizerUsedKg: 0,
        pesticideReducedG: null,
        pesticideUsedG: 0,
        co2eAvoidedKg: null,
        co2eActualKg: 0,
        netIncomeChangeInr: null,
        netIncomeInr: 0,
      };
    }

    const cacheKey = `impact_metrics:${sessionId}`;
    const cached = await CacheManager.getValidCache(cacheKey);
    if (cached) {
      return cached;
    }

    const { currentSession, currentFarm } = useUserSessionStore.getState();
    let session = currentSession?.id === sessionId ? currentSession : null;
    if (!session) {
      try {
        session = await database.get('sessions').find(sessionId);
      } catch (e) {
        session = null;
      }
    }

    const farmId = resolvedScope.farmId || session?.farmId || null;
    let farm = currentFarm?.id && farmId && currentFarm.id === farmId ? currentFarm : null;
    if (!farm && farmId) {
      try {
        farm = await database.get('farms').find(farmId);
      } catch (e) {
        farm = null;
      }
    }

    const startMs = toMs(session?.startDate);
    const ageDays = computeAgeDays(session);

    const eventCollection = database.get('impact_events');
    const events = await eventCollection.query(
      ...buildScopeQueries({ ...resolvedScope, farmId, sessionId }),
      Q.sortBy('recorded_at', Q.desc)
    ).fetch();

    const actualTotals = aggregateEvents(events, startMs, null);
    const actualCo2eKg = computeCo2eKg({ dieselL: actualTotals.dieselL, electricityKwh: actualTotals.electricityKwh });
    const netIncomeInr = actualTotals.revenueInr - actualTotals.costsInr;

    const { sessionsUsed, baselineTotals } = await buildBaseline({
      resolvedScope: { ...resolvedScope, farmId },
      currentSession: session,
      currentFarm: farm,
      currentAgeDays: ageDays,
    });

    const baselineCo2eKg = baselineTotals
      ? computeCo2eKg({ dieselL: baselineTotals.dieselL || 0, electricityKwh: baselineTotals.electricityKwh || 0 })
      : null;

    const waterSavedL = baselineTotals?.irrigationL === null || baselineTotals?.irrigationL === undefined
      ? null
      : clamp0(baselineTotals.irrigationL - actualTotals.irrigationL);

    const fertilizerReducedKg = baselineTotals?.fertilizerKg === null || baselineTotals?.fertilizerKg === undefined
      ? null
      : clamp0(baselineTotals.fertilizerKg - actualTotals.fertilizerKg);

    const pesticideReducedG = baselineTotals?.pesticideG === null || baselineTotals?.pesticideG === undefined
      ? null
      : clamp0(baselineTotals.pesticideG - actualTotals.pesticideG);

    const co2eAvoidedKg = baselineCo2eKg === null || baselineCo2eKg === undefined
      ? null
      : clamp0(baselineCo2eKg - actualCo2eKg);

    const netIncomeChangeInr = baselineTotals?.netIncomeInr === null || baselineTotals?.netIncomeInr === undefined
      ? null
      : (netIncomeInr - baselineTotals.netIncomeInr);

    const result = {
      sessionId,
      baselineSessionsUsed: sessionsUsed,
      waterSavedL: waterSavedL === null ? null : roundTo(waterSavedL, 0),
      waterUsedL: roundTo(actualTotals.irrigationL, 0),
      fertilizerReducedKg: fertilizerReducedKg === null ? null : roundTo(fertilizerReducedKg, 2),
      fertilizerUsedKg: roundTo(actualTotals.fertilizerKg, 2),
      pesticideReducedG: pesticideReducedG === null ? null : roundTo(pesticideReducedG, 0),
      pesticideUsedG: roundTo(actualTotals.pesticideG, 0),
      co2eAvoidedKg: co2eAvoidedKg === null ? null : roundTo(co2eAvoidedKg, 2),
      co2eActualKg: roundTo(actualCo2eKg, 2),
      netIncomeChangeInr: netIncomeChangeInr === null ? null : roundTo(netIncomeChangeInr, 0),
      netIncomeInr: roundTo(netIncomeInr, 0),
    };

    await CacheManager.setCache(cacheKey, result, 'impact_metrics', 1);
    return result;
  },
};
