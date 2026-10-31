// Prints 32 random bytes as base64url and nothing else, so it can go straight into a Worker secret
// without ever being shown:
//
//   node scripts/random-key.mjs | npx wrangler secret put ACCOUNT_KEY
process.stdout.write(Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString('base64url'));
