import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = join(__dirname, '..', '..', '..');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

describe('react-native-android-widget imports', () => {
  it('only appear in the widget files the development build loads, never where Expo Go would load them', () => {
    const allowed = new Set([join('src', 'widget', 'StreakWidget.tsx'), join('src', 'widget', 'handler.tsx')]);
    const offenders = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))]
      .filter((file) => /from ['"]react-native-android-widget['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file))
      .filter((file) => !allowed.has(file));
    expect(offenders).toEqual([]);
  });
});

describe('expo-notifications imports', () => {
  it('never imports the package root, which crashes Expo Go on Android', () => {
    const offenders = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))]
      .filter((file) => /from ['"]expo-notifications['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
