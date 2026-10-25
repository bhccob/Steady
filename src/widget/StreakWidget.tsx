// The Android home-screen (and, on Android 16+, lock-screen) widget. Only loaded inside a
// development or store build: this library's native side is missing in Expo Go.
import { FlexWidget, TextWidget } from 'react-native-android-widget';

import type { WidgetState } from './state';

type HexColor = `#${string}`;

interface Palette {
  bg: HexColor;
  text: HexColor;
  soft: HexColor;
  accent: HexColor;
  accentDeep: HexColor;
  onAccent: HexColor;
}

/** The app's warm beige, as solid colours (widgets don't do glass). */
export const WIDGET_PALETTES: { light: Palette; dark: Palette } = {
  light: { bg: '#F5F3EF', text: '#1B1613', soft: '#6B625A', accent: '#E8D5B5', accentDeep: '#CDB38C', onAccent: '#1B1613' },
  dark: { bg: '#1C1814', text: '#F3ECE2', soft: '#B5ADA3', accent: '#D9C29C', accentDeep: '#A8916A', onAccent: '#1B1613' },
};

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Streak, the next time with a Taken button when it can be marked, and today's count. Tapping elsewhere opens Steady. */
export function StreakWidget({ state, palette: p }: { state: WidgetState | null; palette: Palette }) {
  if (!state) {
    return (
      <FlexWidget clickAction="OPEN_APP" style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 24, padding: 16, justifyContent: 'center' }}>
        <TextWidget text="Steady" style={{ fontSize: 16, fontWeight: '600', color: p.text }} />
        <TextWidget text="Open Steady to set up." style={{ fontSize: 13, color: p.soft }} />
      </FlexWidget>
    );
  }
  const { next } = state;
  const line = next ? (next.markable ? `Next · ${next.time}` : `Next at ${next.time}`) : state.dueToday ? 'All marked today' : 'Nothing due today';
  return (
    <FlexWidget
      clickAction="OPEN_APP"
      accessibilityLabel={`Steady. ${plural(state.streak, 'day', 'days')} streak. ${line}. ${state.markedToday} of ${state.dueToday} marked today.`}
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: p.bg, borderRadius: 24, padding: 14, flexDirection: 'column', justifyContent: 'space-between' }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <TextWidget text="Steady" style={{ fontSize: 14, fontWeight: '600', color: p.text }} />
        <TextWidget text={`${plural(state.streak, 'day', 'days')}`} style={{ fontSize: 13, color: p.soft }} />
      </FlexWidget>
      <TextWidget text={line} style={{ fontSize: 18, fontWeight: '600', color: p.text }} maxLines={1} truncate="END" />
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        {next?.markable ? (
          <FlexWidget
            clickAction="MARK"
            clickActionData={{ doseIds: next.doseIds }}
            accessibilityLabel={`Mark taken, due ${next.time}`}
            style={{ backgroundColor: p.accent, borderRadius: 999, borderBottomWidth: 3, borderBottomColor: p.accentDeep, paddingHorizontal: 18, paddingVertical: 8 }}
          >
            <TextWidget text="Taken" style={{ fontSize: 14, fontWeight: '600', color: p.onAccent }} />
          </FlexWidget>
        ) : (
          <TextWidget text=" " style={{ fontSize: 14 }} />
        )}
        <TextWidget text={`${state.markedToday} of ${state.dueToday} today`} style={{ fontSize: 13, color: p.soft }} />
      </FlexWidget>
    </FlexWidget>
  );
}
