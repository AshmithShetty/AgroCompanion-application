import React, { useEffect, useState } from 'react';
import { SafeAreaView, FlatList, StyleSheet, View } from 'react-native';
import { Header, NotificationCard, CustomText } from '../components';
import { NotificationRepository } from '../services/notifications/NotificationRepository';
import { theme } from '../theme';
import { useUserSessionStore } from '../store';

export const NotificationInboxScreen = () => {
  const currentSession = useUserSessionStore(state => state.currentSession);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    loadNotifications();
  }, [currentSession?.id]);

  const loadNotifications = async () => {
    const data = await NotificationRepository.getAll();
    setNotifications(data);
  };

  const handlePress = async (id) => {
    await NotificationRepository.markAsRead(id);
    loadNotifications();
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="Alerts & Inbox" showBack={true} />
      <FlatList
        contentContainerStyle={styles.list}
        data={notifications}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <NotificationCard
            title={item.title}
            message={item.message}
            isRead={item.isRead}
            onPress={() => handlePress(item.id)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <CustomText color={theme.colors.textLight}>No notifications to display.</CustomText>
          </View>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  list: { padding: theme.spacing.md },
  empty: { alignItems: 'center', marginTop: theme.spacing.xl }
});
