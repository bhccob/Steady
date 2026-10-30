import { Tabs } from 'expo-router/js-tabs';

import { HelpSheet } from '../../src/home/HelpSheet';
import { PillSheet } from '../../src/pills/PillSheet';
import { FloatingTabBar } from '../../src/ui/FloatingTabBar';

export default function TabsLayout() {
  return (
    <>
      <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: 'transparent' } }} tabBar={(props) => <FloatingTabBar {...props} />}>
        <Tabs.Screen name="home" options={{ title: 'Home', tabBarAccessibilityLabel: 'Home' }} />
        <Tabs.Screen name="calendar" options={{ title: 'Calendar', tabBarAccessibilityLabel: 'Calendar' }} />
        <Tabs.Screen name="guardians" options={{ title: 'Guardians', tabBarAccessibilityLabel: 'Guardians and crisis lines' }} />
        <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarAccessibilityLabel: 'Settings' }} />
      </Tabs>
      <HelpSheet />
      <PillSheet />
    </>
  );
}
