import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/js-tabs';
import { colors, fonts } from '@/ui/theme';

type IconName = keyof typeof Ionicons.glyphMap;
const icon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.offBlack,
        tabBarInactiveTintColor: colors.charcoal,
        tabBarStyle: { backgroundColor: colors.cream, borderTopColor: colors.beige },
        tabBarLabelStyle: { fontFamily: fonts.semi, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.offWhite },
      }}
    >
      <Tabs.Screen name="today" options={{ title: 'Today', tabBarIcon: icon('sunny-outline') }} />
      <Tabs.Screen name="history" options={{ title: 'History', tabBarIcon: icon('calendar-outline') }} />
      <Tabs.Screen name="plan" options={{ title: 'My plan', tabBarIcon: icon('leaf-outline') }} />
      <Tabs.Screen name="resources" options={{ title: 'Resources', tabBarIcon: icon('book-outline') }} />
    </Tabs>
  );
}
