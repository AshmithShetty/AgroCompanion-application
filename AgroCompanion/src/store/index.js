import { create } from 'zustand';

export const useAppStateStore = create((set) => ({
  isLoading: false,
  error: null,
  appState: 'active',
  setLoading: (status) => set({ isLoading: status }),
  setError: (error) => set({ error }),
  setAppStatus: (appState) => set({ appState }),
}));

export const useUserSessionStore = create((set) => ({
  currentUser: null,
  currentFarm: null,
  currentSession: null,
  setCurrentUser: (user) => set({ currentUser: user }),
  setCurrentSession: (session) => set({ currentSession: session }),
  setCurrentFarm: (farm) => set({ currentFarm: farm }),
  clearState: () => set({ currentUser: null, currentFarm: null, currentSession: null }),
}));

export const useDemoDataStore = create((set) => ({
  isDemoLoaded: false,
  loadDemoData: () => set({ isDemoLoaded: true }),
}));

export const useAlertStore = create((set) => ({
  visible: false,
  title: '',
  message: '',
  type: 'error',
  show: (title, message, type = 'error') => set({ visible: true, title, message, type }),
  hide: () => set({ visible: false, title: '', message: '' }),
}));