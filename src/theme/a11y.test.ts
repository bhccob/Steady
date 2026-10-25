import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

// Spec §11: every interactive element has an accessibilityLabel. Button, CheckRow and the
// other shared controls set theirs; this guards every raw Pressable in the app.
const ROOT = join(__dirname, '..', '..');

function tsxFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : tsxFiles(p);
    return p.endsWith('.tsx') ? [p] : [];
  });
}

/** Each `<Pressable ...>` opening tag, up to the `>` that closes it (skipping `=>` and anything in braces). */
function openingTags(source: string): { line: number; tag: string }[] {
  const tags: { line: number; tag: string }[] = [];
  for (let i = source.indexOf('<Pressable'); i !== -1; i = source.indexOf('<Pressable', i + 1)) {
    let depth = 0;
    let j = i + 1;
    for (; j < source.length; j++) {
      const c = source[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0 && source[j - 1] !== '=') break;
    }
    tags.push({ line: source.slice(0, i).split('\n').length, tag: source.slice(i, j + 1) });
  }
  return tags;
}

describe('accessibility', () => {
  it('gives every Pressable an accessibilityLabel', () => {
    const missing = [...tsxFiles(join(ROOT, 'app')), ...tsxFiles(join(ROOT, 'src'))].flatMap((file) =>
      openingTags(readFileSync(file, 'utf8'))
        .filter((t) => !t.tag.includes('accessibilityLabel'))
        .map((t) => `${relative(ROOT, file)}:${t.line}`),
    );
    expect(missing).toEqual([]);
  });

  it('finds the Pressables it is checking', () => {
    expect(openingTags('<Pressable onPress={() => go()} accessibilityLabel="Go">x</Pressable>')).toHaveLength(1);
  });
});
