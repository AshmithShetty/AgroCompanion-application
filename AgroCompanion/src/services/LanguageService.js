import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import * as Localization from 'expo-localization';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventBusService } from './EventBusService';

const LANGUAGE_KEY = '@app_language';

const resources = {
  en: {},
  hi: {},
  kn: {},
};

class LanguageServiceImpl {
  async init() {
    let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    if (!savedLanguage) {
      const deviceLocales = Localization.getLocales();
      const deviceLang = deviceLocales.length > 0 ? deviceLocales[0].languageCode : 'en';
      savedLanguage = ['en', 'hi', 'kn'].includes(deviceLang) ? deviceLang : 'en';
    }

    await i18n.use(initReactI18next).init({
      compatibilityJSON: 'v3',
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      ns: ['common'],
      defaultNS: 'common',
      interpolation: {
        escapeValue: false,
      },
    });
  }

  async setLanguage(langCode) {
    await i18n.changeLanguage(langCode);
    await AsyncStorage.setItem(LANGUAGE_KEY, langCode);
    EventBusService.publish('LANGUAGE_CHANGED', { language: langCode });
  }

  getCurrentLanguage() {
    return i18n.language;
  }
}

export const LanguageService = new LanguageServiceImpl();