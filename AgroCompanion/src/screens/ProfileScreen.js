import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Header } from '../components/organism/Header';
import { LanguageSelector } from '../components/organism/LanguageSelector';
import { ImpactDashboard } from '../components/organism/ImpactDashboard';
import { CustomText } from '../components/atomic/CustomText';
import { Button } from '../components/atomic/Button';
import { ConfigService } from '../utils/ConfigService';
import { useUserSessionStore } from '../store';
import { theme } from '../theme';

export const ProfileScreen = ({ navigation }) => {
  const { t } = useTranslation(['common']);
  const isDemoMode = ConfigService.DEMO_MODE;
  
  const currentUser = useUserSessionStore(state => state.currentUser);
  const currentFarm = useUserSessionStore(state => state.currentFarm);
  const currentSession = useUserSessionStore(state => state.currentSession);
  const clearState = useUserSessionStore(state => state.clearState);

  const handleLogout = () => {
    clearState();
    navigation.reset({
      index: 0,
      routes: [{ name: 'Onboarding' }],
    });
  };

  const handleSwitchSession = () => {
    navigation.navigate('SessionSelect');
  };

  return (
    <View style={styles.container}>
      <Header title={t('common:profile.title', 'Profile & Settings')} />
      <ScrollView style={styles.content}>

        <View style={styles.section}>
          <CustomText variant="h2" style={styles.sectionTitle}>{t('common:profile.accountDetails', 'Account Details')}</CustomText>
          <CustomText variant="body">{t('common:profile.usernamePrefix', 'Username:')} {currentUser?.username || 'Guest'}</CustomText>
          {currentFarm && (
            <CustomText variant="body">{t('common:profile.activeFarmPrefix', 'Active Farm:')} {currentFarm.name}</CustomText>
          )}
        </View>

        {currentSession && (
          <View style={styles.section}>
            <CustomText variant="h2" style={styles.sectionTitle}>{t('common:profile.activeCropSession', 'Active Crop Session')}</CustomText>
            <CustomText variant="body">{t('common:profile.cropPrefix', 'Crop:')} {currentSession.cropType}</CustomText>
            <CustomText variant="body">{t('common:profile.methodPrefix', 'Method:')} {currentSession.farmingMethod || 'N/A'}</CustomText>
            <CustomText variant="body">{t('common:profile.startedPrefix', 'Started:')} {new Date(currentSession.startDate).toLocaleDateString()}</CustomText>
            <Button 
              title={t('common:profile.switchSession', 'Switch Farm Session')} 
              variant="secondary" 
              onPress={handleSwitchSession} 
              style={{marginTop: 16}} 
            />
          </View>
        )}

        <ImpactDashboard
          onPressDetails={() => navigation.navigate('ImpactDetails')}
        />

        <View style={[styles.section, { marginTop: 16 }]}>
          <CustomText variant="h2" style={styles.sectionTitle}>
            {t('common:module.screen.element.language', 'Language')}
          </CustomText>
          <LanguageSelector isDemoMode={isDemoMode} />
        </View>

        <View style={[styles.section, { backgroundColor: 'transparent' }]}>
          <Button 
            title={t('common:profile.logout', 'Logout')} 
            onPress={handleLogout} 
            style={styles.logoutBtn}
          />
        </View>

      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },
  content: { flex: 1, padding: 16 },
  section: { backgroundColor: '#FFFFFF', padding: 16, borderRadius: 16, marginBottom: 16 },
  sectionTitle: { marginBottom: 16, color: '#333333' },
  logoutBtn: { backgroundColor: '#D32F2F', marginTop: 16 }
});
