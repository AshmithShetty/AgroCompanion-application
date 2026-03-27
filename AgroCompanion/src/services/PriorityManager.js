export const PriorityManager = {
  calculatePriority: (taskType) => {
    const type = taskType.toLowerCase();
    if (type.includes('pest') || type.includes('disease')) return 'High';
    if (type.includes('water') || type.includes('irrigat')) return 'High';
    if (type.includes('fertiliz') || type.includes('nutrient')) return 'Medium';
    return 'Low';
  }
};