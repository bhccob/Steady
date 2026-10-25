import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalendarView } from '../../src/calendar/CalendarView';
import { useHistory } from '../../src/calendar/useHistory';
import { DaySheet } from '../../src/home/DaySheet';
import type { PathEntry } from '../../src/home/path';
import { InsightsView } from '../../src/insights/InsightsView';
import { layout } from '../../src/theme/tokens';
import { Background } from '../../src/ui/Background';
import { Segmented } from '../../src/ui/Segmented';

type View_ = 'calendar' | 'insights';

export default function CalendarScreen() {
  const insets = useSafeAreaInsets();
  const { data, mark } = useHistory();
  const [view, setView] = useState<View_>('calendar');
  const [day, setDay] = useState<PathEntry | null>(null);

  if (!data) return <Background />;

  const tz = data.profile.timezone;
  const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: tz });

  return (
    <Background>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.column}>
          <Segmented
            label="Calendar or Insights"
            options={[
              { value: 'calendar', label: 'Calendar' },
              { value: 'insights', label: 'Insights' },
            ]}
            value={view}
            onChange={setView}
          />
          {view === 'calendar' ? <CalendarView data={data} onOpenDay={setDay} /> : <InsightsView data={data} />}
        </View>
      </ScrollView>

      <DaySheet
        entry={day}
        justCollected={false}
        doses={data.doses}
        meds={data.meds}
        today={data.today}
        nowMs={data.nowMs}
        clock={clock}
        onMark={async (id) => {
          setDay(null);
          await mark(id);
        }}
        onClose={() => setDay(null)}
      />
    </Background>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: 18 },
});
