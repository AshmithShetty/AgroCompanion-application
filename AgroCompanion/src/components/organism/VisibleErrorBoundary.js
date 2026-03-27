import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export class VisibleErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.container}>
          <View style={styles.banner}>
            <Text style={styles.text}>Application Error</Text>
            <Text style={styles.subText}>{this.state.error?.toString()}</Text>
          </View>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5', justifyContent: 'center', padding: 16 },
  banner: { backgroundColor: '#D32F2F', padding: 20, borderRadius: 8 },
  text: { color: 'white', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  subText: { color: 'white', fontSize: 14 }
});