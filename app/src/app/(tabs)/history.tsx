// History: patterns at a glance, without tapping through day by day.
// Uses the same numbers as the shared report, so what patients see matches what Cristie gets.
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { addDays, buildReport, earliestDate, planCode, todayLocal, weekdayIndex, type DateStr, type ReportModel } from '@lb/shared';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { entriesInRange, logsInRange } from '@/lib/db';
import { useStore } from '@/lib/store';
import { Body, Card, Chip, IconLabel, Screen, Title } from '@/ui/components';
import { colors, fonts, radius } from '@/ui/theme';

type Range = 7 | 30;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function History() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { plans, name, logged } = useStore();
  const [range, setRange] = useState<Range>(7);
  const [report, setReport] = useState<ReportModel>();
  const today = todayLocal();
  const first = earliestDate(plans) ?? today;
  const from = (() => {
    const f = addDays(today, -(range - 1));
    return f < first ? first : f;
  })();

  useFocusEffect(
    useCallback(() => {
      let live = true;
      (async () => {
        const r = buildReport({
          records: plans,
          logs: await logsInRange(db, from, today),
          entries: await entriesInRange(db, from, today),
          from,
          to: today,
          patientName: name,
          planCodeOf: planCode,
        });
        if (live) setReport(r);
      })();
      return () => {
        live = false;
      };
      // `logged` changes whenever something is logged, so the numbers stay fresh.
    }, [db, plans, from, today, name, logged]),
  );

  const openDay = (date: DateStr) => router.navigate({ pathname: '/today', params: { date, t: String(Date.now()) } });

  if (!plans.length) {
    return (
      <Screen>
        <Title>history</Title>
        <Body muted>Once you add a plan and start logging, your patterns show up here.</Body>
      </Screen>
    );
  }

  const s = report?.summary;
  const mealsLogged = s ? s.followed + s.substituted + s.skipped : 0;
  const pct = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '–');
  const mealsRow = report?.grid?.rows[0];

  return (
    <Screen>
      <Title>history</Title>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="Last 7 days" selected={range === 7} onPress={() => setRange(7)} />
        <Chip label="Last 30 days" selected={range === 30} onPress={() => setRange(30)} />
      </View>

      {report && s && (
        <>
          {/* Calendar */}
          <Card style={{ gap: 10 }}>
            <IconLabel icon="calendar-month-outline">Days</IconLabel>
            <Calendar
              dates={report.grid?.columns.map((c) => c.date) ?? []}
              levels={mealsRow?.cells ?? []}
              today={today}
              onPress={openDay}
            />
            <Body muted small style={{ textAlign: 'center' }}>Tap a day to see or change what you logged.</Body>
          </Card>

          {/* At a glance */}
          <View style={st.tiles}>
            <Tile big={`${s.daysLogged}`} small={`of ${s.days} days`} label="logged" />
            <Tile big={pct(s.followed, mealsLogged)} label="meals followed" />
            <Tile big={`${s.substituted}`} label="substituted" />
            <Tile big={`${s.skipped}`} label="skipped" />
          </View>

          {/* Supplements */}
          {report.supplements.length > 0 && (
            <Card style={{ gap: 12 }}>
              <IconLabel icon="pill">Supplements</IconLabel>
              {report.supplements.map((x) => (
                <View key={x.name} style={{ gap: 4 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Body semi style={{ flex: 1 }}>{x.name}</Body>
                    <Body>{x.taken} of {x.of} days</Body>
                  </View>
                  <View style={st.track}>
                    <View style={[st.fill, { width: `${x.of ? (x.taken / x.of) * 100 : 0}%` }]} />
                  </View>
                  {x.pattern ? <Text style={st.pattern}>{x.pattern}</Text> : null}
                </View>
              ))}
            </Card>
          )}

          {/* Energy & mood */}
          {report.days.some((d) => d.energy || d.mood) && (
            <Card style={{ gap: 12 }}>
              <IconLabel icon="emoticon-outline">Energy & mood</IconLabel>
              <Bars label="Energy (1 low, 5 great)" icon="lightning-bolt-outline" values={report.days.map((d) => d.energy)} dates={report.days.map((d) => d.date)} />
              <Bars label="Mood (1 low, 5 great)" icon="emoticon-happy-outline" values={report.days.map((d) => d.mood)} dates={report.days.map((d) => d.date)} />
            </Card>
          )}

          {/* Everything else */}
          {report.extras.length > 0 && (
            <Card style={{ gap: 8 }}>
              <IconLabel icon="chart-box-outline">Everything else</IconLabel>
              {report.extras.map((x) => (
                <View key={x.label}>
                  <Body semi>{x.label}</Body>
                  <Body muted small>{x.value}</Body>
                </View>
              ))}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

function Tile({ big, small, label }: { big: string; small?: string; label: string }) {
  return (
    <View style={st.tile}>
      <Text style={st.tileBig}>
        {big}
        {small ? <Text style={st.tileSmall}>{` ${small}`}</Text> : null}
      </Text>
      <Text style={st.tileLabel}>{label}</Text>
    </View>
  );
}

function Calendar({ dates, levels, today, onPress }: { dates: DateStr[]; levels: string[]; today: DateStr; onPress: (d: DateStr) => void }) {
  if (!dates.length) return null;
  // A week fits on one row: no padding, each day labeled with its own weekday.
  const oneRow = dates.length <= 7;
  // Otherwise pad so the first date lands under its weekday.
  const pad = oneRow ? 0 : weekdayIndex(dates[0]);
  const cells: (DateStr | null)[] = [...Array(pad).fill(null), ...dates];
  while (!oneRow && cells.length % 7) cells.push(null);
  const weeks = oneRow ? [cells] : Array.from({ length: cells.length / 7 }, (_, i) => cells.slice(i * 7, i * 7 + 7));
  return (
    <View style={{ gap: 6 }}>
      <View style={st.calRow}>
        {(oneRow ? dates.map((d) => LETTERS[weekdayIndex(d)]) : LETTERS).map((l, i) => (
          <Text key={i} style={st.calLetter}>{l}</Text>
        ))}
      </View>
      {weeks.map((w, wi) => (
        <View key={wi} style={st.calRow}>
          {w.map((d, di) => {
            if (!d) return <View key={di} style={st.calCell} />;
            const level = levels[dates.indexOf(d)];
            return (
              <Pressable key={d} onPress={() => onPress(d)} style={st.calCell} accessibilityRole="button" accessibilityLabel={`${d}, ${level === 'full' ? 'every meal logged' : level === 'partial' ? 'partly logged' : 'nothing logged'}`}>
                <View style={[st.calDot, level === 'full' && st.full, level === 'partial' && st.partial, d === today && st.todayRing]}>
                  <Text style={[st.calNum, level === 'full' && { color: colors.cream }]}>{Number(d.slice(8))}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
      <View style={st.legend}>
        <LegendDot style={st.full} label="Every meal" />
        <LegendDot style={st.partial} label="Partly logged" />
        <LegendDot label="Nothing logged" />
      </View>
    </View>
  );
}

function LegendDot({ style, label }: { style?: object; label: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
      <View style={[st.legendDot, style]} />
      <Text style={st.legendText}>{label}</Text>
    </View>
  );
}

function Bars({ label, icon, values, dates }: { label: string; icon: 'lightning-bolt-outline' | 'emoticon-happy-outline'; values: (number | undefined)[]; dates: DateStr[] }) {
  const max = 5;
  const short = dates.length <= 7;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.moss} />
        <Body small semi>{label}</Body>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }}>
        <View style={st.yAxis}>
          {[5, 4, 3, 2, 1].map((n) => (
            <Text key={n} style={st.yLabel}>{n}</Text>
          ))}
        </View>
        <View style={{ flex: 1 }}>
          <View style={st.plot}>
            {[0, 1, 2, 3, 4].map((i) => (
              <View key={i} style={[st.gridLine, { top: `${(i / 4) * 100}%` }]} />
            ))}
            <View style={st.bars}>
              {values.map((v, i) => (
                <View key={i} style={st.barSlot}>
                  {v ? <View style={[st.bar, { height: `${((v - 1) / (max - 1)) * 100}%`, minHeight: 4 }]} /> : null}
                </View>
              ))}
            </View>
          </View>
          <View style={st.xAxis}>
            {short
              ? dates.map((d) => (
                  <Text key={d} style={[st.xLabel, { flex: 1 }]}>{LETTERS[weekdayIndex(d)]}</Text>
                ))
              : [dates[0], dates[dates.length - 1]].map((d) => (
                  <Text key={d} style={st.xLabel}>{`${Number(d.slice(5, 7))}/${Number(d.slice(8))}`}</Text>
                ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  tile: { flexBasis: '47%', flexGrow: 1, backgroundColor: colors.cream, borderRadius: radius.md, padding: 12, borderWidth: 1, borderColor: colors.beige },
  tileBig: { fontFamily: fonts.head, fontSize: 26, color: colors.offBlack },
  tileSmall: { fontFamily: fonts.semi, fontSize: 14, color: colors.charcoal },
  tileLabel: { fontFamily: fonts.semi, fontSize: 12, letterSpacing: 0.8, color: colors.charcoal, textTransform: 'uppercase' },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.beige, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.moss },
  pattern: { fontFamily: fonts.semi, fontSize: 13, color: colors.bronze },
  calRow: { flexDirection: 'row', justifyContent: 'space-between' },
  calLetter: { width: 38, textAlign: 'center', fontFamily: fonts.semi, fontSize: 12, color: colors.charcoal },
  calCell: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  calDot: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.sand, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  full: { backgroundColor: colors.moss, borderColor: colors.moss },
  partial: { backgroundColor: '#d6dcc9', borderColor: colors.sage },
  todayRing: { borderWidth: 2.5, borderColor: colors.offBlack },
  calNum: { fontFamily: fonts.semi, fontSize: 13, color: colors.offBlack },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: 12, marginTop: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderColor: colors.sand, backgroundColor: colors.white },
  legendText: { fontFamily: fonts.body, fontSize: 12, color: colors.charcoal },
  yAxis: { height: 80, justifyContent: 'space-between', marginTop: -6, marginBottom: -6 },
  yLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.charcoal, lineHeight: 12 },
  plot: { height: 80, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.beige },
  bars: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
  bar: { backgroundColor: colors.moss, borderRadius: 3 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  xLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.charcoal, textAlign: 'center' },
});
