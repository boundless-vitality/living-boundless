// Everything below the meals on Today: supplements, post-workout carbs, workout,
// water, alcohol, check-in. Each appears only if the plan turns it on. All optional.
import { ALCOHOL_TYPES, type AlcoholType, type DateStr, type DayEntry, type Plan } from '@lb/shared';
import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import { Body, Card, Chip, Label, Title } from './components';
import { colors, fonts } from './theme';

export function DayTracking({ plan, date }: { plan: Plan; date: DateStr }) {
  const router = useRouter();
  const { entries, loadEntry, updateEntry } = useStore();
  const e: DayEntry = entries[date] ?? { date };
  useEffect(() => {
    loadEntry(date);
  }, [date, loadEntry]);

  const set = (fn: (x: DayEntry) => DayEntry) => updateEntry(date, fn);
  const taken = new Set(e.supplements ?? []);
  const c = e.checkIn;

  return (
    <View style={{ gap: 12, marginTop: 8 }}>
      <Title size={20}>also today</Title>

      {plan.supplements.length > 0 && (
        <Card style={{ gap: 4 }}>
          <Label>Supplements</Label>
          {plan.supplements.map((s) => (
            <CheckRow
              key={s.name}
              label={s.name}
              sub={[s.dose, s.timing].filter(Boolean).join(' · ')}
              checked={taken.has(s.name)}
              onPress={() =>
                set((x) => {
                  const cur = new Set(x.supplements ?? []);
                  if (cur.has(s.name)) cur.delete(s.name);
                  else cur.add(s.name);
                  return { ...x, supplements: [...cur] };
                })
              }
            />
          ))}
        </Card>
      )}

      <Card style={{ gap: 4 }}>
        <CheckRow label="I trained today" sub="Just a record. Your plan stays the same." checked={!!e.trained} onPress={() => set((x) => ({ ...x, trained: !x.trained }))} />
        {plan.postWorkoutCarbs && (
          <CheckRow
            label={`Post-workout carbs: ${plan.postWorkoutCarbs.grams} g`}
            sub={[plan.postWorkoutCarbs.foods, plan.postWorkoutCarbs.note].filter(Boolean).join(' · ')}
            checked={!!e.postWorkoutCarbs}
            onPress={() => set((x) => ({ ...x, postWorkoutCarbs: !x.postWorkoutCarbs }))}
          />
        )}
      </Card>

      {plan.features.water && (
        <Card style={{ gap: 10 }}>
          <Label>Water</Label>
          <View style={st.counterRow}>
            <RoundBtn label="−" disabled={!e.water} onPress={() => set((x) => ({ ...x, water: Math.max(0, (x.water ?? 0) - 1) }))} />
            <View style={{ alignItems: 'center', flex: 1 }}>
              <Text style={st.bigNum}>{e.water ?? 0}</Text>
              <Body muted small>{plan.features.waterGoal ? `of ${plan.features.waterGoal} glasses` : 'glasses'}</Body>
            </View>
            <RoundBtn label="+" onPress={() => set((x) => ({ ...x, water: (x.water ?? 0) + 1 }))} />
          </View>
        </Card>
      )}

      {plan.features.alcohol && (
        <Card style={{ gap: 10 }}>
          <Label>Did you drink today?</Label>
          <View style={st.wrap}>
            <Chip label="No" selected={e.alcohol?.drank === false} onPress={() => set((x) => ({ ...x, alcohol: x.alcohol?.drank === false ? undefined : { drank: false } }))} />
            <Chip label="Yes" selected={!!e.alcohol?.drank} onPress={() => set((x) => ({ ...x, alcohol: x.alcohol?.drank ? undefined : { drank: true, drinks: {} } }))} />
          </View>
          {e.alcohol?.drank && (
            <View style={{ gap: 8 }}>
              {ALCOHOL_TYPES.map((a) => {
                const n = e.alcohol?.drinks?.[a.value] ?? 0;
                const change = (d: number) =>
                  set((x) => {
                    const drinks = { ...(x.alcohol?.drinks ?? {}) } as Partial<Record<AlcoholType, number>>;
                    const v = Math.max(0, (drinks[a.value] ?? 0) + d);
                    if (v) drinks[a.value] = v;
                    else delete drinks[a.value];
                    return { ...x, alcohol: { drank: true, drinks } };
                  });
                return (
                  <View key={a.value} style={st.drinkRow}>
                    <Body style={{ flex: 1 }}>{a.label}</Body>
                    <RoundBtn small label="−" disabled={!n} onPress={() => change(-1)} />
                    <Text style={st.drinkNum}>{n}</Text>
                    <RoundBtn small label="+" onPress={() => change(1)} />
                  </View>
                );
              })}
              <Body muted small>Liquor with club soda or diet soda counts as a shot. With a sugary mixer, it counts as a cocktail.</Body>
            </View>
          )}
        </Card>
      )}

      {plan.features.checkIn && (
        <Pressable onPress={() => router.push({ pathname: '/checkin', params: { date } })} accessibilityRole="button">
          <Card style={{ gap: 4, borderLeftWidth: 4, borderLeftColor: colors.sage }}>
            <Label>Check-in</Label>
            {c && (c.energy || c.mood || c.tags.length || c.note) ? (
              <>
                <Body>
                  {[c.energy && `Energy ${c.energy}/5`, c.mood && `Mood ${c.mood}/5`].filter(Boolean).join(' · ') || 'Checked in'}
                </Body>
                {c.tags.length > 0 && <Body muted small>{c.tags.join(', ')}</Body>}
                <Text style={st.editLink}>Edit</Text>
              </>
            ) : (
              <Body>How are you feeling today? Tap to check in.</Body>
            )}
          </Card>
        </Pressable>
      )}
    </View>
  );
}

function CheckRow({ label, sub, checked, onPress }: { label: string; sub?: string; checked: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={st.checkRow} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[st.box, checked && st.boxOn]}>{checked && <Text style={st.tick}>✓</Text>}</View>
      <View style={{ flex: 1 }}>
        <Body>{label}</Body>
        {sub ? <Body muted small>{sub}</Body> : null}
      </View>
    </Pressable>
  );
}

function RoundBtn({ label, onPress, disabled, small }: { label: string; onPress: () => void; disabled?: boolean; small?: boolean }) {
  const size = small ? 36 : 52;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[st.round, { width: size, height: size, borderRadius: size / 2 }, disabled && { opacity: 0.35 }]}
    >
      <Text style={[st.roundText, small && { fontSize: 20 }]}>{label}</Text>
    </Pressable>
  );
}

const st = StyleSheet.create({
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  box: { width: 28, height: 28, borderRadius: 8, borderWidth: 1.5, borderColor: colors.sand, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  boxOn: { backgroundColor: colors.olive, borderColor: colors.olive },
  tick: { color: colors.cream, fontFamily: fonts.semi, fontSize: 16 },
  counterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigNum: { fontFamily: fonts.head, fontSize: 40, color: colors.offBlack },
  round: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.sand, alignItems: 'center', justifyContent: 'center' },
  roundText: { fontFamily: fonts.semi, fontSize: 26, color: colors.offBlack, marginTop: -2 },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  drinkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  drinkNum: { fontFamily: fonts.semi, fontSize: 18, minWidth: 24, textAlign: 'center', color: colors.offBlack },
  editLink: { fontFamily: fonts.semi, fontSize: 15, color: colors.bronze, marginTop: 2 },
});

