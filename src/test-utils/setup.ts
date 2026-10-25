// expo-crypto is a native module; under Jest, back it with Node's implementation.
jest.mock('expo-crypto', () => ({
  randomUUID: () => (jest.requireActual('node:crypto') as typeof import('node:crypto')).randomUUID(),
}));
