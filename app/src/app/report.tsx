// Share my report: pick dates → PDF on the phone → iOS share sheet (e.g. Spruce).
import DateTimePicker from '@react-native-community/datetimepicker';
import { addDays, buildReport, earliestDate, formatMedium, planCode, todayLocal, type DateStr } from '@lb/shared';
import * as Print from 'expo-print';
import { useRouter } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { entriesInRange, logsInRange } from '@/lib/db';
import { reportHtml } from '@/lib/reportHtml';
import { useStore } from '@/lib/store';
import { Body, Button, Card, Chip, Label, LinkText, Screen, Title, TopBar } from '@/ui/components';
import { colors } from '@/ui/theme';

type Preset = '7' | '14' | '30' | 'plan' | 'custom';

const toDate = (s: DateStr) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const fromDate = (d: Date): DateStr =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function Report() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { plans, name } = useStore();
  const today = todayLocal();
  const first = earliestDate(plans) ?? today;
  const clamp = (d: DateStr) => (d < first ? first : d);

  const [preset, setPreset] = useState<Preset>('14');
  const [from, setFrom] = useState<DateStr>(clamp(addDays(today, -13)));
  const [to, setTo] = useState<DateStr>(today);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const choose = (p: Preset) => {
    setPreset(p);
    setTo(today);
    if (p === '7') setFrom(clamp(addDays(today, -6)));
    if (p === '14') setFrom(clamp(addDays(today, -13)));
    if (p === '30') setFrom(clamp(addDays(today, -29)));
    if (p === 'plan') setFrom(first);
  };

  const share = async () => {
    setBusy(true);
    setError('');
    try {
      const model = buildReport({
        records: plans,
        logs: await logsInRange(db, from, to),
        entries: await entriesInRange(db, from, to),
        from,
        to,
        patientName: name,
        planCodeOf: planCode,
      });
      const { uri } = await Print.printToFileAsync({ html: reportHtml(model) });
      if (!(await Sharing.isAvailableAsync())) {
        setError("Sharing isn't available on this device.");
        return;
      }
      await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Share your report' });
    } catch (e) {
      console.warn(e);
      setError("Something went wrong making the report. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <TopBar left={<LinkText title="‹ My plan" onPress={() => router.back()} />} />
      <Title>share my report</Title>
      <Body muted>
        Makes a PDF of what you've logged so you can send it to the team, for example in Spruce. Every day in the range is included, even days with nothing logged.
      </Body>

      <View style={{ gap: 8 }}>
        <Label>Dates</Label>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Chip label="Last 7 days" selected={preset === '7'} onPress={() => choose('7')} />
          <Chip label="Last 14 days" selected={preset === '14'} onPress={() => choose('14')} />
          <Chip label="Last 30 days" selected={preset === '30'} onPress={() => choose('30')} />
          <Chip label="Since my plan started" selected={preset === 'plan'} onPress={() => choose('plan')} />
          <Chip label="Pick dates" selected={preset === 'custom'} onPress={() => setPreset('custom')} />
        </View>
      </View>

      {preset === 'custom' ? (
        <Card style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Body>From</Body>
            <DateTimePicker
              value={toDate(from)}
              mode="date"
              display="compact"
              minimumDate={toDate(first)}
              maximumDate={toDate(to)}
              onValueChange={(_e: unknown, d?: Date) => d && setFrom(fromDate(d))}
            />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Body>To</Body>
            <DateTimePicker
              value={toDate(to)}
              mode="date"
              display="compact"
              minimumDate={toDate(from)}
              maximumDate={toDate(today)}
              onValueChange={(_e: unknown, d?: Date) => d && setTo(fromDate(d))}
            />
          </View>
        </Card>
      ) : (
        <Card style={{ backgroundColor: colors.cream }}>
          <Body>
            {formatMedium(from)} – {formatMedium(to)}
          </Body>
        </Card>
      )}

      {error ? <Body style={{ color: colors.bronze }}>{error}</Body> : null}
      {busy ? <ActivityIndicator color={colors.offBlack} /> : <Button title="Create and share PDF" onPress={share} />}
      <Body muted small>Nothing is sent until you pick where to share it.</Body>
    </Screen>
  );
}
