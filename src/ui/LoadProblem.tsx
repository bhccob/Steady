import { StyleSheet, View } from 'react-native';

import { layout } from '../theme/tokens';
import { Background } from './Background';
import { Button } from './Button';
import { AppText } from './Text';

/** Shown instead of a blank screen when a tab couldn't load. The detail helps tell us why. */
export function LoadProblem({ what, problem, onRetry }: { what: string; problem: string; onRetry: () => void }) {
  return (
    <Background>
      <View style={styles.center}>
        <AppText variant="title" accessibilityRole="header" style={styles.text}>
          {`Couldn't open ${what}.`}
        </AppText>
        <AppText tone="secondary" style={styles.text}>
          Your data is safe. Try once more.
        </AppText>
        <Button label="Try again" onPress={onRetry} style={styles.button} />
        <AppText variant="caption" tone="secondary" style={styles.text} selectable>
          {problem}
        </AppText>
      </View>
    </Background>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', gap: 10, paddingHorizontal: layout.gutter, width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center' },
  text: { textAlign: 'center' },
  button: { marginTop: 12 },
});
