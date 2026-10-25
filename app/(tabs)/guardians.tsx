import { presentContactPickerAsync } from 'expo-contacts/legacy';
import { getLocales } from 'expo-localization';
import { useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Platform, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ALL_CRISIS_LINES, CRISIS_REGIONS, crisisLineFor } from '../../src/constants/crisisLines';
import { insertGuardian, listGuardians, markGuardianAgreed, revokeGuardian, type Guardian } from '../../src/db/dao/guardians';
import { getProfile, updateProfile, type Profile } from '../../src/db/dao/profile';
import { inviteMessage, inviteUrl } from '../../src/guardians/invite';
import { callUrl, openUrl } from '../../src/lib/contact';
import type { DraftGuardian } from '../../src/onboarding/draft';
import { guardianButton } from '../../src/onboarding/guardianStep';
import { CHANNELS, CONTACT_FIELD, RELATIONSHIPS } from '../../src/onboarding/options';
import { useApp } from '../../src/state/app';
import { DECOR_FONT_SCALE, layout } from '../../src/theme/tokens';
import { useTheme } from '../../src/theme/useTheme';
import { Background } from '../../src/ui/Background';
import { BottomSheet } from '../../src/ui/BottomSheet';
import { Button } from '../../src/ui/Button';
import { Dropdown } from '../../src/ui/Dropdown';
import { Glass } from '../../src/ui/Glass';
import { Icon } from '../../src/ui/Icon';
import { AppText } from '../../src/ui/Text';
import { TextField } from '../../src/ui/TextField';

const EMPTY: DraftGuardian = { name: '', relationship: 'Friend', channel: 'whatsapp', contact: '' };
const AUTO = 'auto';
const channelLabel = (c: string) => CHANNELS.find((x) => x.value === c)?.label ?? c;

function status(g: Guardian): string {
  if (g.consentedAt) return 'connected';
  if (g.channel === 'inapp') return 'needs Steady accounts, coming later';
  return 'invite not answered yet';
}

