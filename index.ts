// App entry. Phone-only background work is registered first (src/nativeEntry.ts); the web
// build gets an empty twin of that file.
import './src/nativeEntry';
import 'expo-router/entry';
