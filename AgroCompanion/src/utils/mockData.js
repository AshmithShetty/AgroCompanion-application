const today = new Date();
const tomorrow = new Date(today);
tomorrow.setDate(tomorrow.getDate() + 1);

export const DEMO_TASKS = [
  {
    title: 'Apply Urea Fertilizer',
    date: today.toISOString().split('T')[0],
    priority: 'High',
    status: 'Pending'
  },
  {
    title: 'Check Soil Moisture',
    date: tomorrow.toISOString().split('T')[0],
    priority: 'Medium',
    status: 'Pending'
  }
];