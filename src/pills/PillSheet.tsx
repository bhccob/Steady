import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { getMed } from '../db/dao/meds';
import { getProfile } from '../db/dao/profile';
import { listSchedules } from '../db/dao/schedules';
import { formatHm, parseHm } from '../lib/time';
import { syncSoon } from '../notify/port';
import { MED_FORMS, PILL_COLOURS } from '../onboarding/options';
import { archiveMed, firstReminderOf, saveMed, type MedInput } from '../settings/meds';
import { useApp } from '../state/app';
import { HAIRLINE, layout, radius } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { BottomSheet } from '../ui/BottomSheet';
import { Button } from '../ui/Button';
import { DayPicker } from '../ui/DayPicker';
import { Dropdown } from '../ui/Dropdown';
import { GlowPressable } from '../ui/GlowPressable';
import { Icon, type IconName } from '../ui/Icon';
import { AppText } from '../ui/Text';
import { TextField } from '../ui/TextField';
import { TimeStepper } from '../ui/TimeStepper';
import { addedNote } from './note';
import { PillPicture } from './PillPicture';
import { addOtherTime, otherTimes, TIME_TILES, toggleTile } from './times';

const NEW_PILL: MedInput = { label: '', amount: '', form: 'pill', color: '#F5DA6B', times: [480], days: [] };

type Page = 'main' | 'look' | 'stop';

/**
 * Add a pill, or change one: a picture to tap for colour and shape, a name, time tiles and days.
 * Opens from Home and Settings; lives beside the tabs so both share it.
 */
