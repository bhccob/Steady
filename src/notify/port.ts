// The one place screens get the reminder port from: the phone's own notifications here, and on
// the web the version in port.web.ts.
export { expoPort as activePort, setupNotifications, syncSoon } from './expoPort';
