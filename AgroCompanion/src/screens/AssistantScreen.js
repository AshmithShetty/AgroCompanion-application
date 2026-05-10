import React, { useEffect, useRef, useState } from 'react';
import { SafeAreaView, View, StyleSheet, ScrollView, TextInput, ActivityIndicator, TouchableOpacity, Image } from 'react-native';
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

const CHAT_LOG_MAX = 100;
const IMAGE_SIZE_LIMIT_BYTES = 4 * 1024 * 1024;

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

  const [currentLangCode, setCurrentLangCode] = useState(LanguageService.getCurrentLanguage() || 'en');
  const languageLabel = languageChoices.find(x => x.code === currentLangCode)?.label || 'English';

  const [query, setQuery] = useState('');
  const [chatLog, setChatLog] = useState([
    { role: 'ai', text: t('assistant:chat.greeting', { cropType, defaultValue: `Welcome! I am your active AI Agronomist. How can I assist with your ${cropType} today?` }) }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollToEnd({ animated: true });
    }
  }, [chatLog, isLoading]);

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

  const detectIntent = (text) => {
    if (!text) return 'crop';
    const q = text.toLowerCase();
    if (q.includes('price') || q.includes('sell') || q.includes('market')) {
      return 'market';
    }
    if (
      q.includes('schedule') || q.includes('timeline') || q.includes('task') ||
      q.includes('reorgani') || q.includes('reschedul') || q.includes('calendar') ||
      q.includes('start from')
    ) {
      return 'general';
    }
    return 'crop';
  };

  const doSend = async () => {
    if (isLoading) return;
    if (!query.trim() && !selectedImage) return;

    const currentQuery = query;
    const currentImage = selectedImage;

    const userMessage = {
      role: 'user',
      text: currentQuery || (currentImage ? t('assistant:chat.imageUploaded', '[Image Uploaded]') : ''),
      imageUri: currentImage?.uri
    };

    setChatLog(prev => [...prev, userMessage].slice(-CHAT_LOG_MAX));
    setQuery('');
    setSelectedImage(null);
    setIsLoading(true);

    const intent = detectIntent(currentQuery);

    try {
      let aiResponse;
      if (currentImage) {
        aiResponse = await AgentOrchestrator.analyzeImage(currentImage.base64, currentQuery, intent);
      } else {
        aiResponse = await AgentOrchestrator.routeQuery(currentQuery, intent, chatLog);
      }
      setChatLog(prev => [...prev, { role: 'ai', text: aiResponse }].slice(-CHAT_LOG_MAX));
    } catch (e) {
      console.error('AI error:', e);
      setChatLog(prev => [...prev, { role: 'ai', text: t('common:assistant.aiReachError', 'Something went wrong reaching the AI. Please try again.') }].slice(-CHAT_LOG_MAX));
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
      const asset = result.assets[0];
      const base64 = asset.base64 || '';
      const estimatedBytes = Math.round(base64.length * 0.75);
      if (estimatedBytes > IMAGE_SIZE_LIMIT_BYTES) {
        showAlert('Image too large', 'The selected image is too large to process. Please choose a smaller or lower resolution image.');
        return;
      }
      setSelectedImage({ uri: asset.uri, base64 });
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
            setCurrentLangCode(choice.code);
            setChatLog([
              { role: 'ai', text: t('assistant:chat.greeting', { cropType, defaultValue: `Welcome! I am your active AI Agronomist. How can I assist with your ${cropType} today?` }) }
            ]);
          }}
        />
      </View>

      <ScrollView ref={scrollRef} contentContainerStyle={styles.chatArea}>
        {chatLog.map((msg, index) => (
          <View key={index} style={[styles.messageBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            {msg.imageUri && (
              <Image source={{ uri: msg.imageUri }} style={styles.chatImage} />
            )}
            {!!msg.text && (
              <CustomText color={msg.role === 'user' ? theme.colors.surface : theme.colors.text}>
                {msg.text}
              </CustomText>
            )}
          </View>
        ))}
        {isLoading && <ActivityIndicator size="small" color={theme.colors.primary} style={styles.loader} />}
      </ScrollView>

      {selectedImage && (
        <View style={styles.imagePreviewContainer}>
          <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} />
          <TouchableOpacity style={styles.removeImageBtn} onPress={() => setSelectedImage(null)}>
            <Ionicons name="close-circle" size={24} color={theme.colors.error} />
          </TouchableOpacity>
        </View>
      )}

      <View style={styles.inputArea}>
        <TouchableOpacity style={styles.camBtn} onPress={handleImagePick} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={26} color={theme.colors.primary} />
        </TouchableOpacity>

        <TextInput
          style={styles.input}
          placeholder={t('assistant:chat.placeholder', 'Ask about your crops...')}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={isLoading ? undefined : doSend}
          editable={!isLoading}
        />

        <VoiceInputButton isListening={isListening} onPress={toggleListening} />
        <TouchableOpacity style={styles.sendBtn} onPress={doSend} disabled={isLoading || (!query.trim() && !selectedImage)}>
          <Ionicons name="send" size={22} color={(!query.trim() && !selectedImage || isLoading) ? theme.colors.textLight : theme.colors.primary} />
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
  },
  chatImage: {
    width: 200,
    height: 150,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.sm,
    resizeMode: 'cover'
  },
  imagePreviewContainer: {
    padding: theme.spacing.sm,
    backgroundColor: theme.colors.surface,
    borderTopWidth: 1,
    borderColor: theme.colors.border,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  imagePreview: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.sm,
    resizeMode: 'cover'
  },
  removeImageBtn: {
    marginLeft: -15,
    marginTop: -10,
    backgroundColor: theme.colors.surface,
    borderRadius: 12,
  }
});
