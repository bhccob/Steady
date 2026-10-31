import { deviceIdFrom } from '../ids';
import { digitsFromPaste, looksLikeEmail } from '../input';
import { afterSignIn } from '../next';

describe('digitsFromPaste', () => {
  it('keeps the six digits however the code was pasted', () => {
    expect(digitsFromPaste('482 931')).toBe('482931');
    expect(digitsFromPaste('482-931')).toBe('482931');
    expect(digitsFromPaste('Your code: 482931.')).toBe('482931');
  });

  it('keeps a partial code and never more than six digits', () => {
    expect(digitsFromPaste('12')).toBe('12');
    expect(digitsFromPaste('1234567890')).toBe('123456');
  });
});

describe('looksLikeEmail', () => {
  it('accepts an address with stray spaces and capitals, as the server does', () => {
    expect(looksLikeEmail(' Sam@Example.com ')).toBe(true);
  });

  it('refuses what the server would refuse', () => {
    for (const text of ['sam@', 'sam example.com', '', 'sam@example', `${'a'.repeat(250)}@example.com`]) expect(looksLikeEmail(text)).toBe(false);
  });
});

describe('afterSignIn', () => {
  it('sets up a new phone with no backup', () => {
    expect(afterSignIn({ isNew: true, hasBackup: false }, false)).toBe('setup');
  });

  it('restores a backup onto an empty phone', () => {
    expect(afterSignIn({ isNew: false, hasBackup: true }, false)).toBe('restore');
  });

  it('asks which to keep when both the phone and the account have data', () => {
    expect(afterSignIn({ isNew: false, hasBackup: true }, true)).toBe('choose');
  });

  it('backs up this phone when the account has nothing yet', () => {
    expect(afterSignIn({ isNew: true, hasBackup: false }, true)).toBe('claim');
  });
});

describe('deviceIdFrom', () => {
  it('turns a random UUID into the 22-character id the server expects', () => {
    const id = deviceIdFrom('0f8fad5b-d9cb-469f-a165-70867728950e');
    expect(id).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(deviceIdFrom('0f8fad5b-d9cb-469f-a165-70867728950e')).toBe(id);
  });
});
