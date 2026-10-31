// Where Steady's account server is. A build can point elsewhere (a local `wrangler dev`) with
// EXPO_PUBLIC_ACCOUNT_URL; otherwise it's the live one.
export const ACCOUNT_URL = process.env.EXPO_PUBLIC_ACCOUNT_URL || 'https://api.steadyapp.cc';

/** The privacy page (public/privacy.html), on the web app's own address. */
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL || 'https://steady-beta-five.vercel.app/privacy.html';
