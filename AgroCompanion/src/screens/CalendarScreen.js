import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, StyleSheet, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { useTranslation } from 'react-i18next';
import { Header, CustomText, TaskCard, Spacer } from '../components';
import { TaskRepository } from '../services/TaskRepository';
import { EventBusService } from '../services/EventBusService';
import { EVENT_TOPICS } from '../utils/EventRegistry';
import { theme } from '../theme';
import { useUserSessionStore } from '../store';

const getLocalDateKey = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const taskToLocalDateKey = (dateStr) => {
  if (!dateStr) return null;
  const s = String(dateStr);
  const candidate = s.includes('T') ? s.split('T')[0] : s.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(candidate) ? candidate : null;
};

export const CalendarScreen = () => {
  const { t } = useTranslation(['tasks']);
  const currentSession = useUserSessionStore(state => state.currentSession);
  const [selectedDate, setSelectedDate] = useState(getLocalDateKey());
  const [tasks, setTasks] = useState([]);

  const loadTasks = useCallback(async () => {
    const allTasks = await TaskRepository.getAllTasks();
    setTasks(allTasks);
  }, []);

  useEffect(() => {
    loadTasks();
    const subCreate = EventBusService.subscribe(EVENT_TOPICS.TASK_CREATED, loadTasks);
    const subResolve = EventBusService.subscribe(EVENT_TOPICS.TASK_RESOLVED, loadTasks);
    const subUpdate = EventBusService.subscribe(EVENT_TOPICS.TASK_UPDATED, loadTasks);
    const subDelete = EventBusService.subscribe(EVENT_TOPICS.TASK_DELETED, loadTasks);
    return () => {
      if (subCreate) subCreate.unsubscribe();
      if (subResolve) subResolve.unsubscribe();
      if (subUpdate) subUpdate.unsubscribe();
      if (subDelete) subDelete.unsubscribe();
    };
  }, [currentSession?.id, loadTasks]);

  const handleDayPress = (day) => {
    setSelectedDate(day.dateString);
  };

  const markedDates = useMemo(() => {
    const marked = {};
    tasks.forEach(task => {
      const dateKey = taskToLocalDateKey(task.date);
      if (dateKey) {
        marked[dateKey] = { marked: true, dotColor: theme.colors.primary };
      }
    });
    marked[selectedDate] = {
      ...marked[selectedDate],
      selected: true,
      selectedColor: theme.colors.primary
    };
    return marked;
  }, [tasks, selectedDate]);

  const tasksForDay = useMemo(() => {
    return tasks.filter(task => taskToLocalDateKey(task.date) === selectedDate);
  }, [tasks, selectedDate]);

  const renderTask = ({ item }) => (
    <TaskCard title={item.title} description={item.description} date={item.date} priority={item.priority} />
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title={t('tasks:calendar.title', 'Schedule')} showBack={false} />
      <View style={styles.content}>
        <Calendar
          onDayPress={handleDayPress}
          markedDates={markedDates}
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
          data={tasksForDay}
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
