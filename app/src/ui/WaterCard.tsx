// Water: patients pick their own unit (glass, bottle, custom) and can switch any time.
// Every amount is saved in ounces, so earlier logs never change when the unit does.
import { WATER_PRESETS, formatOz, waterToGo, waterTotal, type DayEntry, type WaterUnit } from '@lb/shared';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useStore } from '@/lib/store';
import { Body, Button, Card, Chip, IconLabel, LinkText } from './components';
import { colors, fonts, radius } from './theme';

export function WaterCard({ entry, goalOz, onChange }: { entry: DayEntry; goalOz?: number; onChange: (oz: number[]) => void }) {
  const { waterUnit, customWaterUnits, setWaterUnit, addCustomWaterUnit } = useStore();
  const [adding, setAdding] = useState(false);
  const [customOz, setCustomOz] = useState('');
  const [customName, setCustomName] = useState('');

  const logged = entry.waterOz ?? [];
  const total = waterTotal(entry);
  const units = [...WATER_PRESETS, ...customWaterUnits.filter((c) => !WATER_PRESETS.some((p) => p.oz === c.oz))];
  const toGo = waterToGo(total, goalOz, waterUnit);
  const pct = goalOz ? Math.min(1, total / goalOz) : 0;

  const saveCustom = async () => {
    const oz = Number(customOz.replace(',', '.'));
    if (!Number.isFinite(oz) || oz <= 0 || oz > 128) return;
    await addCustomWaterUnit({ label: customName.trim() || `${Math.round(oz * 10) / 10} oz cup`, oz: Math.round(oz * 10) / 10 });
    setAdding(false);
    setCustomOz('');
    setCustomName('');
  };

  return (
    <Card style={{ gap: 12 }}>
      <IconLabel icon="water-outline">Water</IconLabel>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
        <Text style={s.big}>{formatOz(total)}</Text>
        {goalOz ? <Body muted>of {formatOz(goalOz)}</Body> : null}
      </View>
      {goalOz ? (
        <View style={s.track}>
          <View style={[s.fill, { width: `${pct * 100}%` }]} />
        </View>
      ) : null}
      {toGo ? <Body muted small>{toGo}</Body> : goalOz && total >= goalOz ? <Body small>Goal reached. Nice.</Body> : null}

      <View style={s.wrap}>
        {units.map((u) => (
          <Chip key={`${u.label}-${u.oz}`} label={`${u.label} · ${formatOz(u.oz)}`} selected={u.oz === waterUnit.oz && u.label === waterUnit.label} onPress={() => setWaterUnit(u)} />
        ))}
        <Chip label="+ Custom" selected={adding} onPress={() => setAdding((a) => !a)} />
      </View>

      {adding && (
        <View style={{ gap: 8 }}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput value={customOz} onChangeText={setCustomOz} placeholder="Ounces" keyboardType="decimal-pad" placeholderTextColor={colors.taupe} style={[s.input, { width: 100 }]} />
            <TextInput value={customName} onChangeText={setCustomName} placeholder="Name (e.g. My Stanley)" placeholderTextColor={colors.taupe} style={[s.input, { flex: 1 }]} />
          </View>
          <Button title="Save this size" kind="secondary" onPress={saveCustom} disabled={!customOz.trim()} />
        </View>
      )}

      <Pressable onPress={() => onChange([...logged, waterUnit.oz])} accessibilityRole="button" style={({ pressed }) => [s.add, pressed && { opacity: 0.8 }]}>
        <Text style={s.addText}>+ {waterUnit.label} ({formatOz(waterUnit.oz)})</Text>
      </Pressable>
      {logged.length > 0 && (
        <View style={{ alignItems: 'center' }}>
          <LinkText title={`Undo last (${formatOz(logged[logged.length - 1])})`} onPress={() => onChange(logged.slice(0, -1))} />
        </View>
      )}
    </Card>
  );
}

const s = StyleSheet.create({
  big: { fontFamily: fonts.head, fontSize: 36, color: colors.offBlack },
  track: { height: 8, borderRadius: 4, backgroundColor: colors.beige, overflow: 'hidden' },
  fill: { height: 8, borderRadius: 4, backgroundColor: colors.sage },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  add: { backgroundColor: colors.offBlack, borderRadius: radius.md, paddingVertical: 14, alignItems: 'center' },
  addText: { fontFamily: fonts.semi, fontSize: 17, color: colors.cream },
  input: {
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.offBlack,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
});
