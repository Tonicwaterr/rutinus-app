import { StyleSheet, Text, View } from 'react-native';

export default function InkopslistaScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Inköpslista</Text>
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