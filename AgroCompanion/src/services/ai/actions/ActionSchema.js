export const ACTION_TYPES = {
  CREATE_TASK: 'create_task',
  UPDATE_TASK: 'update_task',
  DELETE_TASK: 'delete_task',
};

export const PRIORITIES = ['High', 'Medium', 'Low'];

export const buildEmptyEnvelope = (message = '') => ({
  message: message || '',
  actions: [
    {
      type: 'create_task',
      title: 'Example task title',
      date: 'YYYY-MM-DD',
      priority: 'High|Medium|Low',
      description: 'Detailed, definite instructions for this task.',
    }
  ],
});

