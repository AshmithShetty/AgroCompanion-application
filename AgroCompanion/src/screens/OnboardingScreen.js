import React, { useState } from 'react';
import { View, StyleSheet, SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, useWindowDimensions } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Button } from '../components/atomic/Button';
import { CustomText } from '../components/atomic/CustomText';
import { InputField } from '../components/molecule/InputField';
import { database } from '../database';
import { useUserSessionStore } from '../store';
import { Q } from '@nozbe/watermelondb';
import { showAlert } from '../utils/alert';
import { FarmSetupService } from '../services/FarmSetupService';

export const OnboardingScreen = ({ navigation }) => {
  const { t } = useTranslation(['common', 'errors']);
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const { height } = useWindowDimensions();
  const isCompact = height < 720;
  const containerPadding = isCompact ? 16 : 24;
  const cardPadding = isCompact ? 22 : 32;
  const titleSize = isCompact ? 38 : 48;
  
  const setCurrentUser = useUserSessionStore(state => state.setCurrentUser);
  const setCurrentFarm = useUserSessionStore(state => state.setCurrentFarm);
  const setCurrentSession = useUserSessionStore(state => state.setCurrentSession);

  const handleLogin = async () => {
    if (!username.trim()) {
      showAlert(t('common:alerts.error', 'Error'), t('errors:auth.enterUsername', 'Please enter a username.'));
      return;
    }
    
    setIsLoading(true);
    try {
      const usersCollection = database.get('users');
      const users = await usersCollection.query(Q.where('username', username.trim())).fetch();
      
      if (users.length === 0) {
        showAlert(t('common:alerts.error', 'Error'), t('errors:auth.userNotFound', 'User not found. Please create a new account.'));
        setIsLoading(false);
        return;
      }
      
      const user = users[0];
      setCurrentUser(user);
      
      const farmsCollection = database.get('farms');
      const farms = await farmsCollection.query(Q.where('user_id', user.id)).fetch();
      
      if (farms.length === 0) {
        navigation.replace('FarmSetup');
      } else {
        const hydratedFarm = await FarmSetupService.hydrateLegacyFarm(farms[0]);
        setCurrentFarm(hydratedFarm);
        const sessionsCollection = database.get('sessions');
        const activeSessions = await sessionsCollection.query(
          Q.where('farm_id', hydratedFarm.id),
          Q.where('is_active', true)
        ).fetch();
        
        if (activeSessions.length > 0) {
          setCurrentSession(activeSessions[0]);
        }
        navigation.replace('SessionSelect');
      }
    } catch (error) {
      console.error(error);
      showAlert(t('common:alerts.error', 'Error'), t('errors:auth.loginFailed', 'Failed to login.'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewAccount = async () => {
    if (!username.trim()) {
      showAlert(t('common:alerts.error', 'Error'), t('errors:auth.enterUsername', 'Please enter a username.'));
      return;
    }

    setIsLoading(true);
    try {
      const usersCollection = database.get('users');
      const existingUsers = await usersCollection.query(Q.where('username', username.trim())).fetch();
      
      if (existingUsers.length > 0) {
        showAlert(t('common:alerts.error', 'Error'), t('errors:auth.usernameExists', 'Username already exists. Please login.'));
        setIsLoading(false);
        return;
      }
      
      let newUser;
      await database.write(async () => {
        newUser = await usersCollection.create(user => {
          user.username = username.trim();
        });
      });
      
      setCurrentUser(newUser);
      navigation.replace('FarmSetup');
    } catch (error) {
      console.error(error);
      showAlert(t('common:alerts.error', 'Error'), t('errors:auth.createAccountFailed', 'Failed to create account.'));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.content, { padding: containerPadding }]}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <View style={[styles.topSection, { marginBottom: isCompact ? 24 : 48 }]}>
            <CustomText variant="h1" style={[styles.title, { fontSize: titleSize }]}>
              AgroCompanion
            </CustomText>
            <CustomText variant="body" style={styles.subtitle}>
              {t('common:onboarding.subtitle', 'Future of farming, powered by precision AI.')}
            </CustomText>
          </View>

          <View style={[styles.card, { padding: cardPadding }]}>
            <CustomText variant="h2" style={styles.cardTitle}>
              {t('common:onboarding.welcomeBackTitle', 'Welcome Back')}
            </CustomText>
            <CustomText variant="caption" style={styles.cardSubtitle}>
              {t('common:onboarding.welcomeBackSubtitle', 'Enter your unique username to access your farm.')}
            </CustomText>

            <View style={styles.authContainer}>
              <InputField
                label={t('common:onboarding.usernameLabel', 'Username')}
                placeholder={t('common:onboarding.usernamePlaceholder', 'e.g. farmer_john')}
                value={username}
                onChangeText={setUsername}
              />
            </View>

            <View style={styles.footer}>
              <Button
                title={t('common:onboarding.login', 'Login to Account')}
                onPress={handleLogin}
                disabled={isLoading}
                style={styles.primaryBtn}
              />
              <View style={styles.divider}>
                <View style={styles.line} />
                <CustomText variant="caption" style={styles.orText}>{t('common:onboarding.or', 'OR')}</CustomText>
                <View style={styles.line} />
              </View>
              <Button
                title={t('common:onboarding.createAccount', 'Create New Account')}
                variant="secondary"
                onPress={handleNewAccount}
                disabled={isLoading}
              />
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#E8F5E9', 
  },
  flex: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  topSection: {
    alignItems: 'center',
  },
  title: { 
    textAlign: 'center', 
    color: '#2E7D32', 
    fontWeight: '700'
  },
  subtitle: { 
    color: '#4CAF50',
    textAlign: 'center',
    marginTop: 8,
    fontSize: 16
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
    elevation: 8,
  },
  cardTitle: {
    fontSize: 24,
    color: '#333333',
    marginBottom: 8
  },
  cardSubtitle: {
    color: '#757575',
    marginBottom: 24
  },
  authContainer: { 
    marginBottom: 16
  },
  footer: { 
  },
  primaryBtn: {
    marginBottom: 24
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#E0E0E0'
  },
  orText: {
    marginHorizontal: 16,
    color: '#9E9E9E',
    fontWeight: 'bold'
  }
});
