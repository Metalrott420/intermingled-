import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { API_BASE_URL, WEB_BASE_URL } from '../config/runtime';

type Props = {
  onOpenStatus: () => void;
};

export function HomeScreen({ onOpenStatus }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Intermingled</Text>
      <Text style={styles.subtitle}>Android-native migration is active.</Text>

      <Pressable style={styles.button} onPress={() => Linking.openURL(WEB_BASE_URL)}>
        <Text style={styles.buttonText}>Open Website</Text>
      </Pressable>

      <Pressable style={styles.button} onPress={onOpenStatus}>
        <Text style={styles.buttonText}>Backend Status</Text>
      </Pressable>

      <Text style={styles.caption}>API: {API_BASE_URL}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: '#0b0d12',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    color: '#f0f1f5',
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  subtitle: {
    color: '#8b93a7',
    fontSize: 15,
    marginBottom: 20,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
    marginTop: 10,
    minWidth: 200,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
  },
  caption: {
    color: '#7f8aa3',
    fontSize: 12,
    marginTop: 18,
    textAlign: 'center',
  },
});
