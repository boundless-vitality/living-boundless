// A full plan, read-only. Used for "My plan" and Previous plans.
import { describeSchedule, hasSchedule, planCode, planIssuedLine, sortMeals, type Plan } from '@lb/shared';
import { View } from 'react-native';
import { Body, Card, Label, Title } from './components';
import { MealContents, MealHeader } from './MealContents';
import { colors } from './theme';

export function PlanView({ plan }: { plan: Plan }) {
  const multi = hasSchedule(plan);
  return (
    <View style={{ gap: 16 }}>
      <View style={{ gap: 4 }}>
        <Title size={28}>{plan.title}</Title>
        <Body muted small>
          {planIssuedLine(plan)} · {planCode(plan.id)}
        </Body>
      </View>

      {multi && (
        <Card>
          <Label>Your schedule</Label>
          {describeSchedule(plan).map((l, i) => (
            <Body key={i} style={{ marginTop: 6 }}>{l}</Body>
          ))}
        </Card>
      )}

      {plan.dayPlans.map((d) => (
        <View key={d.id} style={{ gap: 10 }}>
          {multi && <Title size={20}>{d.name}</Title>}
          {sortMeals(d.meals).map((m) => (
            <Card key={m.id} style={{ gap: 8 }}>
              <MealHeader meal={m} />
              <MealContents meal={m} />
            </Card>
          ))}
        </View>
      ))}

      {plan.postWorkoutCarbs && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: colors.sage }}>
          <Label>Post-workout carbs</Label>
          <Body semi style={{ marginTop: 6 }}>{plan.postWorkoutCarbs.grams} g carbs</Body>
          <Body>{plan.postWorkoutCarbs.foods}</Body>
          {plan.postWorkoutCarbs.note ? <Body muted small style={{ marginTop: 4 }}>{plan.postWorkoutCarbs.note}</Body> : null}
        </Card>
      )}

      {plan.supplements.length > 0 && (
        <Card>
          <Label>Supplements</Label>
          {plan.supplements.map((s, i) => (
            <View key={i} style={{ marginTop: 8 }}>
              <Body semi>{s.name}</Body>
              <Body muted small>{[s.dose, s.timing].filter(Boolean).join(' · ')}</Body>
            </View>
          ))}
        </Card>
      )}

      {plan.notes ? (
        <Card>
          <Label>Notes from your provider</Label>
          <Body style={{ marginTop: 6 }}>{plan.notes}</Body>
        </Card>
      ) : null}
    </View>
  );
}
