import type { SQLiteDatabase } from 'expo-sqlite';

/** The slice of expo-sqlite the DAO layer uses. Tests back it with an in-memory engine. */
export type Db = Pick<SQLiteDatabase, 'execAsync' | 'runAsync' | 'getFirstAsync' | 'getAllAsync' | 'withTransactionAsync'>;
