import 'react-native-gesture-handler';
import 'react-native-get-random-values';
import 'react-native-url-polyfill/auto';
import { Buffer } from '@craftzdog/react-native-buffer';
import { registerRootComponent } from 'expo';

import App from './App';

// Add Buffer to global with a more specific type assertion that matches what TypeScript expects
// @ts-ignore - Suppressing TypeScript error for Buffer assignment
global.Buffer = Buffer;

// Setup patch for gesture handler to fix topGestureHandlerEvent errors
if (__DEV__) {
  try {
    // This helps prevent "Unsupported top level event type" errors
    // @ts-ignore - Bypassing TypeScript for runtime patch
    const originalDefineProperty = Object.defineProperty;
    // @ts-ignore - Bypassing TypeScript for runtime patch
    Object.defineProperty = function(object: any, name: string, meta: PropertyDescriptor) {
      // Skip problematic property that causes gesture handler issues
      if (name === 'currentlyFocusedField' && object && typeof object.getConstants === 'function') {
        return object;
      }
      // @ts-ignore - Call original with arguments
      return originalDefineProperty.apply(this, arguments);
    };
  } catch (e) {
    console.warn('Failed to apply gesture handler patches', e);
  }
}

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
