import React from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { CustomText } from '../atomic/CustomText';
import { Card } from '../molecule/Card';
import { theme } from '../../theme';

export const SensorDataGraph = ({ title, dataPoints = [], color }) => {
  const { width: screenWidth } = useWindowDimensions();

  const chartData = {
    labels: dataPoints.map((_, index) => index.toString()),
    datasets: [{ data: dataPoints.length > 0 ? dataPoints : [0] }]
  };

  return (
    <Card style={styles.container}>
      <CustomText variant="subheading">{title}</CustomText>
      <View style={styles.chartWrapper}>
        <LineChart
          data={chartData}
          width={screenWidth - theme.spacing.md * 4}
          height={180}
          withDots={false}
          withInnerLines={false}
          chartConfig={{
            backgroundColor: theme.colors.surface,
            backgroundGradientFrom: theme.colors.surface,
            backgroundGradientTo: theme.colors.surface,
            color: () => color || theme.colors.primary,
            labelColor: () => theme.colors.textLight,
            strokeWidth: 2,
          }}
          bezier
          style={styles.chart}
        />
      </View>
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { 
    marginTop: theme.spacing.md,
    overflow: 'hidden'
  },
  chartWrapper: { 
    alignItems: 'center', 
    marginTop: theme.spacing.md
  },
  chart: { 
    borderRadius: theme.radius.md
  }
});