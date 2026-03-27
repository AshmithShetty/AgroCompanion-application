import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { CustomText } from '../atomic/CustomText';
import { Card } from './Card';
import { theme } from '../../theme';

export const SensorDataGraph = ({ title, dataPoints, color }) => {
  const screenWidth = Dimensions.get('window').width - theme.spacing.md * 4;

  return (
    <Card style={styles.container}>
      <CustomText variant="h2" style={styles.title}>{title}</CustomText>
      <View style={styles.chartWrapper}>
        <LineChart
          data={{
            labels: [],
            datasets: [{ data: dataPoints.length > 0 ? dataPoints : [0] }]
          }}
          width={screenWidth}
          height={180}
          withDots={false}
          withInnerLines={false}
          withOuterLines={false}
          withVerticalLabels={false}
          withHorizontalLabels={false}
          chartConfig={{
            backgroundColor: theme.colors.white,
            backgroundGradientFrom: theme.colors.white,
            backgroundGradientTo: theme.colors.white,
            fillShadowGradientFrom: theme.colors.white,
            fillShadowGradientTo: theme.colors.white,
            fillShadowGradientFromOpacity: 0,
            fillShadowGradientToOpacity: 0,
            decimalPlaces: 0,
            color: (opacity = 1) => color,
            style: { borderRadius: theme.layout.radiusCard },
            propsForBackgroundLines: { strokeWidth: 0 },
            useShadowColorFromDataset: false
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
    padding: theme.spacing.md,
    marginTop: theme.spacing.md,
  },
  title: {
    marginBottom: theme.spacing.md,
  },
  chartWrapper: {
    alignItems: 'center',
    overflow: 'hidden',
  },
  chart: {
    marginVertical: 8,
    borderRadius: theme.layout.radiusCard,
  }
});