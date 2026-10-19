import { APP_NAME, CLINIC_NAME } from '@lb/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { useStore } from '@/lib/store';
import { Body, Button, Label, LinkText, Screen, Title } from '@/ui/components';
import { colors, fonts } from '@/ui/theme';

export default function Welcome() {
  const router = useRouter();
  const { setName, name, loadDemoData } = useStore();
  const [first, setFirst] = useState(name ?? '');

  return (
    <Screen>
      <View style={{ height: 40 }} />
      <Body muted small style={{ fontFamily: fonts.semi, letterSpacing: 0.4 }}>{CLINIC_NAME.toLowerCase()}</Body>
      <View style={{ width: 44, height: 4, borderRadius: 2, backgroundColor: colors.sage }} />
      <Title size={40}>{`welcome to ${APP_NAME}`}</Title>
      <Body>
        This is where your nutrition plan lives. Each day you'll see what your meals include, and you can log how it went with a tap.
      </Body>
      <Body muted>Everything you log stays on your phone. You decide if and when to share it.</Body>

      <View style={{ gap: 6, marginTop: 12 }}>
        <Label>Your first name (optional)</Label>
        <TextInput
          value={first}
          onChangeText={setFirst}
          placeholder="So we can say hi"
          placeholderTextColor={colors.taupe}
          autoCapitalize="words"
          autoComplete="given-name"
          returnKeyType="done"
          style={{
            fontFamily: fonts.body,
            fontSize: 18,
            color: colors.offBlack,
            backgroundColor: colors.white,
            borderWidth: 1,
            borderColor: colors.sand,
            borderRadius: 12,
            paddingHorizontal: 14,
            paddingVertical: 12,
          }}
        />
      </View>

      <Button
        title="Add your plan"
        style={{ marginTop: 12 }}
        onPress={async () => {
          await setName(first);
          router.push('/add');
        }}
      />
      {__DEV__ && (
        <View style={{ alignItems: 'center', marginTop: 4 }}>
          <LinkText title="Testing: load a demo instead" onPress={async () => { await loadDemoData(); router.replace('/today'); }} />
        </View>
      )}
    </Screen>
  );
}
