import { Buffer } from '@craftzdog/react-native-buffer';

declare global {
  var Buffer: typeof Buffer & {
    copyBytesFrom: (source: Uint8Array, target: Uint8Array) => void;
    poolSize: number;
  };
} 