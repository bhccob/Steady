import { useColorScheme } from 'react-native';

import { themes, type Theme } from './tokens';

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? themes.dark : themes.light;
}
