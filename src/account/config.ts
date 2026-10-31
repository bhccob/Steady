// Where Steady's account server is. A build can point elsewhere (a local `wrangler dev`) with
// EXPO_PUBLIC_ACCOUNT_URL; otherwise it's the live one.
export const ACCOUNT_URL = process.env.EXPO_PUBLIC_ACCOUNT_URL || 'https://api.steadyapp.cc';
