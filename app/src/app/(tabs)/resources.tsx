// Resources from Cristie will live here. Placeholder until the content is ready.
import { PROVIDER_NAME } from '@lb/shared';
import { View } from 'react-native';
import { Body, Card, Label, Screen, Title } from '@/ui/components';
import { colors } from '@/ui/theme';

const COMING = [
  { title: 'Portions, made simple', body: 'What 6 oz of protein or a cup of carbs looks like on your plate.' },
  { title: 'Carbs, explained', body: 'Low glycemic, high glycemic, and where fruit fits in.' },
  { title: 'Eating out', body: 'Staying on plan at restaurants and while traveling.' },
  { title: 'Meal prep basics', body: 'A little planning that makes the week easier.' },
];

export default function Resources() {
  return (
    <Screen>
      <Title>resources</Title>
      <Card style={{ backgroundColor: colors.cream, gap: 6 }}>
        <Label>Coming soon</Label>
        <Body>
          {PROVIDER_NAME} is putting together guides to go with your plan. They'll show up here as they're ready.
        </Body>
      </Card>
      <View style={{ gap: 12 }}>
        {COMING.map((r) => (
          <Card key={r.title} style={{ gap: 4, opacity: 0.6 }}>
            <Body semi>{r.title}</Body>
            <Body muted small>{r.body}</Body>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
