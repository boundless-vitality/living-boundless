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

type Range = 'week' | 30;
const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
const Y_AXIS = 12;

export default function History() {
  const router = useRouter();
  const db = useSQLiteContext();
  const { plans, name, logged } = useStore();
  const [range, setRange] = useState<Range>('week');
  const [open, setOpen] = useState<'substituted' | 'skipped' | null>(null);
  const [report, setReport] = useState<ReportModel>();
  const today = todayLocal();
  const first = earliestDate(plans) ?? today;
  // "This week" always runs Monday–Sunday; future days show as upcoming.
  const monday = addDays(today, -weekdayIndex(today));
  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const from = (() => {
    const f = range === 'week' ? monday : addDays(today, -29);
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
  const chartDates = range === 'week' ? weekDates : (report?.days.map((d) => d.date) ?? []);

  return (
    <Screen>
      <Title>history</Title>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <Chip label="This week" selected={range === 'week'} onPress={() => setRange('week')} />
        <Chip label="Last 30 days" selected={range === 30} onPress={() => setRange(30)} />
      </View>

      {report && s && (
        <>
          {/* Calendar */}
          <Card style={{ gap: 10 }}>
            <IconLabel icon="calendar-month-outline">Days</IconLabel>
            <Calendar
              dates={range === 'week' ? weekDates : (report.grid?.columns.map((c) => c.date) ?? [])}
              levels={range === 'week' ? weekDates.map((d) => mealsRow?.cells[report.grid!.columns.findIndex((c) => c.date === d)] ?? 'none') : (mealsRow?.cells ?? [])}
              today={today}
              onPress={openDay}
            />
            <Body muted small style={{ textAlign: 'center' }}>Tap a day to see or change what you logged.</Body>
          </Card>

          {/* At a glance */}
          <View style={st.tiles}>
            <Tile big={`${s.daysLogged}`} small={`of ${s.days} days`} label="logged" />
            <Tile big={pct(s.followed, mealsLogged)} label="meals followed" />
            <Tile big={`${s.substituted}`} label="substituted" hint={s.substituted ? 'tap to see' : undefined} selected={open === 'substituted'} onPress={s.substituted ? () => setOpen(open === 'substituted' ? null : 'substituted') : undefined} />
            <Tile big={`${s.skipped}`} label="skipped" hint={s.skipped ? 'tap to see' : undefined} selected={open === 'skipped'} onPress={s.skipped ? () => setOpen(open === 'skipped' ? null : 'skipped') : undefined} />
          </View>
          {open && <MealBreakdown report={report} status={open === 'substituted' ? 'Substituted' : 'Skipped'} onOpenDay={openDay} />}

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
              <Bars label="Energy (1 low, 5 great)" icon="lightning-bolt-outline" values={chartDates.map((d) => report.days.find((x) => x.date === d)?.energy)} dates={chartDates} />
              <Bars label="Mood (1 low, 5 great)" icon="emoticon-happy-outline" values={chartDates.map((d) => report.days.find((x) => x.date === d)?.mood)} dates={chartDates} />
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

function Tile({ big, small, label, hint, selected, onPress }: { big: string; small?: string; label: string; hint?: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} disabled={!onPress} accessibilityRole={onPress ? 'button' : undefined} style={[st.tile, selected && st.tileOn]}>
      <Text style={st.tileBig}>
        {big}
        {small ? <Text style={st.tileSmall}>{` ${small}`}</Text> : null}
      </Text>
      <Text style={st.tileLabel}>{label}</Text>
      {hint ? <Text style={st.tileHint}>{selected ? 'tap to hide' : hint}</Text> : null}
    </Pressable>
  );
}

/** What was substituted (and how often), or which meals were skipped most. */
function MealBreakdown({ report, status, onOpenDay }: { report: ReportModel; status: 'Substituted' | 'Skipped'; onOpenDay: (d: DateStr) => void }) {
  const items = report.days.flatMap((d) => d.meals.filter((m) => m.status === status).map((m) => ({ date: d.date, dateLabel: d.dateLabel, meal: m.label, note: m.detail })));
  const byMeal = new Map<string, number>();
  for (const i of items) byMeal.set(i.meal, (byMeal.get(i.meal) ?? 0) + 1);
  const top = [...byMeal.entries()].sort((a, b) => b[1] - a[1]);
  const notes = new Map<string, number>();
  if (status === 'Substituted') for (const i of items) if (i.note) {
    const k = i.note.replace(/[“”"]/g, '').trim().toLowerCase();
    notes.set(k, (notes.get(k) ?? 0) + 1);
  }
  const repeated = [...notes.entries()].filter(([, n]) => n > 1).sort((a, b) => b[1] - a[1]);
  return (
    <Card style={{ gap: 10 }}>
      <IconLabel icon={status === 'Substituted' ? 'swap-horizontal' : 'debug-step-over'}>{status === 'Substituted' ? 'What you substituted' : 'Meals skipped'}</IconLabel>
      <Body muted small>
        {status === 'Substituted' ? 'Most often: ' : 'Most often skipped: '}
        {top.slice(0, 3).map(([m, n]) => `${m} (${n})`).join(', ')}
      </Body>
      {repeated.length > 0 && <Body small>Came up more than once: {repeated.slice(0, 3).map(([k, n]) => `${k} (${n}×)`).join(', ')}</Body>}
      {items.map((i, idx) => (
        <Pressable key={idx} onPress={() => onOpenDay(i.date)} style={st.breakRow} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <Body semi small>{i.meal}</Body>
            <Body muted small>{i.dateLabel}</Body>
          </View>
          {i.note ? <Body small style={{ flex: 1.3, textAlign: 'right' }}>{i.note}</Body> : null}
        </Pressable>
      ))}
    </Card>
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
            if (d > today) {
              return (
                <View key={d} style={st.calCell}>
                  <View style={[st.calDot, { opacity: 0.35 }]}>
                    <Text style={st.calNum}>{Number(d.slice(8))}</Text>
                  </View>
                </View>
              );
            }
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: Y_AXIS + 8 }}>
        <MaterialCommunityIcons name={icon} size={16} color={colors.moss} />
        <Body small semi>{label}</Body>
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
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
                  {v ? <View style={[st.bar, { height: `${((v - 1) / (max - 1)) * 100}%`, minHeight: 4, width: short ? 14 : 6 }]} /> : null}
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
  tileOn: { borderColor: colors.offBlack, borderWidth: 1.5 },
  tileHint: { fontFamily: fonts.body, fontSize: 12, color: colors.bronze, marginTop: 2 },
  breakRow: { flexDirection: 'row', gap: 10, paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.beige },
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
  yAxis: { width: Y_AXIS, height: 80, justifyContent: 'space-between', marginTop: -6, marginBottom: -6 },
  yLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.charcoal, lineHeight: 12 },
  plot: { height: 80, position: 'relative' },
  gridLine: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: colors.beige },
  bars: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end', alignItems: 'center' },
  bar: { backgroundColor: colors.moss, borderRadius: 3 },
  xAxis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  xLabel: { fontFamily: fonts.body, fontSize: 11, color: colors.charcoal, textAlign: 'center' },
});
