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

describe('expo-notifications imports', () => {
  it('never imports the package root, which crashes Expo Go on Android', () => {
    const offenders = [...sourceFiles(join(ROOT, 'app')), ...sourceFiles(join(ROOT, 'src'))]
      .filter((file) => /from ['"]expo-notifications['"]/.test(readFileSync(file, 'utf8')))
      .map((file) => relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
