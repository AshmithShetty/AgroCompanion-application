import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { EventBusService } from './EventBusService';

const LANGUAGE_KEY = '@app_language';
const RESET_KEY = '@app_language_reset_v1';

import enCommon from '../../locales/en/common.json';
import enAssistant from '../../locales/en/assistant.json';
import enErrors from '../../locales/en/errors.json';
import enFarm from '../../locales/en/farm.json';
import enFinance from '../../locales/en/finance.json';
import enMarket from '../../locales/en/market.json';
import enTasks from '../../locales/en/tasks.json';

import hiCommon from '../../locales/hi/common.json';
import hiAssistant from '../../locales/hi/assistant.json';
import hiErrors from '../../locales/hi/errors.json';
import hiFarm from '../../locales/hi/farm.json';
import hiFinance from '../../locales/hi/finance.json';
import hiMarket from '../../locales/hi/market.json';
import hiTasks from '../../locales/hi/tasks.json';

import knCommon from '../../locales/kn/common.json';
import knAssistant from '../../locales/kn/assistant.json';
import knErrors from '../../locales/kn/errors.json';
import knFarm from '../../locales/kn/farm.json';
import knFinance from '../../locales/kn/finance.json';
import knMarket from '../../locales/kn/market.json';
import knTasks from '../../locales/kn/tasks.json';

import mrCommon from '../../locales/mr/common.json';
import mrAssistant from '../../locales/mr/assistant.json';
import mrErrors from '../../locales/mr/errors.json';
import mrFarm from '../../locales/mr/farm.json';
import mrFinance from '../../locales/mr/finance.json';
import mrMarket from '../../locales/mr/market.json';
import mrTasks from '../../locales/mr/tasks.json';

const resources = {
  en: {
    common: enCommon,
    assistant: enAssistant,
    errors: enErrors,
    farm: enFarm,
    finance: enFinance,
    market: enMarket,
    tasks: enTasks,
  },
  hi: {
    common: hiCommon,
    assistant: hiAssistant,
    errors: hiErrors,
    farm: hiFarm,
    finance: hiFinance,
    market: hiMarket,
    tasks: hiTasks,
  },
  kn: {
    common: knCommon,
    assistant: knAssistant,
    errors: knErrors,
    farm: knFarm,
    finance: knFinance,
    market: knMarket,
    tasks: knTasks,
  },
  mr: {
    common: mrCommon,
    assistant: mrAssistant,
    errors: mrErrors,
    farm: mrFarm,
    finance: mrFinance,
    market: mrMarket,
    tasks: mrTasks,
  },
};

class LanguageServiceImpl {
  async init() {
    let savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
    const hasReset = await AsyncStorage.getItem(RESET_KEY);
    
    if (!savedLanguage || !hasReset) {
      savedLanguage = 'en';
      await AsyncStorage.setItem(LANGUAGE_KEY, 'en');
      await AsyncStorage.setItem(RESET_KEY, 'true');
    }

    await i18n.use(initReactI18next).init({
      compatibilityJSON: 'v3',
      resources,
      lng: savedLanguage,
      fallbackLng: 'en',
      ns: ['common', 'assistant', 'errors', 'farm', 'finance', 'market', 'tasks'],
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

    const { DynamicTranslationWarmupService } = require('./ai/DynamicTranslationWarmupService');
    DynamicTranslationWarmupService.warmupOnLanguageChange(langCode).catch(() => {});
  }

  getCurrentLanguage() {
    return i18n.language;
  }
}

export const LanguageService = new LanguageServiceImpl();