export function PillSheet() {
  const db = useSQLiteContext();
  const sheet = useApp((s) => s.pillSheet);
  const close = useApp((s) => s.closePillSheet);
  const [pill, setPill] = useState<MedInput | null>(null);
  const [page, setPage] = useState<Page>('main');
  const [showDays, setShowDays] = useState(false);
  const [saving, setSaving] = useState(false);
  const id = sheet?.id;

  // Each opening starts fresh: a new pill, or the chosen one loaded below.
  const [opened, setOpened] = useState(sheet);
  if (sheet !== opened) {
    setOpened(sheet);
    if (sheet) {
      setPage('main');
      setShowDays(false);
      setSaving(false);
      setPill(sheet.id ? null : NEW_PILL);
    }
  }

  useEffect(() => {
    if (!sheet?.id) return;
    (async () => {
      const m = await getMed(db, sheet.id!);
      const schedule = (await listSchedules(db)).find((s) => s.medId === sheet.id);
      if (!m) return;
      setPill({
        label: m.label ?? '',
        amount: m.doseAmount ?? '',
        form: m.form,
        color: m.color ?? NEW_PILL.color,
        times: schedule?.times.map(parseHm) ?? [480],
        days: schedule?.days ?? [],
      });
    })();
  }, [db, sheet]);

  const set = (p: Partial<MedInput>) => pill && setPill({ ...pill, ...p });
  const setTimes = (times: number[]) => set({ times: [...new Set(times)].sort((a, b) => a - b) });
  const name = pill?.label.trim() || 'my pill';

  const finish = () => {
    syncSoon(db);
    useApp.getState().bumpData();
    close();
  };

  const save = async () => {
    const profile = await getProfile(db);
    if (!pill || !profile || saving) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      const saved = await saveMed(db, { ...pill, id }, { now, timezone: profile.timezone, notBefore: profile.createdAt });
      if (!id) {
        const clock = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', timeZone: profile.timezone });
        const firstDueUtc = await firstReminderOf(db, saved, now);
        useApp.getState().setJustAdded({
          medId: saved,
          colour: pill.color,
          form: pill.form,
          at: Date.now(),
          note: addedNote({ name: pill.label, firstDueUtc, nowIso: now, timeZone: profile.timezone, clock }),
        });
      }
      finish();
    } finally {
      setSaving(false);
    }
  };

  const stop = async () => {
    if (!id) return;
    await archiveMed(db, id);
    finish();
  };

  const colourName = PILL_COLOURS.find((c) => c.value === pill?.color)?.label ?? '';
  const formName = MED_FORMS.find((f) => f.value === pill?.form)?.label ?? '';
  const daysText = !pill || pill.days.length === 0 ? 'Every day' : `${pill.days.length} days a week`;
  const title = page === 'look' ? 'How it looks' : page === 'stop' ? `Stop ${name}?` : id ? name : 'Add a pill';
  const subtitle =
    page === 'stop' ? 'No more reminders for it. Its history stays in Calendar and Insights.' : page === 'main' && !id ? 'Meds, vitamins or supplements.' : undefined;

  return (
    <BottomSheet visible={sheet !== null} onClose={page === 'main' ? close : () => setPage('main')} title={title} subtitle={subtitle}>
      {pill && page === 'main' ? (
        <View style={styles.body}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`How it looks: ${`${colourName} ${formName}`.toLowerCase()}`}
            accessibilityHint="Change its colour and shape"
            onPress={() => setPage('look')}
            style={styles.picture}
          >
            <PillPicture form={pill.form} colour={pill.color} size={150} />
            <AppText variant="caption" tone="secondary">
              Tap to change its colour and shape
            </AppText>
          </Pressable>

          <TextField label="What is it?" placeholder="my pill" value={pill.label} onChangeText={(t) => set({ label: t })} maxLength={40} />

          <AppText variant="label" tone="secondary" style={styles.section}>
            When?
          </AppText>
          <View style={styles.tiles}>
            {TIME_TILES.map((t) => (
              <Tile key={t.label} icon={t.icon} label={t.label} time={formatHm(t.minutes)} on={pill.times.includes(t.minutes)} onPress={() => setTimes(toggleTile(pill.times, t.minutes))} />
            ))}
            <Tile icon="plus" label="Other time" onPress={() => setTimes(addOtherTime(pill.times))} />
          </View>
          {otherTimes(pill.times).map((t, i) => (
            <TimeStepper
              key={i}
              label="Other time"
              value={t}
              onChange={(v) => setTimes(pill.times.map((x) => (x === t ? v : x)))}
              onRemove={pill.times.length > 1 ? () => setTimes(pill.times.filter((x) => x !== t)) : undefined}
            />
          ))}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${daysText}. Change days`}
            accessibilityState={{ expanded: showDays }}
            onPress={() => setShowDays(!showDays)}
            style={styles.daysRow}
          >
            <AppText style={styles.grow}>{daysText}</AppText>
            <AppText tone="secondary">{showDays ? 'Done' : 'Change'}</AppText>
            <Icon name={showDays ? 'chevron-up' : 'chevron-down'} size={18} />
          </Pressable>
          {showDays ? <DayPicker days={pill.days} onChange={(days) => set({ days })} /> : null}

          <Button label={saving ? 'Saving…' : id ? 'Save' : `Add ${name}`} onPress={save} style={styles.cta} />
          {id ? <Button variant="link" label="Stop this pill" onPress={() => setPage('stop')} style={styles.stop} /> : null}
        </View>
      ) : null}

      {pill && page === 'look' ? <Look pill={pill} set={set} onDone={() => setPage('main')} /> : null}

      {page === 'stop' ? (
        <View style={styles.body}>
          <Button label="Stop it" onPress={stop} />
          <Button variant="secondary" label="Keep it" onPress={() => setPage('main')} />
        </View>
      ) : null}
    </BottomSheet>
  );
}

/** One of the time quick picks: an icon, a name and its clock time. */
function Tile({ icon, label, time, on = false, onPress }: { icon: IconName; label: string; time?: string; on?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <GlowPressable
      radius={radius.control}
      accessibilityRole={time ? 'checkbox' : 'button'}
      accessibilityLabel={time ? `${label}, ${time}` : label}
      accessibilityState={time ? { checked: on } : undefined}
      onPress={onPress}
      style={[
        styles.tile,
        on
          ? { backgroundColor: theme.accent, borderColor: theme.accentLine, borderBottomColor: theme.accentDeep, borderBottomWidth: 3 }
          : { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border },
      ]}
    >
      <Icon name={icon} size={18} color={on ? theme.onAccent : theme.text.primary} />
      <View>
        <AppText variant="bodyStrong" style={on && { color: theme.onAccent }}>
          {label}
        </AppText>
        {time ? (
          <AppText variant="caption" tone={on ? 'primary' : 'secondary'} style={on && { color: theme.onAccent }}>
            {time}
          </AppText>
        ) : null}
      </View>
    </GlowPressable>
  );
}

/** The pill's look: colour dots, shape and an optional amount. The picture follows every pick. */
function Look({ pill, set, onDone }: { pill: MedInput; set: (p: Partial<MedInput>) => void; onDone: () => void }) {
  const theme = useTheme();
  return (
    <View style={styles.body}>
      <View style={styles.picture}>
        <PillPicture form={pill.form} colour={pill.color} size={150} />
      </View>
      <AppText variant="label" tone="secondary">
        Colour
      </AppText>
      {/* Rows of five, each dot flex: 1. Percent widths that add up to 100% wrap early on Android. */}
      <View style={styles.swatches}>
        {PILL_COLOURS.filter((_, i) => i % 5 === 0).map((_, row) => row * 5).map((start) => (
          <View key={start} style={styles.swatchRow}>
            {PILL_COLOURS.slice(start, start + 5).map((c) => {
              const on = c.value === pill.color;
              return (
                <Pressable
                  key={c.value}
                  accessibilityRole="radio"
                  accessibilityLabel={c.label}
                  accessibilityState={{ selected: on }}
                  onPress={() => set({ color: c.value })}
                  style={styles.swatchCell}
                >
                  <View style={[styles.ring, { borderColor: on ? theme.text.primary : 'transparent' }]}>
                    <View style={[styles.swatch, c.value.startsWith('linear-gradient') ? { backgroundImage: c.value } : { backgroundColor: c.value }]} />
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
      <Dropdown label="Shape" value={pill.form} options={MED_FORMS} onChange={(form) => set({ form })} />
      <TextField label="How much (optional)" placeholder="1 tablet" value={pill.amount} onChangeText={(t) => set({ amount: t })} maxLength={30} />
      <Button label="Done" onPress={onDone} style={styles.cta} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingBottom: 8 },
  picture: { alignItems: 'center', gap: 2, paddingVertical: 4 },
  section: { marginTop: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: {
    flexBasis: '45%',
    flexGrow: 1,
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.control,
    borderWidth: 1,
  },
  daysRow: { minHeight: layout.minTarget + 8, flexDirection: 'row', alignItems: 'center', gap: 6, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  grow: { flex: 1 },
  cta: { marginTop: 4 },
  stop: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  swatches: { marginTop: -4 },
  swatchRow: { flexDirection: 'row' },
  swatchCell: { flex: 1, height: 52, alignItems: 'center', justifyContent: 'center' },
  ring: { width: 46, height: 46, borderRadius: 99, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  swatch: { width: 36, height: 36, borderRadius: 99, borderWidth: 1, borderColor: 'rgba(27, 22, 19, 0.14)' },
});
