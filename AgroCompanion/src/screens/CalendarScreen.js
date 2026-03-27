import React, { useState, useEffect } from 'react';
import { SafeAreaView, View, StyleSheet, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTranslation } from 'react-i18next';
import { Header, CustomText, TaskCard, Spacer } from '../components';
import { TaskRepository } from '../services/TaskRepository';
import { EventBusService } from '../services/EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';
import { theme } from '../theme';
import { useUserSessionStore } from '../store';

export const CalendarScreen = () => {
  const { t } = useTranslation(['tasks']);
  const currentSession = useUserSessionStore(state => state.currentSession);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [tasks, setTasks] = useState([]);

  useEffect(() => {
    loadTasks();
    const subCreate = EventBusService.subscribe(EVENT_TOPICS.TASK_CREATED, () => {
      loadTasks();
    });
    const subResolve = EventBusService.subscribe(EVENT_TOPICS.TASK_RESOLVED, () => {
      loadTasks();
    });
    const subUpdate = EventBusService.subscribe(EVENT_TOPICS.TASK_UPDATED, () => {
      loadTasks();
    });
    const subDelete = EventBusService.subscribe(EVENT_TOPICS.TASK_DELETED, () => {
      loadTasks();
    });
    return () => {
      if (subCreate) subCreate.unsubscribe();
      if (subResolve) subResolve.unsubscribe();
      if (subUpdate) subUpdate.unsubscribe();
      if (subDelete) subDelete.unsubscribe();
    };
  }, [currentSession?.id]);

  const loadTasks = async () => {
    const allTasks = await TaskRepository.getAllTasks();
    setTasks(allTasks);
  };

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const getMarkedDates = () => {
    const marked = {};
    tasks.forEach(task => {
      if (task.date) {
        const dateKey = task.date.split('T')[0];
        marked[dateKey] = { marked: true, dotColor: theme.colors.primary };
      }
    });
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: theme.colors.primary
    };
    return marked;
  };

  const renderTask = ({ item }) => {
    if (item.date.split('T')[0] !== selectedDate) return null;
    return <TaskCard title={item.title} description={item.description} date={item.date} priority={item.priority} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('tasks:calendar.title', 'Schedule')} showBack={false} />
      <View style={styles.content}>
        <Calendar
          onDayPress={handleDayPress}
          markedDates={getMarkedDates()}
          theme={{
            selectedDayBackgroundColor: theme.colors.primary,
            todayTextColor: theme.colors.secondary,
            arrowColor: theme.colors.primary,
          }}
        />
        <Spacer size="md" />
        <CustomText variant="subheading">{t('tasks:calendar.tasksFor', 'Tasks for')} {selectedDate}</CustomText>
        <Spacer size="sm" />
        <FlatList
          data={tasks}
          keyExtractor={item => item.id}
          renderItem={renderTask}
          ListEmptyComponent={<CustomText color={theme.colors.textLight}>{t('tasks:calendar.noTasks', 'No tasks scheduled.')}</CustomText>}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.md, flex: 1 }
});
