import React, { useState, useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { LanguageCard } from '../molecule/LanguageCard';
import { LanguageService } from '../../services/LanguageService';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
  { code: 'kn', label: 'ಕನ್ನಡ' },
  { code: 'mr', label: 'मराठी' }
];

export const LanguageSelector = ({ isDemoMode }) => {
  const [currentLang, setCurrentLang] = useState('en');

  useEffect(() => {
    setCurrentLang(LanguageService.getCurrentLanguage());
  }, []);

  const handleSelect = async (code) => {
    setCurrentLang(code);
    await LanguageService.setLanguage(code);
  };

  return (
    <View style={styles.container}>
      {LANGUAGES.map((lang) => (
        <LanguageCard
          key={lang.code}
          language={lang.label}
          code={lang.code}
          isSelected={currentLang === lang.code}
          onPress={handleSelect}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 16,
  },
});
