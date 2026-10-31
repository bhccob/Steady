/** The code's digits from whatever was typed or pasted ("482 931", "482-931", "Your code: 482931."), up to six. */
export function digitsFromPaste(text: string): string {
  return text.replace(/\D/g, '').slice(0, 6);
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The same rule as the server's normaliseEmail, so the app never sends what it would refuse. */
export function looksLikeEmail(text: string): boolean {
  const email = text.trim().toLowerCase();
  return email.length <= 254 && EMAIL.test(email);
}
