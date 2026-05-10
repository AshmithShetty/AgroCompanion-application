import { useAlertStore } from '../store';

export const showAlert = (title, message, type = 'error') => {
  useAlertStore.getState().show(title, message, type);
};
