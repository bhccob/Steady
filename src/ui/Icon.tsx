import Feather from '@expo/vector-icons/Feather';
import type { ComponentProps } from 'react';

import { useTheme } from '../theme/useTheme';

export type IconName = ComponentProps<typeof Feather>['name'];

/** Decorative line icon in the theme's text colour. Pair it with a text label. */
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const theme = useTheme();
  return <Feather name={name} size={size} color={color ?? theme.text.primary} accessibilityElementsHidden importantForAccessibility="no" />;
}
