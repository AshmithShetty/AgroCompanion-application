import React from 'react';
import { TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '../../theme';

export const VoiceInputButton = ({ isListening, onPress }) => {
  return (
    <TouchableOpacity 
      onPress={onPress}
      style={[styles.button, isListening && styles.listening]}
      activeOpacity={0.7}
    >
      <Ionicons name={isListening ? "square" : "mic-outline"} size={22} color={isListening ? theme.colors.error : theme.colors.primary} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'transparent'
  },
  listening: {
    transform: [{ scale: 1.1 }],
  }
});