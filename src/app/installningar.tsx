import { StyleSheet, Text, View } from 'react-native';

export default function InstallningarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Inställningar</Text>
      <Text style={styles.subtitle}>Här kommer appens inställningar senare.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111',
  },
  subtitle: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
});