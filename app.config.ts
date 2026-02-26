import { ExpoConfig, ConfigContext } from 'expo/config';
import 'dotenv/config';

// Helper to get environment variables safely
function getEnvVarChecked(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    return '';
  }
  return value;
}

// Validate required environment variables
const requiredVars = [
  'EXPO_PUBLIC_SUPABASE_URL',
  'EXPO_PUBLIC_SUPABASE_ANON_KEY',
  'OPENROUTER_API_KEY'
];

export default ({ config }: ConfigContext): ExpoConfig => {
  const supabaseUrl = getEnvVarChecked('EXPO_PUBLIC_SUPABASE_URL');
  const supabaseAnonKey = getEnvVarChecked('EXPO_PUBLIC_SUPABASE_ANON_KEY');

  if (!supabaseUrl || !supabaseAnonKey) {
    process.exit(1);
  }

  return {
    ...config,
    name: 'StingerAI',
    slug: 'stingerai',
    version: '1.0.0-beta.1',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash.png',
      resizeMode: 'contain',
      backgroundColor: '#181A20'
    },
    updates: {
      fallbackToCacheTimeout: 0,
      url: 'https://u.expo.dev/56868a2d-b71a-4faa-a14c-8437b89c9651'
    },
    runtimeVersion: {
      policy: 'sdkVersion'
    },
    assetBundlePatterns: [
      "**/*",
      "assets/fonts/*"
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.rayalakiran.stingerai',
      config: {
        usesNonExemptEncryption: false
      }
    },
    android: {
      package: 'com.rayalakiran.stingerai',
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#FFFFFF'
      },
      softwareKeyboardLayoutMode: 'pan',
      permissions: [
        "INTERNET",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE"
      ]
    },
    web: {
      favicon: './assets/favicon.png'
    },
    plugins: [
      "expo-font",
      [
        "expo-build-properties",
        {
          "android": {
            "usesCleartextTraffic": true,
            "backgroundColor": "#181A20"
          }
        }
      ]
    ],
    extra: {
      supabaseUrl,
      supabaseAnonKey,
      openrouterApiKey: getEnvVarChecked('OPENROUTER_API_KEY'),
      eas: {
        projectId: "56868a2d-b71a-4faa-a14c-8437b89c9651"
      },
      debug: true
    }
  };
}; 