import { Redirect } from 'expo-router';

// The install screen now shows from the root layout, before the database opens; this keeps old links working.
export default function Install() {
  return <Redirect href="/" />;
}
