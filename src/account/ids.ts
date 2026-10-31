/** A device id the server accepts (22 base64url characters), made from a random UUID's 16 bytes. */
export function deviceIdFrom(uuid: string): string {
  const hex = uuid.replace(/-/g, '');
  let bin = '';
  for (let i = 0; i < 32; i += 2) bin += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
