// Log one meal: Followed / Substituted / Skipped, optional detail, when. One tap plus Save.
import DateTimePicker from '@react-native-community/datetimepicker';
import { formatShort, isPickOne, planForDate, todayLocal, toHHMM, type DateStr, type Meal } from '@lb/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { MealLog, MealStatus, WhenKind } from '@/lib/db';
import { STATUS_LABEL, nowHHMM } from '@/lib/logText';
import { useStore } from '@/lib/store';
import { Body, Button, Chip, Label, LinkText, Title, TopBar } from '@/ui/components';
import { MealContents, MealHeader } from '@/ui/MealContents';
import { colors, fonts, radius } from '@/ui/theme';

const STATUSES: MealStatus[] = ['followed', 'substituted', 'skipped'];

function timeToDate(hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

export default function LogMeal() {
  const router = useRouter();
  const { date, mealId } = useLocalSearchParams<{ date: DateStr; mealId: string }>();
  const { plans, logs, saveMealLog, removeMealLog } = useStore();
  const plan = planForDate(plans, date)?.plan;
  const meal: Meal | undefined = useMemo(
    () => plan?.dayPlans.flatMap((d) => d.meals).find((m) => m.id === Number(mealId)),
    [plan, mealId],
  );
  const existing = logs[date]?.find((l) => l.planId === plan?.id && l.mealId === Number(mealId));
  const isToday = date === todayLocal();

  const [status, setStatus] = useState<MealStatus | undefined>(existing?.status);
  const [note, setNote] = useState(existing?.note ?? '');
  const [choices, setChoices] = useState<Record<number, number>>(existing?.choices ?? {});
  const [when, setWhen] = useState<WhenKind>(existing?.whenKind ?? (isToday ? 'now' : 'planned'));
  const [time, setTime] = useState<Date>(timeToDate(existing?.eatenAt ?? (meal ? toHHMM(meal.start) : '12:00')));
  const [saving, setSaving] = useState(false);

  if (!plan || !meal) {
    return (
      <SafeAreaView style={s.screen}>
        <Body>That meal isn't in your plan anymore.</Body>
        <Button title="Close" onPress={() => router.back()} />
      </SafeAreaView>
    );
  }

  const pickOnes = meal.items.map((it, i) => ({ it, i })).filter(({ it }) => isPickOne(it));

  const save = async () => {
    if (!status) return;
    setSaving(true);
    const keepChoices = status !== 'skipped' && Object.keys(choices).length ? choices : undefined;
    const log: MealLog = {
      date,
      planId: plan.id,
      mealId: meal.id,
      planVersion: plan.version,
      mealLabel: meal.label,
      status,
      note: status === 'substituted' && note.trim() ? note.trim() : undefined,
      choices: keepChoices,
      whenKind: status === 'skipped' ? 'planned' : when,
      eatenAt:
        status === 'skipped' ? undefined : when === 'now' ? existing?.whenKind === 'now' && existing.eatenAt ? existing.eatenAt : nowHHMM() : when === 'time' ? nowHHMM(time) : undefined,
      loggedAt: new Date().toISOString(),
    };
    await saveMealLog(log, `${meal.label}: ${STATUS_LABEL[status].toLowerCase()}`);
    router.back();
  };

  const remove = async () => {
    await removeMealLog(date, plan.id, meal.id, `${meal.label} log removed`);
    router.back();
  };

  const whenOptions: { kind: WhenKind; label: string }[] = isToday
    ? [
        { kind: 'now', label: existing?.whenKind === 'now' ? 'When I logged it' : 'Just now' },
        { kind: 'earlier', label: 'Earlier today' },
        { kind: 'time', label: 'Pick a time' },
      ]
    : [
        { kind: 'planned', label: 'Around the planned time' },
        { kind: 'time', label: 'Pick a time' },
      ];

  return (
    <SafeAreaView style={s.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <TopBar left={<LinkText title="Cancel" onPress={() => router.back()} />} right={isToday ? null : <Body muted small>{formatShort(date)}</Body>} />
          <View style={s.mealBox}>
            <MealHeader meal={meal} />
            <MealContents meal={meal} />
          </View>

          <Title size={22}>how did it go?</Title>
          <View style={s.statusRow}>
            {STATUSES.map((st) => (
              <Chip key={st} label={STATUS_LABEL[st]} selected={status === st} onPress={() => setStatus(st)} />
            ))}
          </View>

          {status && status !== 'skipped' && pickOnes.length > 0 && (
            <View style={{ gap: 8 }}>
              <Label>Which did you have? (optional)</Label>
              {pickOnes.map(({ it, i }) => (
                <View key={i} style={s.wrap}>
                  {it.options.map((o, j) => (
                    <Chip
                      key={j}
                      label={o.amount ? `${o.name}, ${o.amount}` : o.name}
                      selected={choices[i] === j}
                      onPress={() => setChoices((c) => (c[i] === j ? omit(c, i) : { ...c, [i]: j }))}
                    />
                  ))}
                </View>
              ))}
            </View>
          )}

          {status === 'substituted' && (
            <View style={{ gap: 8 }}>
              <Label>What did you have instead? (optional)</Label>
              <TextInput
                value={note}
                onChangeText={setNote}
                placeholder="e.g. 4 turkey roll-ups"
                placeholderTextColor={colors.taupe}
                style={s.input}
                maxLength={200}
                returnKeyType="done"
              />
            </View>
          )}

          {status && status !== 'skipped' && (
            <View style={{ gap: 8 }}>
              <Label>When</Label>
              <View style={s.wrap}>
                {whenOptions.map((o) => (
                  <Chip key={o.kind} label={o.label} selected={when === o.kind} onPress={() => setWhen(o.kind)} />
                ))}
              </View>
              {when === 'time' && (
                <DateTimePicker
                  value={time}
                  mode="time"
                  display="spinner"
                  minuteInterval={5}
                  onValueChange={(_e: unknown, d?: Date) => d && setTime(d)}
                  style={{ alignSelf: 'stretch' }}
                />
              )}
            </View>
          )}

          <Button title={saving ? 'Saving…' : 'Save'} disabled={!status || saving} onPress={save} style={{ marginTop: 8 }} />
          {existing && (
            <View style={{ alignItems: 'center', marginTop: 4 }}>
              <LinkText title="Remove this log" onPress={remove} />
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function omit(o: Record<number, number>, k: number) {
  const { [k]: _drop, ...rest } = o;
  return rest;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: 24, gap: 18, paddingBottom: 48 },
  mealBox: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.beige, padding: 16, gap: 8 },
  statusRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.offBlack,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});
