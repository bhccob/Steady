import Constants from 'expo-constants';
import { authenticateAsync, hasHardwareAsync, isEnrolledAsync } from 'expo-local-authentication';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { listHarderTimes } from '../../src/db/dao/harderTimes';
import { listMeds, type Med } from '../../src/db/dao/meds';
import { getProfile, updateProfile, type Profile } from '../../src/db/dao/profile';
import { listSchedules, type Schedule } from '../../src/db/dao/schedules';
import { listConditions } from '../../src/db/dao/support';
import { formatHm } from '../../src/lib/time';
import { cancelAllScheduledNotificationsAsync, dismissAllNotificationsAsync } from '../../src/lib/notifications';
import { syncSoon } from '../../src/notify/expoPort';
import { useOnboarding } from '../../src/onboarding/store';
import { deleteEverything } from '../../src/settings/data';
import { removeExportFiles, shareExport } from '../../src/settings/exportFile';
import { scheduleSummary } from '../../src/settings/summary';
import { useApp } from '../../src/state/app';
import { LEVEL_NAMES } from '../../src/support/copy';
import { HAIRLINE, layout } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { Background } from '../../src/ui/Background';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { Button } from '../../src/ui/Button';
import { Icon } from '../../src/ui/Icon';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';
import { TimeStepper } from '../../src/ui/TimeStepper';
import { Toggle } from '../../src/ui/Toggle';

interface SettingsData {
  profile: Profile;
  meds: Med[];
  schedules: Schedule[];
  conditionCount: number;
  harderTimeCount: number;
}

type Sheet = 'name' | 'quiet' | 'delete' | 'disclaimer' | null;

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" tone="secondary" accessibilityRole="header">
        {title}
      </AppText>
      <View>{children}</View>
    </View>
  );
}

function Row({ label, value, onPress, lead }: { label: string; value?: string; onPress?: () => void; lead?: ReactNode }) {
  const body = (
    <>
      {lead}
      <AppText style={styles.grow}>{label}</AppText>
      {value ? (
        <AppText tone="secondary" style={styles.value} numberOfLines={2}>
          {value}
        </AppText>
      ) : null}
      {onPress ? <Icon name="chevron-right" size={18} /> : null}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" accessibilityLabel={value ? `${label}, ${value}` : label} onPress={onPress} style={styles.row}>
      {body}
    </Pressable>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={value ? `${label}, ${value}` : label}>
      {body}
    </View>
  );
}

