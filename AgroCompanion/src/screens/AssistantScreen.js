import React, { useState } from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView, TextInput, ActivityIndicator, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header, CustomText, Spacer, VoiceInputButton } from '../components';
import { SelectField } from '../components/molecule/SelectField';
import { AgentOrchestrator } from '../services/ai/AgentOrchestrator';
import { VoiceService } from '../services/voice/VoiceService';
import { LanguageService } from '../services/LanguageService';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { useUserSessionStore } from '../store';
import { showAlert } from '../utils/alert';
import { theme } from '../theme';

export const AssistantScreen = () => {
  const { t } = useTranslation(['assistant', 'common']);
  const currentSession = useUserSessionStore(state => state.currentSession);
  const cropType = currentSession?.cropType || 'crop';

  const languageChoices = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'Hindi' },
    { code: 'kn', label: 'Kannada' },
    { code: 'mr', label: 'Marathi' },
  ];
  const initialLangCode = LanguageService.getCurrentLanguage() || 'en';
  const initialLangLabel = languageChoices.find(x => x.code === initialLangCode)?.label || 'English';
  const [languageLabel, setLanguageLabel] = useState(initialLangLabel);

  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'ai', text: t('assistant:chat.greeting', { cropType, defaultValue: `Welcome! I am your active AI Agronomist. How can I assist with your ${cropType} today?` }) }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);

  const toggleListening = async () => {
    if (isListening) return;

    setIsListening(true);
    try {
      const text = await VoiceService.startSpeechToText();
      if (text) {
        setQuery(prev => prev ? `${prev} ${text}` : text);
      }
    } catch (e) {
      console.error('Speech error:', e);
      showAlert(t('common:alerts.error', 'Error'), t('common:assistant.microphoneError', 'Microphone error or speech not recognized.'));
    } finally {
      setIsListening(false);
    }
  };

  const handleSend = async () => {
    if (!query.trim()) return;

    const userMessage = { role: 'user', text: query };
    setChatLog(prev => [...prev, userMessage]);
    setQuery('');
    setIsLoading(true);

    let intent = 'crop';
    if (query.toLowerCase().includes('price') || query.toLowerCase().includes('sell')) {
      intent = 'market';
    }

    try {
      const aiResponse = await AgentOrchestrator.routeQuery(query, intent);
      setChatLog(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (e) {
      console.error('AI error:', e);
      setChatLog(prev => [...prev, { role: 'ai', text: t('common:assistant.aiReachError', 'Something went wrong reaching the AI. Please try again.') }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImagePick = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permissionResult.granted === false) {
      showAlert(t('common:alerts.permissionRequired', 'Permission Required'), t('common:assistant.allowPhotoLibrary', 'Please allow access to your photo library.'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.3,
      base64: true,
    });

    if (!result.canceled) {
      setChatLog(prev => [...prev, { role: 'user', text: t('assistant:chat.imageUploaded', '[Image Uploaded]') }]);
      setIsLoading(true);
      try {
        const visionResponse = await AgentOrchestrator.analyzeImage(result.assets[0].base64);
        setChatLog(prev => [...prev, { role: 'ai', text: visionResponse }]);
      } catch (e) {
        console.error('Vision error:', e);
        setChatLog(prev => [...prev, { role: 'ai', text: t('common:assistant.imageAnalysisFailed', 'Image analysis failed. Please try again.') }]);
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('assistant:chat.title', 'AI Agronomist')} />

      <View style={styles.languageRow}>
        <SelectField
          label={t('common:assistant.languageLabel', 'Language')}
          placeholder={t('common:assistant.languagePlaceholder', 'Select language')}
          value={languageLabel}
          options={languageChoices.map(x => x.label)}
          onChange={async (label) => {
            const choice = languageChoices.find(x => x.label === label);
            if (!choice) return;
            await LanguageService.setLanguage(choice.code);
            setLanguageLabel(choice.label);
          }}
        />
      </View>
      
      <ScrollView contentContainerStyle={styles.chatArea}>
        {chatLog.map((msg, index) => (
          <View key={index} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <CustomText color={msg.role === 'user' ? theme.colors.surface : theme.colors.text}>
              {msg.text}
            </CustomText>
          </View>
        ))}
        {isLoading && <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />}
      </ScrollView>

      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.camBtn} onPress={handleImagePick} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={26} color={theme.colors.primary} />
        </TouchableOpacity>
        
        <TextInput 
          style={styles.input} 
          placeholder={t('assistant:chat.placeholder', 'Ask about your crops...')} 
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSend}
        />
        
        <VoiceInputButton isListening={isListening} onPress={toggleListening} />
        <TouchableOpacity style={styles.sendBtn} onPress={handleSend} disabled={isLoading || !query.trim()}>
          <Ionicons name="send" size={22} color={(!query.trim() || isLoading) ? theme.colors.textLight : theme.colors.primary} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  languageRow: { paddingHorizontal: theme.spacing.md, paddingTop: theme.spacing.sm },
  chatArea: { padding: theme.spacing.md, paddingBottom: 40 },
  messageBubble: { 
    maxWidth: '80%', padding: theme.spacing.md, borderRadius: theme.radius.lg, marginBottom: theme.spacing.sm 
  },
  userBubble: { 
    backgroundColor: theme.colors.primary, alignSelf: 'flex-end', borderBottomRightRadius: 0 
  },
  aiBubble: { 
    backgroundColor: theme.colors.surface, alignSelf: 'flex-start', borderBottomLeftRadius: 0,
    borderWidth: 1, borderColor: theme.colors.border
  },
  loader: { alignSelf: 'flex-start', marginVertical: theme.spacing.sm },
  inputArea: { 
    flexDirection: 'row', padding: theme.spacing.md, backgroundColor: theme.colors.surface,
    borderTopWidth: 1, borderColor: theme.colors.border, alignItems: 'center'
  },
  input: { 
    flex: 1, height: 48, backgroundColor: theme.colors.background, borderRadius: theme.radius.md,
    paddingHorizontal: theme.spacing.md, marginHorizontal: theme.spacing.sm,
    borderWidth: 1, borderColor: theme.colors.border
  },
  camBtn: { 
    padding: 10, 
    justifyContent: 'center', 
    alignItems: 'center',
    borderWidth: 1,
    borderColor: theme.colors.primary,
    borderRadius: theme.radius.md,
    backgroundColor: 'transparent'
  },
  sendBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  }
});
