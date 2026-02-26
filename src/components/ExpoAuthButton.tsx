import React from 'react';
import { TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useExpoAuth } from '../hooks/useExpoAuth';

export const ExpoAuthButton = () => {
  const { signIn, signOut, isAuthenticated, loading, error } = useExpoAuth();

  const handleAuthAction = async () => {
    if (isAuthenticated) {
      signOut();
    } else {
      await signIn();
    }
  };

  if (error) {
    console.error('Auth Error:', error);
  }

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={handleAuthAction}
      disabled={loading}
    >
      {loading ? (
        <ActivityIndicator color="#FFFFFF" />
      ) : (
        <Text style={styles.buttonText}>
          {isAuthenticated ? 'Sign Out' : 'Sign In with Expo'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: '#4285F4',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 192,
    height: 48,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
}); 