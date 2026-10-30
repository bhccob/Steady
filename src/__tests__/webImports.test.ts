import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

// The web build has no haptics, screen capture, background tasks, widget, file system or share
// sheet. Each of those is reached only through a file that has a `.web` twin, so nothing else
// may import them directly.
const ROOT = join(__dirname, '..', '..');
const PHONE_ONLY = ['expo-haptics', 'expo-screen-capture', 'expo-task-manager', 'react-native-android-widget', 'expo-file-system', 'expo-sharing'];
const ALLOWED = ['src/lib/haptics.ts', 'src/privacy/PrivacyGate.tsx', 'src/notify/backgroundTask.ts', 'src/widget/', 'src/settings/exportFile.ts'];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : sourceFiles(p);
    return /\.tsx?$/.test(e.name) && !/\.web\.tsx?$/.test(e.name) ? [p] : [];
  });
}

function offenders(): string[] {
  return [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))].flatMap((file) => {
    const rel = relative(ROOT, file).split(sep).join('/');
    const source = readFileSync(file, 'utf8');
    const hits = PHONE_ONLY.filter((m) => new RegExp(`from '${m}(/[^']*)?'`).test(source));
    return hits.length && !ALLOWED.some((a) => rel.startsWith(a)) ? [`${rel}: ${hits.join(', ')}`] : [];
  });
}

it('keeps phone-only modules behind files that have a web twin', () => {
  expect(offenders()).toEqual([]);
});
