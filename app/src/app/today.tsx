import {
  PROVIDER_NAME, addDays, formatLong, formatShort, hasSchedule, planForDate, resolveDay, sortMeals, todayLocal, type DateStr, type Meal,
} from '@lb/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { MealLog } from '@/lib/db';
import { STATUS_LABEL, whenText } from '@/lib/logText';
import { useStore } from '@/lib/store';
import { Body, Card, Label, LinkText, Screen, Title, TopBar } from '@/ui/components';
import { MealContents, MealHeader } from '@/ui/MealContents';
import { colors, fonts, radius } from '@/ui/theme';

const FUTURE_DAYS = 6;

export default function Today() {
  const router = useRouter();
  const store = useStore();
  const { plans, logs, loadLogs, name, flash, setFlash, lastChange, undo, dismissUndo } = store;
  const today = todayLocal();
  const [date, setDate] = useState<DateStr>(today);

  // Reload when coming back from the log sheet, and pick up a new day after midnight.
  useFocusEffect(
    useCallback(() => {
      loadLogs(date);
    }, [date, loadLogs]),
  );

  useEffect(() => {
    if (!lastChange) return;
    const t = setTimeout(dismissUndo, 6000);
    return () => clearTimeout(t);
  }, [lastChange, dismissUndo]);

  const record = planForDate(plans, date);
  if (!record) return <Screen><Body>Loading…</Body></Screen>;
  const plan = record.plan;
  const resolved = resolveDay(plan, date);
  const dayLogs = logs[date] ?? [];
  const logFor = (m: Meal) => dayLogs.find((l) => l.planId === plan.id && l.mealId === m.id);

  const earliest = plans.reduce<DateStr>((min, r) => {
    const e = r.plan.startDate < r.activatedOn ? r.plan.startDate : r.activatedOn;
    return e < min ? e : min;
  }, today);
  const canBack = date > earliest;
  const canForward = date < addDays(today, FUTURE_DAYS);
  const isFuture = date > today;

  const heading = date === today ? 'today' : date === addDays(today, -1) ? 'yesterday' : date === addDays(today, 1) ? 'tomorrow' : formatShort(date);

  const meals = resolved.status === 'active' ? sortMeals(resolved.dayPlan.meals) : resolved.firstDay ? sortMeals(resolved.firstDay.meals) : [];
  const loggedCount = resolved.status === 'active' ? meals.filter((m) => logFor(m)).length : 0;

  return (
    <Screen
      footer={
        lastChange && lastChange.date === date ? (
          <View style={s.undoBar}>
            <Text style={s.undoText}>{lastChange.message}</Text>
            <Pressable onPress={undo} hitSlop={12} accessibilityRole="button">
              <Text style={s.undoBtn}>Undo</Text>
            </Pressable>
          </View>
        ) : null
      }
    >
      <TopBar
        left={<Body muted small>{name ? `hi, ${name}` : ' '}</Body>}
        right={<LinkText title="My plan" onPress={() => router.push('/plan')} />}
      />

      {flash && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.sage, gap: 4 }}>
          <Title size={20}>{flash.title}</Title>
          <Body>{flash.body}</Body>
          <LinkText title="Got it" onPress={() => setFlash(undefined)} />
        </Card>
      )}

      <View style={s.dateRow}>
        <Arrow dir="‹" disabled={!canBack} onPress={() => setDate(addDays(date, -1))} label="Previous day" />
        <Pressable style={{ flex: 1 }} onPress={() => setDate(today)} accessibilityHint="Go to today">
          <Title size={34} style={{ textAlign: 'center' }}>{heading}</Title>
          <Body muted small style={{ textAlign: 'center' }}>{formatLong(date)}</Body>
        </Pressable>
        <Arrow dir="›" disabled={!canForward} onPress={() => setDate(addDays(date, 1))} label="Next day" />
      </View>

      {resolved.status === 'active' && hasSchedule(plan) && (
        <View style={s.dayPlanRow}>
          <View style={s.leaf} />
          <Text style={s.dayPlanText}>
            {date === today ? 'Today: ' : ''}
            {resolved.dayPlan.name}
            {resolved.week != null && resolved.weekCount && !resolved.pastLastWeek ? `  ·  week ${resolved.week + 1} of ${resolved.weekCount}` : ''}
          </Text>
        </View>
      )}

      {resolved.status === 'active' && resolved.pastLastWeek && (
        <Card style={{ backgroundColor: colors.cream }}>
          <Body>
            You've made it through every week of this plan. Keep going with these meals, and check in with {PROVIDER_NAME} when you can about what's next.
          </Body>
        </Card>
      )}

      {resolved.status === 'beforeStart' && (
        <Card style={{ backgroundColor: colors.cream, gap: 4 }}>
          <Title size={20}>{`your plan starts ${formatShort(resolved.startsOn).toLowerCase()}`}</Title>
          <Body muted>Here's a preview of your first day. You can start logging once it begins.</Body>
        </Card>
      )}

      {resolved.status === 'active' && meals.length > 0 && (
        <Body muted small>
          {isFuture ? 'A look ahead. You can log these on the day.' : loggedCount === 0 ? 'Tap a meal to log how it went.' : `${loggedCount} of ${meals.length} meals logged`}
        </Body>
      )}

      {meals.map((m) => {
        const log = resolved.status === 'active' ? logFor(m) : undefined;
        const tappable = resolved.status === 'active' && !isFuture;
        return (
          <Pressable
            key={m.id}
            disabled={!tappable}
            onPress={() => router.push({ pathname: '/log', params: { date, mealId: String(m.id) } })}
            style={({ pressed }) => [pressed && { opacity: 0.85 }]}
            accessibilityRole={tappable ? 'button' : undefined}
            accessibilityLabel={`${m.label}${log ? `, ${STATUS_LABEL[log.status]}` : ', not logged'}`}
          >
            <Card style={[{ gap: 8 }, log && s.cardLogged]}>
              <MealHeader meal={m} />
              <MealContents meal={m} />
              {tappable && <StatusLine log={log} />}
            </Card>
          </Pressable>
        );
      })}

      {resolved.status === 'active' && plan.postWorkoutCarbs && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.sage }}>
          <Label>After strength training</Label>
          <Body semi style={{ marginTop: 6 }}>{plan.postWorkoutCarbs.grams} g carbs: {plan.postWorkoutCarbs.foods}</Body>
          {plan.postWorkoutCarbs.note ? <Body muted small>{plan.postWorkoutCarbs.note}</Body> : null}
        </Card>
      )}
    </Screen>
  );
}

