import { AppState } from 'react-native';
import { useAppStateStore } from '../store';
import { ImpactAutomationService } from './analytics/ImpactAutomationService';
import { ThresholdManager } from './iot/ThresholdManager';
import { SensorHistoryService } from './iot/SensorHistoryService';
import { TaskRepository } from './TaskRepository';

let midnightTimer = null;

const clearMidnightTimer = () => {
  if (midnightTimer) {
    clearTimeout(midnightTimer);
    midnightTimer = null;
  }
};

const scheduleMidnightAutoResolve = () => {
  clearMidnightTimer();
  const now = new Date();
  const nextMidnight = new Date(now);
  nextMidnight.setHours(24, 0, 2, 0);
  const delay = Math.max(1000, nextMidnight.getTime() - now.getTime());
  midnightTimer = setTimeout(() => {
    TaskRepository.autoResolveOverdueTasks().catch(() => {});
    scheduleMidnightAutoResolve();
  }, delay);
};

export const AppLifecycleService = {
  init: () => {
    TaskRepository.autoResolveOverdueTasks().catch(() => {});
    scheduleMidnightAutoResolve();
    AppState.addEventListener('change', (nextAppState) => {
      useAppStateStore.getState().setAppStatus(nextAppState);
      if (nextAppState === 'active') {
        TaskRepository.autoResolveOverdueTasks().catch(() => {});
        scheduleMidnightAutoResolve();
      } else {
        clearMidnightTimer();
      }
    });
    ImpactAutomationService.init();
    ThresholdManager.init();
    SensorHistoryService.init();
  }
};
