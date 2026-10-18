// What a meal should include, in portions (never calories or macros).
import { TAG_LABEL, describeComponent, describeItem, formatWindow, type Meal } from '@lb/shared';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from './theme';

export function MealHeader({ meal }: { meal: Meal }) {
  return (
    <View style={s.head}>
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
  head: { flexDirection: 'row', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 },
  label: { fontFamily: fonts.semi, fontSize: 18, color: colors.offBlack },
  tag: { fontFamily: fonts.semi, fontSize: 12, color: colors.cream, backgroundColor: colors.olive, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, overflow: 'hidden' },
  window: { fontFamily: fonts.body, fontSize: 15, color: colors.charcoal, marginLeft: 'auto' },
  line: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  dot: { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.sage, marginTop: 9 },
  main: { flex: 1, fontFamily: fonts.body, fontSize: 16, lineHeight: 22, color: colors.offBlack },
  sub: { fontFamily: fonts.body, fontSize: 14, color: colors.charcoal },
  note: { fontFamily: fonts.light, fontSize: 15, lineHeight: 20, color: colors.charcoal, fontStyle: 'italic', marginTop: 2 },
});
