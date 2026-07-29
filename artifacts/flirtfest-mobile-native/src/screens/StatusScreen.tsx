import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { HEALTHCHECK_URL } from '../config/runtime';

type HealthResponse = {
  ok?: boolean;
  [key: string]: unknown;
};

export function StatusScreen() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('Not checked yet');

  const check = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch(HEALTHCHECK_URL);
      const json = (await response.json()) as HealthResponse;
      setResult(response.ok && json.ok ? 'Healthy' : `Unhealthy (${response.status})`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Request failed';
      setResult(`Error: ${message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Backend Health</Text>
      <Text style={styles.url}>{HEALTHCHECK_URL}</Text>

      <Pressable style={styles.button} onPress={check} disabled={loading}>
        <Text style={styles.buttonText}>{loading ? 'Checking...' : 'Check Now'}</Text>
      </Pressable>

      {loading ? <ActivityIndicator color="#1d4ed8" style={styles.spinner} /> : null}
      <Text style={styles.result}>{result}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#0b0d12',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  heading: {
    color: '#f0f1f5',
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  url: {
    color: '#8b93a7',
    fontSize: 12,
    marginBottom: 24,
    textAlign: 'center',
  },
  button: {
    alignSelf: 'center',
    backgroundColor: '#1d4ed8',
    borderRadius: 10,
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
  spinner: {
    marginTop: 16,
  },
  result: {
    color: '#d5deee',
    fontSize: 14,
    marginTop: 16,
    textAlign: 'center',
  },
});
