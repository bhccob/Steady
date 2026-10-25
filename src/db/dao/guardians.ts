import { newId } from '../../lib/id';
import { nowIso } from '../../lib/time';
import type { GuardianChannel } from '../schema';
import type { Db } from '../types';

export interface Guardian {
  id: string;
  displayName: string;
  relationship: string | null;
  channel: GuardianChannel;
  /** Phone or handle. Null for in-app only. */
  contact: string | null;
  /** Null until the guardian accepts; until then they cannot be pinged. */
  consentedAt: string | null;
  inviteToken: string | null;
  shareMedNames: boolean;
  createdAt: string;
}

interface GuardianRow {
  id: string;
  display_name: string;
  relationship: string | null;
  channel: GuardianChannel;
  contact: string | null;
  consented_at: string | null;
  invite_token: string | null;
  share_med_names: number;
  created_at: string;
}

function fromRow(r: GuardianRow): Guardian {
  return {
    id: r.id,
    displayName: r.display_name,
    relationship: r.relationship,
    channel: r.channel,
    contact: r.contact,
    consentedAt: r.consented_at,
    inviteToken: r.invite_token,
    shareMedNames: r.share_med_names === 1,
    createdAt: r.created_at,
  };
}

/** Active guardians only; revoked ones are gone from every surface. */
export async function listGuardians(db: Db): Promise<Guardian[]> {
  const rows = await db.getAllAsync<GuardianRow>(
    'SELECT * FROM guardians WHERE revoked_at IS NULL ORDER BY created_at, rowid',
    [],
  );
  return rows.map(fromRow);
}

export async function insertGuardian(
  db: Db,
  input: { displayName: string; channel: GuardianChannel; contact: string | null; relationship?: string | null },
): Promise<Guardian> {
  const id = newId();
  await db.runAsync(
    'INSERT INTO guardians (id, display_name, relationship, channel, contact, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, input.displayName, input.relationship ?? null, input.channel, input.contact, nowIso()],
  );
  const row = await db.getFirstAsync<GuardianRow>('SELECT * FROM guardians WHERE id = ?', [id]);
  return fromRow(row!);
}

/** Instant and silent: nothing is sent to the guardian. */
export async function revokeGuardian(db: Db, id: string): Promise<void> {
  await db.runAsync('UPDATE guardians SET revoked_at = ?, invite_token = NULL WHERE id = ?', [nowIso(), id]);
}
