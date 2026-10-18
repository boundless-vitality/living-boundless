import { activeRangeText } from '@lb/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { useStore } from '@/lib/store';
import { Body, Button, Card, Label, LinkText, Screen, Title, TopBar } from '@/ui/components';
import { PlanView } from '@/ui/PlanView';
import { colors, fonts } from '@/ui/theme';

export default function MyPlan() {
  const router = useRouter();
  const { active, plans, name, setName } = useStore();
  const [first, setFirst] = useState(name ?? '');
  const previous = plans.filter((p) => p.replacedOn).reverse();

  return (
    <Screen>
      <TopBar left={<LinkText title="‹ Today" onPress={() => router.back()} />} />
      {active ? <PlanView plan={active.plan} /> : <Body>No active plan yet.</Body>}

      <Button title="Add a new plan" kind="secondary" onPress={() => router.push('/add')} style={{ marginTop: 8 }} />

      {previous.length > 0 && (
        <View style={{ gap: 10, marginTop: 8 }}>
          <Title size={20}>previous plans</Title>
          {previous.map((r) => (
            <Pressable key={r.rowId} onPress={() => router.push({ pathname: '/previous/[row]', params: { row: String(r.rowId) } })}>
              <Card>
                <Body semi>{r.plan.title} · v{r.plan.version}</Body>
                <Body muted small>{activeRangeText(r)}</Body>
              </Card>
            </Pressable>
          ))}
        </View>
      )}

      <Card style={{ gap: 8, marginTop: 8 }}>
        <Label>Your first name (optional)</Label>
        <TextInput
          value={first}
          onChangeText={setFirst}
          onEndEditing={() => setName(first)}
          placeholder="Only used on this phone"
          placeholderTextColor={colors.taupe}
          autoCapitalize="words"
          style={{ fontFamily: fonts.body, fontSize: 17, color: colors.offBlack, borderBottomWidth: 1, borderBottomColor: colors.sand, paddingVertical: 8 }}
        />
        <Body muted small>Your plan and logs stay on this phone. Nothing is sent to anyone unless you choose to share it.</Body>
      </Card>
    </Screen>
  );
}
