// What a meal should include, in portions (never calories or macros).
import { TAG_LABEL, describeComponent, describeItem, formatWindow, type Meal } from '@lb/shared';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './theme';

type Icon = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** A small, warm icon per meal, picked from the tag or the meal's name. */
function mealIcon(meal: Meal): { name: Icon; color: string; bg: string } {
  const l = meal.label.toLowerCase();
  if (meal.tag === 'preWorkout' || l.includes('pre-workout') || l.includes('pre workout')) return { name: 'lightning-bolt-outline', color: colors.olive, bg: '#e3e8d9' };
  if (meal.tag === 'postWorkout' || l.includes('post')) return { name: 'dumbbell', color: colors.olive, bg: '#e3e8d9' };
  if (l.includes('breakfast')) return { name: 'coffee-outline', color: colors.bronze, bg: colors.cream };
  if (l.includes('lunch')) return { name: 'food-outline', color: colors.moss, bg: '#e3e8d9' };
  if (l.includes('dinner') || l.includes('supper')) return { name: 'silverware-fork-knife', color: colors.charcoal, bg: colors.beige };
  if (l.includes('snack')) return { name: 'food-apple-outline', color: colors.bronze, bg: colors.cream };
  return { name: 'bowl-mix-outline', color: colors.charcoal, bg: colors.cream };
}

export function MealHeader({ meal }: { meal: Meal }) {
  const icon = mealIcon(meal);
  return (
    <View style={s.head}>
      <View style={[s.icon, { backgroundColor: icon.bg }]}>
        <MaterialCommunityIcons name={icon.name} size={17} color={icon.color} />
      </View>
      <Text style={s.label}>{meal.label}</Text>
      {meal.tag && <Text style={s.tag}>{TAG_LABEL[meal.tag]}</Text>}
      <Text style={s.window}>{formatWindow(meal.start, meal.end)}</Text>
    </View>
  );
}

export function MealContents({ meal }: { meal: Meal }) {
  return (
    <View style={{ gap: 4 }}>
      {meal.components.map((c, i) => {
        const t = describeComponent(c);
        return (
          <View key={`c${i}`} style={s.line}>
            <View style={s.dot} />
            <Text style={s.main}>
              {t.main}
              {t.sub ? <Text style={s.sub}>{`  ${t.sub}`}</Text> : null}
            </Text>
          </View>
        );
      })}
      {meal.items.map((it, i) => (
        <View key={`i${i}`} style={s.line}>
          <View style={s.dot} />
          <Text style={s.main}>{describeItem(it)}</Text>
        </View>
      ))}
      {meal.note ? <Text style={s.note}>{meal.note}</Text> : null}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  icon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fonts.semi, fontSize: 18, color: colors.offBlack },
  tag: { fontFamily: fonts.semi, fontSize: 12, color: colors.cream, backgroundColor: colors.olive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  window: { fontFamily: fonts.body, fontSize: 15, color: colors.charcoal, marginLeft: 'auto' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.sage, marginTop: 9 },
  main: { flex: 1, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.offBlack },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.charcoal },
  note: { fontFamily: fonts.light, fontSize: 15, lineHeight: 20, color: colors.charcoal, fontStyle: 'italic', marginTop: 2 },
});
