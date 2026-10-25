import { Platform } from 'react-native';

// Loads the widget's handler on Android only; iOS widgets need separate native work.
if (Platform.OS === 'android') {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./handler');
}
