import { StyleSheet, Text, View } from 'react-native';

export default function InstallningarScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Inställningar</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  text: {
    fontSize: 24,
    fontWeight: '700',
  },
});