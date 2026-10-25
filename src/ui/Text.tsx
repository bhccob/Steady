import { Text, type TextProps } from 'react-native';

import { MAX_FONT_SCALE, typeScale } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';

interface AppTextProps extends TextProps {
  variant?: keyof typeof typeScale;
  tone?: 'primary' | 'secondary';
}

/** Themed text that scales with Dynamic Type up to 200%. Place it inside a Glass core. */
export function AppText({ variant = 'body', tone = 'primary', style, ...rest }: AppTextProps) {
  const theme = useTheme();
  return (
    <Text
      maxFontSizeMultiplier={MAX_FONT_SCALE}
      style={[typeScale[variant], { color: theme.text[tone] }, style]}
      {...rest}
    />
  );
}
