// Makes Steady's VAPID key pair: the web app subscribes with the public key, and the server signs
// pushes with the private one. Writes the public key to vapid-public.txt (safe to commit) and
// prints ONLY the private key, as JWK JSON, so it can go straight into a Worker secret:
//
//   node scripts/vapid-keys.mjs | npx wrangler secret put VAPID_PRIVATE_KEY
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const keys = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
const raw = new Uint8Array(await crypto.subtle.exportKey('raw', keys.publicKey));
const publicKey = Buffer.from(raw).toString('base64url');
writeFileSync(fileURLToPath(new URL('../vapid-public.txt', import.meta.url)), publicKey + '\n');
process.stdout.write(JSON.stringify(await crypto.subtle.exportKey('jwk', keys.privateKey)));
