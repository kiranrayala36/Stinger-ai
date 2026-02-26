import { useState, useEffect } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import { makeRedirectUri } from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

export interface AuthResponse {
  type: 'success' | 'error';
  params: {
    [key: string]: string;
  };
}

export const useExpoAuth = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userInfo, setUserInfo] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectUri = makeRedirectUri({
    scheme: 'stingerai'
  });

  const discovery = {
    authorizationEndpoint: 'https://auth.expo.io/@anonymous/stingerai',
    tokenEndpoint: 'https://auth.expo.io/@anonymous/stingerai/token',
  };

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      redirectUri,
      clientId: 'stingerai',
      scopes: ['openid', 'profile', 'email'],
      responseType: 'token',
    },
    discovery
  );

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      setIsAuthenticated(true);
      // You can use the access token to fetch user info or make authenticated requests
      setUserInfo({ access_token });
    } else if (response?.type === 'error') {
      setError(response.params.error || 'Authentication failed');
    }
  }, [response]);

  const signIn = async () => {
    try {
      setLoading(true);
      setError(null);
      await promptAsync();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const signOut = () => {
    setIsAuthenticated(false);
    setUserInfo(null);
  };

  return {
    isAuthenticated,
    userInfo,
    error,
    loading,
    signIn,
    signOut,
  };
}; 