function StatusLine({ log }: { log?: MealLog }) {
  if (!log) {
    return (
      <View style={s.statusRow}>
        <Text style={s.logBtn}>Log</Text>
      </View>
    );
  }
  const when = whenText(log);
  return (
    <View style={s.statusRow}>
      <Text style={s.statusChip}>✓ {STATUS_LABEL[log.status]}</Text>
      {when ? <Text style={s.statusMeta}>{when}</Text> : null}
      {log.note ? <Text style={[s.statusMeta, { flexBasis: '100%' }]} numberOfLines={2}>“{log.note}”</Text> : null}
    </View>
  );
}

function Arrow({ dir, disabled, onPress, label }: { dir: string; disabled: boolean; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} hitSlop={14} accessibilityRole="button" accessibilityLabel={label} style={[s.arrow, disabled && { opacity: 0.25 }]}>
      <Text style={s.arrowText}>{dir}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 },
  arrow: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.beige },
  arrowText: { fontFamily: fonts.semi, fontSize: 26, color: colors.offBlack, marginTop: -3 },
  dayPlanRow: { flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center' },
  leaf: { width: 18, height: 4, borderRadius: 2, backgroundColor: colors.sage },
  dayPlanText: { fontFamily: fonts.semi, fontSize: 17, color: colors.offBlack },
  cardLogged: { backgroundColor: colors.cream, borderColor: colors.sand },
  statusRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, borderTopWidth: 1, borderTopColor: colors.beige, paddingTop: 10, marginTop: 2 },
  logBtn: { fontFamily: fonts.semi, fontSize: 15, color: colors.offBlack, borderWidth: 1, borderColor: colors.sand, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 16, overflow: 'hidden' },
  statusChip: { fontFamily: fonts.semi, fontSize: 15, color: colors.cream, backgroundColor: colors.olive, borderRadius: radius.pill, paddingVertical: 5, paddingHorizontal: 12, overflow: 'hidden' },
  statusMeta: { fontFamily: fonts.body, fontSize: 15, color: colors.charcoal },
  undoBar: {
    position: 'absolute', left: 16, right: 16, bottom: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.offBlack, borderRadius: radius.pill, paddingVertical: 12, paddingHorizontal: 20,
  },
  undoText: { fontFamily: fonts.body, fontSize: 15, color: colors.cream, flex: 1 },
  undoBtn: { fontFamily: fonts.semi, fontSize: 15, color: colors.sand, marginLeft: 16 },
});
