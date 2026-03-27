import React from 'react';
import { View } from 'react-native';
import { theme } from '../../theme';

export const Spacer = ({ size = 'md', horizontal = false }) => {
  const dimension = theme.spacing[size];
  return <View style={{ width: horizontal ? dimension : 0, height: horizontal ? 0 : dimension }} />;
};