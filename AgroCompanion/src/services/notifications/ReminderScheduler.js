import * as Notifications from 'expo-notifications';
import { NotificationRepository } from './NotificationRepository';

export const ReminderScheduler = {
  scheduleTaskReminder: async (taskTitle, taskType) => {
    const title = `Task Reminder`;
    const message = `Upcoming task: ${taskTitle}.`;
    
    await NotificationRepository.createNotification(title, message, 'task', 'normal');

    let trigger = null;
    const type = taskType.toLowerCase();

    if (type.includes('water') || type.includes('irrigat')) {
      trigger = { seconds: 86400, repeats: true };
    } else if (type.includes('fertiliz') || type.includes('nutrient')) {
      trigger = { seconds: 604800, repeats: true };
    } else {
      trigger = { seconds: 3600, repeats: false };
    }

    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body: message,
      },
      trigger,
    });
  }
};