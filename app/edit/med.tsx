import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { getMed } from '../../src/db/dao/meds';
import { getProfile } from '../../src/db/dao/profile';
import { listSchedules } from '../../src/db/dao/schedules';
import { parseHm } from '../../src/lib/time';
import { syncSoon } from '../../src/notify/expoPort';
import { MED_FORMS, PILL_COLOURS } from '../../src/onboarding/options';
import { StepLayout } from '../../src/onboarding/StepLayout';
import { archiveMed, saveMed, type MedInput } from '../../src/settings/meds';
import { useApp } from '../../src/state/app';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { Button } from '../../src/ui/Button';
import { DayPicker } from '../../src/ui/DayPicker';
import { Dropdown } from '../../src/ui/Dropdown';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';
import { TimesEditor } from '../../src/ui/TimesEditor';

const NEW_MED: MedInput = { label: '', amount: '', form: 'pill', color: '#F5DA6B', times: [480], days: [] };

/** Add a med, or change one: name, amount, form, colour, times and days. */
export default function MedEditor() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [med, setMed] = useState<MedInput | null>(id ? null : NEW_MED);
  const [confirmStop, setConfirmStop] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const m = await getMed(db, id);
      const schedule = (await listSchedules(db)).find((s) => s.medId === id);
      if (!m) return;
      setMed({
        label: m.label ?? '',
        amount: m.doseAmount ?? '',
        form: m.form,
        color: m.color ?? NEW_MED.color,
        times: schedule?.times.map(parseHm) ?? [480],
        days: schedule?.days ?? [],
      });
    })();
  }, [db, id]);

  const done = () => {
    syncSoon(db);
    useApp.getState().bumpData();
    router.back();
  };

  const save = async () => {
    const profile = await getProfile(db);
    if (!med || !profile || saving) return;
    setSaving(true);
    await saveMed(db, { ...med, id }, { now: new Date().toISOString(), timezone: profile.timezone, notBefore: profile.createdAt });
    done();
  };

  const stop = async () => {
    if (!id) return;
    setConfirmStop(false);
    await archiveMed(db, id);
    done();
  };

  const name = med?.label.trim() || 'my pill';
  const set = (p: Partial<MedInput>) => med && setMed({ ...med, ...p });

  return (
    <StepLayout
      title={id ? name : 'Add a med'}
      subtitle={'A name is optional. "my pill" works fine.'}
      footer={<Button label={saving ? 'Saving…' : 'Save'} onPress={save} />}
    >
      {med ? (
        <>
          <View style={styles.row}>
            <View style={styles.wide}>
              <TextField label="Name (optional)" placeholder="my pill" value={med.label} onChangeText={(t) => set({ label: t })} maxLength={40} />
            </View>
            <View style={styles.narrow}>
              <TextField label="Amount" placeholder="1 tablet" value={med.amount} onChangeText={(t) => set({ amount: t })} maxLength={30} />
            </View>
          </View>
          <View style={styles.row}>
            <View style={styles.half}>
              <Dropdown label="Form" value={med.form} options={MED_FORMS} onChange={(v) => set({ form: v })} />
            </View>
            <View style={styles.half}>
              <Dropdown label="Colour" value={med.color} options={PILL_COLOURS} onChange={(v) => set({ color: v })} />
            </View>
          </View>
          <AppText variant="bodyStrong" accessibilityRole="header" style={styles.section}>
            When
          </AppText>
          <TimesEditor times={med.times} onChange={(times) => set({ times })} />
          <DayPicker days={med.days} onChange={(days) => set({ days })} />
          {id ? <Button variant="link" label="Stop taking this med" onPress={() => setConfirmStop(true)} style={styles.stop} /> : null}
        </>
      ) : null}

      <BottomSheet visible={confirmStop} onClose={() => setConfirmStop(false)} title={`Stop ${name}?`} subtitle="No more reminders for it. Its history stays in Calendar and Insights.">
        <View style={styles.sheetButtons}>
          <Button label="Stop it" onPress={stop} />
          <Button variant="secondary" label="Keep it" onPress={() => setConfirmStop(false)} />
        </View>
      </BottomSheet>
    </StepLayout>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 10 },
  wide: { flex: 3 },
  narrow: { flex: 2 },
  half: { flex: 1 },
  section: { marginTop: 8 },
  stop: { alignSelf: 'flex-start', paddingHorizontal: 0, marginTop: 8 },
  sheetButtons: { gap: 8, marginTop: 12 },
});
