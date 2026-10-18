import { activeRangeText } from '@lb/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useStore } from '@/lib/store';
import { Body, Card, LinkText, Screen, TopBar } from '@/ui/components';
import { PlanView } from '@/ui/PlanView';
import { colors } from '@/ui/theme';

export default function PreviousPlan() {
  const router = useRouter();
  const { row } = useLocalSearchParams<{ row: string }>();
  const { plans } = useStore();
  const record = plans.find((p) => String(p.rowId) === row);

  return (
    <Screen>
      <TopBar left={<LinkText title="‹ My plan" onPress={() => router.back()} />} />
      {record ? (
        <>
          <Card style={{ backgroundColor: colors.cream }}>
            <Body muted small>Previous plan · read only · {activeRangeText(record)}</Body>
          </Card>
          <PlanView plan={record.plan} />
        </>
      ) : (
        <Body>Couldn't find that plan.</Body>
      )}
    </Screen>
  );
}
