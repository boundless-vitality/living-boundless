import { activeRangeText } from '@lb/shared';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Linking, Pressable, Switch, TextInput, View } from 'react-native';
import { askPermission, mealLabels } from '@/lib/reminders';
import { useStore } from '@/lib/store';
import { Body, Button, Card, Label, Screen, Title } from '@/ui/components';
import { PlanView } from '@/ui/PlanView';
import { colors, fonts } from '@/ui/theme';

export default function MyPlan() {
  const router = useRouter();
  const { active, plans, name, setName, loadDemoData, eraseEverything, reminders, setReminders } = useStore();
  const labels = mealLabels(plans);
  const [first, setFirst] = useState(name ?? '');
  const previous = plans.filter((p) => p.replacedOn).reverse();

  return (
    <Screen>
      {active ? <PlanView plan={active.plan} /> : <Body>No active plan yet.</Body>}

      <Button title="Share my report" onPress={() => router.push('/report')} style={{ marginTop: 8 }} />
      <Button title="Add a new plan" kind="secondary" onPress={() => router.push('/add')} />

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

      {active && (
        <Card style={{ gap: 10, marginTop: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Label>Meal reminders</Label>
              <Body muted small>A gentle nudge when each meal window starts.</Body>
            </View>
            <Switch
              value={reminders.enabled}
              trackColor={{ true: colors.olive, false: colors.sand }}
              onValueChange={async (on) => {
                if (on && !(await askPermission())) {
                  Alert.alert('Notifications are off', 'To get reminders, allow notifications for this app in Settings.', [
                    { text: 'Not now', style: 'cancel' },
                    { text: 'Open Settings', onPress: () => Linking.openSettings() },
                  ]);
                  return;
                }
                await setReminders({ ...reminders, enabled: on });
              }}
            />
          </View>
          {reminders.enabled &&
            labels.map((l) => (
              <View key={l} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Body>{l}</Body>
                <Switch
                  value={!reminders.off.includes(l)}
                  trackColor={{ true: colors.olive, false: colors.sand }}
                  onValueChange={(on) => setReminders({ ...reminders, off: on ? reminders.off.filter((x) => x !== l) : [...reminders.off, l] })}
                />
              </View>
            ))}
        </Card>
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
      {__DEV__ && (
        <Card style={{ gap: 10, marginTop: 8, borderStyle: 'dashed', borderColor: colors.bronze }}>
          <Label>Testing tools (not in the real app)</Label>
          <Body muted small>For trying things out and showing the app. Patients never see this.</Body>
          <Button
            title="Load demo: 2 weeks of logs"
            kind="secondary"
            onPress={() =>
              Alert.alert('Load demo?', 'This replaces everything on this phone with a demo plan and two weeks of sample logs.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Load demo', onPress: async () => { await loadDemoData(); router.navigate('/today'); } },
              ])
            }
          />
          <Button
            title="Erase everything on this phone"
            kind="ghost"
            onPress={() =>
              Alert.alert('Erase everything?', 'Removes all plans and logs from this phone so you can start fresh.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Erase', style: 'destructive', onPress: async () => { await eraseEverything(); router.replace('/welcome'); } },
              ])
            }
          />
        </Card>
      )}
    </Screen>
  );
}
