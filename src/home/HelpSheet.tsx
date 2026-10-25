import { getLocales } from 'expo-localization';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';

import { ALL_CRISIS_LINES, crisisLineFor } from '../constants/crisisLines';
import { listGuardians, type Guardian } from '../db/dao/guardians';
import { callUrl, messageUrl, openUrl } from '../lib/contact';
import { useApp } from '../state/app';
import { BottomSheet, SheetRow } from '../ui/BottomSheet';

const MESSAGE_VERB: Record<string, string> = { whatsapp: 'WhatsApp', sms: 'Text', wechat: 'WeChat', instagram: 'Message' };

/**
 * Reach out: the guardian's own apps and a free crisis line. Never contacts anyone by
 * itself; every row is a tap the user makes. Pending guardians can't be reached yet.
 */
export function HelpSheet() {
  const db = useSQLiteContext();
  const help = useApp((s) => s.help);
  const closeHelp = useApp((s) => s.closeHelp);
  const crisisRegion = useApp((s) => s.crisisRegion);
  const [guardians, setGuardians] = useState<Guardian[]>([]);

  useEffect(() => {
    if (help) listGuardians(db).then(setGuardians);
  }, [help, db]);

  const line = crisisLineFor(crisisRegion, getLocales()[0]?.regionCode);
  const lines = line ? [line] : ALL_CRISIS_LINES;
  const rough = help === 'rough';
  // Rough check-ins and open doses offer the sheet unasked, so they also get a way to say "I'm okay".
  const offered = help === 'rough' || help === 'overdue';
  const title = rough ? 'Thanks for telling us.' : help === 'overdue' ? 'Checking in.' : 'Reach out';
  const subtitle = rough
    ? 'Want someone close right now?'
    : help === 'overdue'
      ? 'No pressure about the dose. If today feels heavy, these are here.'
      : "You don't have to do this alone.";

  return (
    <BottomSheet visible={help !== null} onClose={closeHelp} title={title} subtitle={subtitle}>
      {guardians.map((g) => {
        if (!g.consentedAt || !g.contact) {
          return <SheetRow key={g.id} icon="user" label={g.displayName} hint="Invite pending, can't reach them yet" />;
        }
        const msg = messageUrl(g.channel, g.contact);
        const phone = g.channel === 'whatsapp' || g.channel === 'sms';
        return [
          phone ? <SheetRow key={`${g.id}-call`} icon="phone" label={`Call ${g.displayName}`} onPress={() => openUrl(callUrl(g.contact!))} /> : null,
          msg ? (
            <SheetRow
              key={`${g.id}-msg`}
              icon="message-circle"
              label={`${MESSAGE_VERB[g.channel]} ${g.displayName}`}
              hint={g.channel === 'wechat' ? 'Opens WeChat' : undefined}
              onPress={() => openUrl(msg)}
            />
          ) : null,
        ];
      })}
      {lines.map((l, i) => (
        <SheetRow
          key={l.country}
          icon="life-buoy"
          label={`Crisis line · ${l.number}`}
          hint={`free · 24/7 · ${l.country}`}
          onPress={() => openUrl(callUrl(l.number))}
          last={!offered && i === lines.length - 1}
        />
      ))}
      {offered ? <SheetRow icon="smile" label="I'm okay for now" onPress={closeHelp} last /> : null}
    </BottomSheet>
  );
}