/** People the user can reach out to, on their terms, and a free crisis line. */
export default function GuardiansScreen() {
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const theme = useTheme();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<DraftGuardian>(EMPTY);
  const [hint, setHint] = useState('');
  const [removing, setRemoving] = useState<Guardian | null>(null);

  const load = useCallback(async () => {
    setProfile(await getProfile(db));
    setGuardians(await listGuardians(db));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  if (!profile) return <Background />;

  const detected = getLocales()[0]?.regionCode ?? null;
  const line = crisisLineFor(profile.crisisRegion, detected);
  const contactField = CONTACT_FIELD[draft.channel];
  const add = guardianButton(draft);

  const sendInvite = async (g: { displayName: string; channel: Guardian['channel']; contact: string | null }) => {
    const message = inviteMessage(g.displayName, profile.displayName);
    const url = inviteUrl(g.channel, g.contact ?? '', message, Platform.OS === 'ios' ? 'ios' : 'android');
    if (url && (await openUrl(url))) return;
    await Share.share({ message }).catch(() => {});
  };

  const pickContact = async () => {
    try {
      const c = await presentContactPickerAsync();
      if (!c) return;
      const phone = c.phoneNumbers?.[0]?.number ?? '';
      setDraft({ ...draft, name: c.firstName ?? c.name ?? draft.name, contact: draft.channel === 'whatsapp' || draft.channel === 'sms' ? phone : draft.contact });
      setHint('');
    } catch {
      setHint("Couldn't open your contacts. Type it in instead.");
    }
  };

  const save = async () => {
    if (add.action !== 'add') {
      setHint(add.action === 'needs_name' ? 'Add their name first.' : 'Add their name to continue.');
      return;
    }
    const g = { displayName: draft.name.trim(), channel: draft.channel, contact: draft.contact.trim() || null, relationship: draft.relationship };
    await insertGuardian(db, g);
    setAdding(false);
    await load();
    if (g.channel !== 'inapp') await sendInvite(g);
  };

  const setRegion = async (v: string) => {
    const region = v === AUTO ? null : v;
    await updateProfile(db, { crisisRegion: region });
    useApp.getState().setCrisisRegion(region);
    load();
  };

  return (
    <Background>
      <ScrollView contentContainerStyle={[styles.scroll, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 120 }]}>
        <View style={styles.column}>
          <View>
            <AppText variant="title" accessibilityRole="header">
              Guardians
            </AppText>
            <AppText tone="secondary">They hear from you only when you ask. Never about a missed dose.</AppText>
          </View>

          <View>
            {guardians.length === 0 ? (
              <AppText tone="secondary" style={styles.empty}>
                No one yet. Add someone you trust, like a friend, a partner or a carer.
              </AppText>
            ) : null}
            {guardians.map((g) => (
              <View key={g.id} style={styles.person}>
                <View style={styles.personTop}>
                  <View style={[styles.avatar, { backgroundColor: theme.glass.overlay, borderColor: theme.glass.border }]}>
                    <AppText variant="bodyStrong" maxFontSizeMultiplier={DECOR_FONT_SCALE} importantForAccessibility="no">
                      {g.displayName.slice(0, 1).toUpperCase()}
                    </AppText>
                  </View>
                  <View style={styles.grow}>
                    <AppText variant="bodyStrong">{g.displayName}</AppText>
                    <AppText variant="caption" tone="secondary">
                      {[g.relationship, channelLabel(g.channel)].filter(Boolean).join(' · ')}
                    </AppText>
                    <View style={styles.statusRow}>
                      {g.consentedAt ? <Icon name="check" size={13} /> : null}
                      <AppText variant="caption">{status(g)}</AppText>
                    </View>
                  </View>
                </View>
                <View style={styles.actions}>
                  {!g.consentedAt && g.channel !== 'inapp' ? (
                    <>
                      <Button variant="link" label="Send invite" onPress={() => sendInvite(g)} style={styles.action} />
                      <Button
                        variant="link"
                        label="They said yes"
                        accessibilityHint="Lets you reach them from the help sheet"
                        onPress={async () => {
                          await markGuardianAgreed(db, g.id);
                          load();
                        }}
                        style={styles.action}
                      />
                    </>
                  ) : null}
                  <Button variant="link" label="Remove" accessibilityLabel={`Remove ${g.displayName}`} onPress={() => setRemoving(g)} style={styles.action} />
                </View>
              </View>
            ))}
          </View>

          <Button
            variant="secondary"
            label="+ Add someone"
            onPress={() => {
              setDraft(EMPTY);
              setHint('');
              setAdding(true);
            }}
          />

          <Glass contentStyle={styles.crisis}>
            {line ? (
              <View style={styles.crisisTop}>
                <View style={styles.grow}>
                  <AppText variant="caption" tone="secondary">
                    Crisis line · {line.country} · free · 24/7
                  </AppText>
                  <AppText variant="title">{line.number}</AppText>
                </View>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Call ${line.number}`}
                  onPress={() => openUrl(callUrl(line.number))}
                  style={[styles.call, { backgroundColor: theme.accent, borderBottomColor: theme.accentDeep }]}
                >
                  <Icon name="phone" size={18} color={theme.onAccent} />
                  <AppText variant="bodyStrong" style={{ color: theme.onAccent }}>
                    Call
                  </AppText>
                </Pressable>
              </View>
            ) : (
              ALL_CRISIS_LINES.map((l) => (
                <Pressable key={l.country} accessibilityRole="button" accessibilityLabel={`Call ${l.country} crisis line, ${l.number}`} onPress={() => openUrl(callUrl(l.number))} style={styles.lineRow}>
                  <AppText style={styles.grow}>{l.country}</AppText>
                  <AppText variant="bodyStrong">{l.number}</AppText>
                </Pressable>
              ))
            )}
            <Dropdown
              label="Country for the crisis line"
              value={profile.crisisRegion ?? AUTO}
              options={[{ value: AUTO, label: "Use my phone's region" }, ...CRISIS_REGIONS]}
              onChange={setRegion}
            />
          </Glass>
        </View>
      </ScrollView>

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title="Add someone" subtitle="They'll be asked first. Either of you can stop any time.">
        <View style={styles.sheetBody}>
          <Button variant="secondary" label="Pick from contacts" icon={<Icon name="user" size={18} />} onPress={pickContact} />
          <View style={styles.row}>
            <View style={styles.half}>
              <TextField
                label="Their name"
                placeholder="Alex"
                value={draft.name}
                onChangeText={(name) => {
                  setHint('');
                  setDraft({ ...draft, name });
                }}
                maxLength={40}
              />
            </View>
            <View style={styles.half}>
              <Dropdown label="Who they are" value={draft.relationship} options={RELATIONSHIPS} onChange={(relationship) => setDraft({ ...draft, relationship })} />
            </View>
          </View>
          <Dropdown label="How to reach them" value={draft.channel} options={CHANNELS} onChange={(channel) => setDraft({ ...draft, channel, contact: '' })} />
          <TextField
            label={contactField.label}
            placeholder={contactField.placeholder}
            hint={draft.channel === 'inapp' ? 'Connecting inside Steady needs accounts, which are coming later. Pick another way for now.' : contactField.hint}
            value={draft.contact}
            onChangeText={(contact) => setDraft({ ...draft, contact })}
            keyboardType={contactField.phone ? 'phone-pad' : 'default'}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {hint ? (
            <AppText accessibilityRole="alert" accessibilityLiveRegion="polite">
              {hint}
            </AppText>
          ) : null}
          <Button label={add.action !== 'add' ? 'Add' : draft.channel === 'inapp' ? add.label : `${add.label} and send invite`} onPress={save} />
        </View>
      </BottomSheet>

      <BottomSheet
        visible={removing !== null}
        onClose={() => setRemoving(null)}
        title={removing ? `Remove ${removing.displayName}?` : ''}
        subtitle="They won't be told. You can add them again any time."
      >
        <View style={styles.sheetBody}>
          <Button
            label="Remove"
            onPress={async () => {
              if (removing) await revokeGuardian(db, removing.id);
              setRemoving(null);
              load();
            }}
          />
          <Button variant="secondary" label="Keep them" onPress={() => setRemoving(null)} />
        </View>
      </BottomSheet>
    </Background>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: layout.gutter },
  column: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: 18 },
  grow: { flex: 1 },
  empty: { paddingVertical: 8 },
  person: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: 'rgba(27, 22, 19, 0.08)', gap: 4 },
  personTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, paddingLeft: 56 },
  action: { paddingHorizontal: 0 },
  crisis: { padding: 16, gap: 12 },
  crisisTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  call: { minHeight: 48, paddingHorizontal: 18, borderRadius: 999, borderBottomWidth: 4, flexDirection: 'row', alignItems: 'center', gap: 6 },
  lineRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(27, 22, 19, 0.08)' },
  sheetBody: { gap: 12, marginTop: 8 },
  row: { flexDirection: 'row', gap: 10 },
  half: { flex: 1 },
});
