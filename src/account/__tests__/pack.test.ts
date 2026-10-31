import type { SteadyExport } from '../../settings/data';
import { packBackup, unpackBackup } from '../pack';

const iso = (ms: number) => new Date(Date.UTC(2025, 10, 1) + ms).toISOString();

// A year of Steady data: 3 pills × 365 days of doses, a check-in a day, and events.
function yearOfHistory(): SteadyExport {
  const doses = Array.from({ length: 3 * 365 }, (_, i) => ({ id: `dose-${i}`, med_id: `med-${i % 3}`, due_at_utc: iso(i * 8 * 3600e3), status: i % 9 ? 'taken_ontime' : 'pending', taken_at_utc: iso(i * 8 * 3600e3 + 600e3) }));
  const checkins = Array.from({ length: 365 }, (_, i) => ({ id: `checkin-${i}`, date_local: iso(i * 86400e3).slice(0, 10), mood: 'okay' }));
  const events = Array.from({ length: 2000 }, (_, i) => ({ id: i, kind: 'dose_marked', payload_json: '{"on_time":true}', created_at: iso(i * 4 * 3600e3) }));
  return { app: 'Steady', schemaVersion: 7, exportedAt: iso(0), tables: { profile: [{ display_name: 'Zoë 🌿 Øyvind' }], doses, checkins, events } } as unknown as SteadyExport;
}

describe('packBackup', () => {
  it('comes back exactly as it went, names in any language included', () => {
    const backup = yearOfHistory();
    expect(unpackBackup(packBackup(backup))).toEqual(backup);
  });

  it('is gzip as base64, so the server only has to encrypt it', () => {
    expect(packBackup(yearOfHistory())).toMatch(/^H4sI[A-Za-z0-9+/]+={0,2}$/);
  });

  it('sends a year of history in under a quarter of its size', () => {
    const backup = yearOfHistory();
    expect(packBackup(backup).length).toBeLessThan(JSON.stringify(backup).length / 4);
  });

  it('refuses something that is not a packed backup', () => {
    expect(() => unpackBackup(btoa('{"app":"Steady"}'))).toThrow();
  });
});
