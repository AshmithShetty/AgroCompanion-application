import React, { useEffect, useState } from 'react';
import { View, StyleSheet, FlatList } from 'react-native';
import { Card } from '../molecule/Card';
import { CustomText } from '../atomic/CustomText';
import { EventBusService } from '../../services/EventBusService';
import { EVENT_TOPICS } from '../../utils/EventRegistry';
import { theme } from '../../theme';

export const TransactionHistory = () => {
  const [transactions, setTransactions] = useState([]);

  useEffect(() => {
    const sub = EventBusService.subscribe(EVENT_TOPICS.TRANSACTION_COMPLETED, (newTx) => {
      setTransactions(prev => [newTx, ...prev]);
    });
    return () => sub.unsubscribe();
  }, []);

  const renderItem = ({ item }) => (
    <View style={styles.item}>
      <View>
        <CustomText variant="body">{item.crop}</CustomText>
        <CustomText variant="caption" color={theme.colors.textLight}>{item.date.split('T')[0]}</CustomText>
      </View>
      <View style={styles.rightAlign}>
        <CustomText variant="body" color={theme.colors.primary}>INR {item.total}</CustomText>
        <CustomText variant="caption" color={theme.colors.textLight}>{item.quantity}kg @ INR {item.price}</CustomText>
      </View>
    </View>
  );

  return (
    <Card style={styles.container}>
      <CustomText variant="subheading">Recent Transactions</CustomText>
      <FlatList
        data={transactions}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListEmptyComponent={<CustomText color={theme.colors.textLight}>No transactions yet.</CustomText>}
      />
    </Card>
  );
};

const styles = StyleSheet.create({
  container: { padding: theme.spacing.md, marginTop: theme.spacing.md },
  item: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: theme.spacing.sm, borderBottomWidth: 1, borderBottomColor: theme.colors.border },
  rightAlign: { alignItems: 'flex-end' }
});