import { LeagueSpartan_700Bold } from '@expo-google-fonts/league-spartan';
import { SourceSans3_300Light, SourceSans3_400Regular, SourceSans3_600SemiBold } from '@expo-google-fonts/source-sans-3';
import { useFonts } from 'expo-font';
import * as Linking from 'expo-linking';
import { Stack, useRouter } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { DB_NAME, migrate } from '@/lib/db';
import { StoreProvider, useStore } from '@/lib/store';
import { colors } from '@/ui/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [loaded, error] = useFonts({ LeagueSpartan_700Bold, SourceSans3_300Light, SourceSans3_400Regular, SourceSans3_600SemiBold });

  if (!loaded && !error) return null;
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={migrate}>
      <StoreProvider>
        <StatusBar style="dark" />
        <Ready />
        <DeepLinks />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.offWhite } }}>
          <Stack.Screen name="(tabs)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="log" options={{ presentation: "modal" }} />
          <Stack.Screen name="checkin" options={{ presentation: "modal" }} />
        </Stack>
      </StoreProvider>
    </SQLiteProvider>
  );
}

function Ready() {
  const { ready } = useStore();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  return null;
}

/** A plan link opened from Messages/Spruce/Safari lands here and goes to Add plan. */
function DeepLinks() {
  const url = Linking.useLinkingURL();
  const router = useRouter();
  const { ready } = useStore();
  const handled = useRef<string | null>(null);
  useEffect(() => {
    if (!ready || !url || handled.current === url) return;
    if (!/[#]p\d+\./.test(url)) return;
    handled.current = url;
    router.push({ pathname: '/add', params: { link: url } });
  }, [url, ready, router]);
  return null;
}