export default function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const db = useSQLiteContext();
  const theme = useTheme();
  const openHelp = useApp((s) => s.openHelp);
  const [data, setData] = useState<SettingsData | null>(null);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [name, setName] = useState('');
  const [quiet, setQuiet] = useState({ startMin: 1320, endMin: 420 });
  const [confirmWord, setConfirmWord] = useState('');
  const [note, setNote] = useState('');
  const privacy = useApp((s) => s.privacy);
  const [lockReady, setLockReady] = useState<boolean | null>(null);

  useEffect(() => {
    Promise.all([hasHardwareAsync(), isEnrolledAsync()])
      .then(([hardware, enrolled]) => setLockReady(hardware && enrolled))
      .catch(() => setLockReady(false));
  }, []);

  const setLock = async (on: boolean) => {
    if (on) {
      if (!lockReady) return;
      // Check it works before relying on it, so nobody locks themselves out.
      const result = await authenticateAsync({ promptMessage: 'Turn on the lock' });
      if (!result.success) return;
    }
    await updateProfile(db, { biometricLock: on });
    useApp.getState().setPrivacy({ ...useApp.getState().privacy, lock: on });
  };

  const setHide = async (on: boolean) => {
    await updateProfile(db, { hideInSwitcher: on });
    useApp.getState().setPrivacy({ ...useApp.getState().privacy, hide: on });
  };

  const load = useCallback(async () => {
    const profile = await getProfile(db);
    if (!profile) return;
    setData({
      profile,
      meds: await listMeds(db),
      schedules: await listSchedules(db),
      conditionCount: (await listConditions(db)).length,
      harderTimeCount: (await listHarderTimes(db)).length,
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );
  useEffect(() => useApp.subscribe((s, prev) => s.dataVersion !== prev.dataVersion && load()), [load]);

  if (!data) return <Background />;
  const { profile } = data;

  const open = (s: Sheet) => {
    setName(profile.displayName);
    setQuiet({ startMin: profile.quietStartMin, endMin: profile.quietEndMin });
    setConfirmWord('');
    setSheet(s);
  };

  const saveName = async () => {
    await updateProfile(db, { displayName: name.trim() });
    setSheet(null);
    syncSoon(db);
    useApp.getState().bumpData();
  };

  const saveQuiet = async () => {
    await updateProfile(db, { quietStartMin: quiet.startMin, quietEndMin: quiet.endMin });
    setSheet(null);
    syncSoon(db);
    load();
  };

  const exportNow = async () => {
    setNote('');
    try {
      await shareExport(db);
    } catch {
      setNote("Couldn't open the share sheet. Try once more.");
    }
  };

  const deleteAll = async () => {
    if (confirmWord.trim().toLowerCase() !== 'delete') return;
    setSheet(null);
    await deleteEverything(db);
    removeExportFiles();
    await cancelAllScheduledNotificationsAsync().catch(() => {});
    await dismissAllNotificationsAsync().catch(() => {});
    useOnboarding.getState().reset();
    useApp.getState().setPrivacy({ lock: false, hide: false });
    router.replace('/onboarding');
  };

  const sleepValue = profile.bedtimeMin == null ? 'Off' : `Bed ${formatHm(profile.bedtimeMin)}`;
  const version = Constants.expoConfig?.version ?? '1.0.0';

  return (
    <Background>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.column}>
          <AppText variant="title" accessibilityRole="header">
            Settings
          </AppText>

          <Section title="You">
            <Row label="Name" value={profile.displayName.trim() || 'Not set'} onPress={() => open('name')} />
          </Section>

          <Section title="Meds and schedules">
            {data.meds.map((m) => {
              const s = data.schedules.find((x) => x.medId === m.id);
              const swatch = m.color ?? theme.accent;
              return (
                <Row
                  key={m.id}
                  label={m.label ?? 'my pill'}
                  value={scheduleSummary(s?.times ?? [], s?.days ?? [])}
                  onPress={() => router.push({ pathname: '/edit/med', params: { id: m.id } })}
                  lead={<View style={[styles.swatch, swatch.startsWith('linear') ? { backgroundImage: swatch } : { backgroundColor: swatch }]} />}
                />
              );
            })}
            <Button variant="link" label="+ Add a med" onPress={() => router.push('/edit/med')} style={styles.add} />
          </Section>

          <Section title="Reminders">
            <Row label="Quiet hours" value={`${formatHm(profile.quietStartMin)} to ${formatHm(profile.quietEndMin)}`} onPress={() => open('quiet')} />
          </Section>

          <Section title="My support">
            <Row label="What I'm working through" value={data.conditionCount ? String(data.conditionCount) : 'None'} onPress={() => router.push('/edit/support')} />
            <Row label="Support level" value={LEVEL_NAMES[profile.supportLevel]} onPress={() => router.push('/edit/level')} />
          </Section>

          <Section title="Sleep">
            <Row label="Bedtime reminders" value={sleepValue} onPress={() => router.push('/edit/sleep')} />
          </Section>

          <Section title="My patterns">
            <Toggle
              label="Show my harder times"
              hint="Your own patterns, shown back to you in the app. Off unless you turn it on."
              value={profile.cravingWindowsEnabled}
              onChange={async (on) => {
                await updateProfile(db, { cravingWindowsEnabled: on });
                useApp.getState().bumpData();
              }}
            />
            {profile.cravingWindowsEnabled ? (
              <Row label="My harder times" value={data.harderTimeCount ? String(data.harderTimeCount) : 'None set'} onPress={() => router.push('/edit/patterns')} />
            ) : null}
          </Section>

          <Section title="Privacy">
            <Toggle
              label="Lock with face or fingerprint"
              hint={lockReady === false ? 'Set up face or fingerprint unlock on your phone first.' : 'Asks when Steady opens, or after it has been away a while.'}
              value={privacy.lock}
              onChange={setLock}
            />
            <Toggle
              label="Hide in app switcher"
              hint={Platform.OS === 'ios' ? 'Blurs Steady in the app switcher.' : 'Shows a blank preview. On Android this also blocks screenshots.'}
              value={privacy.hide}
              onChange={setHide}
            />
          </Section>

          <Section title="Your data">
            <Row label="Export my data" value="JSON" onPress={exportNow} />
            <Row label="Delete everything" onPress={() => open('delete')} />
            {note ? (
              <AppText variant="caption" accessibilityRole="alert" style={styles.note}>
                {note}
              </AppText>
            ) : null}
          </Section>

          <Section title="About">
            <Row label="Crisis lines" onPress={() => openHelp('button')} />
            <Row label="Not medical advice" onPress={() => open('disclaimer')} />
            <Row label="Version" value={version} />
          </Section>
          <AppText variant="caption" tone="secondary" style={styles.footer}>
            Everything stays on this phone. No account, no tracking.
          </AppText>
        </View>
      </ScrollView>

      <BottomSheet visible={sheet === 'name'} onClose={() => setSheet(null)} title="Your name" subtitle="A first name or a nickname. Reminders use it.">
        <View style={styles.sheetBody}>
          <TextField label="Your name" placeholder="sam" value={name} onChangeText={setName} maxLength={40} autoComplete="given-name" />
          <Button label="Save" onPress={saveName} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'quiet'} onClose={() => setSheet(null)} title="Quiet hours" subtitle="Follow-up reminders wait until quiet hours end. Each dose's first reminder still comes at its time.">
        <View style={styles.sheetBody}>
          <View>
            <TimeStepper label="From" value={quiet.startMin} onChange={(v) => setQuiet({ ...quiet, startMin: v })} />
            <TimeStepper label="Until" value={quiet.endMin} onChange={(v) => setQuiet({ ...quiet, endMin: v })} />
          </View>
          <Button label="Save" onPress={saveQuiet} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={sheet === 'delete'}
        onClose={() => setSheet(null)}
        title="Delete everything?"
        subtitle="This removes your meds, doses, moods and guardians from this phone. It can't be undone."
      >
        <View style={styles.sheetBody}>
          <Button variant="link" label="Export my data first" onPress={exportNow} style={styles.add} />
          <TextField
            label={'Type "delete" to confirm'}
            placeholder="delete"
            value={confirmWord}
            onChangeText={setConfirmWord}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            label="Delete everything"
            onPress={deleteAll}
            accessibilityHint={confirmWord.trim().toLowerCase() === 'delete' ? undefined : 'Type delete first'}
            style={confirmWord.trim().toLowerCase() === 'delete' ? undefined : styles.dim}
          />
          <Button variant="secondary" label="Keep my data" onPress={() => setSheet(null)} />
        </View>
      </BottomSheet>

      <BottomSheet visible={sheet === 'disclaimer'} onClose={() => setSheet(null)} title="Not medical advice">
        <View style={styles.sheetBody}>
          <AppText>{"Steady helps you keep track. It isn't medical advice, and it doesn't replace care from your doctor or pharmacist."}</AppText>
          <AppText>Change or stop a medication only with them.</AppText>
          <AppText>If things feel like too much, a free crisis line is always two taps from Home.</AppText>
        </View>
      </BottomSheet>
    </Background>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: 22 },
  section: { gap: 4 },
  row: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  grow: { flex: 1 },
  value: { maxWidth: '55%', textAlign: 'right' },
  swatch: { width: 18, height: 18, borderRadius: 999, borderWidth: 1, borderColor: 'rgba(27, 22, 19, 0.22)' },
  add: { alignSelf: 'flex-start', paddingHorizontal: 0 },
  note: { marginTop: 8 },
  footer: { textAlign: 'center' },
  sheetBody: { gap: 12, marginTop: 8 },
  dim: { opacity: 0.45 },
});
