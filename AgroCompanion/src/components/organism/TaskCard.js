import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Card } from '../molecule/Card';
import { Badge } from '../molecule/Badge';
import { CustomText } from '../atomic/CustomText';
import { Spacer } from '../atomic/Spacer';
import { theme } from '../../theme';

export const TaskCard = ({ title, description, date, priority }) => {
  const priorityStatus = priority === 'High' ? 'error' : priority === 'Medium' ? 'warning' : 'default';
  
  return (
    <Card style={styles.container}>
      <View style={styles.header}>
        <CustomText variant="subheading" style={{ flex: 1, marginRight: 8 }}>{title}</CustomText>
        <Badge label={priority} status={priorityStatus} />
      </View>
      <Spacer size="sm" />
      <CustomText variant="body" color={theme.colors.textLight}>{date}</CustomText>
      {description ? (
        <>
          <Spacer size="sm" />
          <CustomText variant="body">{description}</CustomText>
        </>
      ) : null}
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { marginBottom: theme.spacing.md },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }
});