import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';

export const LanguageCard = ({ language, code, isSelected, onPress }) => {
  return (
    <TouchableOpacity
      style={[styles.card, isSelected && styles.selectedCard]}
      onPress={() => onPress(code)}
      activeOpacity={0.8}
    >
      <Text style={[styles.text, isSelected && styles.selectedText]}>
        {language}
      </Text>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
    alignItems: 'center',
  },
  selectedCard: {
    borderColor: '#2E7D32',
    backgroundColor: '#E8F5E9',
  },
  text: {
    fontFamily: 'Inter-Medium',
    fontSize: 16,
    color: '#333333',
  },
  selectedText: {
    color: '#2E7D32',
    fontFamily: 'Inter-SemiBold',
  },
});