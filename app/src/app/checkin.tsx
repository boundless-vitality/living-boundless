// Optional daily check-in: energy and mood 1–5, optional taps, optional note.
import { CHECKIN_GROUPS, SAFETY_TAGS, formatShort, todayLocal, type CheckIn, type DateStr } from '@lb/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Body, Button, Card, Chip, IconLabel, Label, LinkText, Title, TopBar, type IconName } from '@/ui/components';
import { DisclaimerGate, DisclaimerInline } from '@/ui/Disclaimer';
import { colors, fonts, radius } from '@/ui/theme';

export default function CheckInScreen() {
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date: DateStr }>();
  const { entries, loadEntry, updateEntry, disclaimerAck } = useStore();
  const existing = entries[date]?.checkIn;
  const [c, setC] = useState<CheckIn>(existing ?? { tags: [] });
  const [loaded, setLoaded] = useState(!!entries[date]);

  useEffect(() => {
    loadEntry(date).then(() => setLoaded(true));
  }, [date, loadEntry]);
  useEffect(() => {
    if (loaded && entries[date]?.checkIn) setC(entries[date]!.checkIn!);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  const toggle = (tag: string) => setC((x) => ({ ...x, tags: x.tags.includes(tag) ? x.tags.filter((t) => t !== tag) : [...x.tags, tag] }));
  const showSafety = c.tags.some((t) => SAFETY_TAGS.includes(t));

  const save = async () => {
    const note = c.note?.trim() || undefined;
    await updateEntry(date, (e) => ({ ...e, checkIn: { ...c, note } }));
    router.back();
  };

  return (
    <SafeAreaView style={s.screen} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
          <TopBar left={<LinkText title="Cancel" onPress={() => router.back()} />} right={date !== todayLocal() ? <Body muted small>{formatShort(date)}</Body> : null} />
          <Title size={26}>how are you feeling?</Title>

          <DisclaimerGate />
          {disclaimerAck && (
            <>
              <DisclaimerInline />
              <Card style={{ gap: 4 }}>
                <Scale label="Energy" icon="lightning-bolt-outline" icons={ENERGY_ICONS} words={ENERGY_WORDS} value={c.energy} onChange={(v) => setC((x) => ({ ...x, energy: v }))} />
              </Card>
              <Card style={{ gap: 4 }}>
                <Scale label="Mood" icon="emoticon-outline" icons={MOOD_ICONS} words={MOOD_WORDS} value={c.mood} onChange={(v) => setC((x) => ({ ...x, mood: v }))} />
              </Card>

              <Body muted small>Anything else today? Tap any that fit. All optional.</Body>
              {CHECKIN_GROUPS.map((g) => (
                <View key={g.key} style={{ gap: 8 }}>
                  <IconLabel icon={GROUP_ICONS[g.key] ?? 'circle-outline'}>{g.label}</IconLabel>
                  <View style={s.wrap}>
                    {g.tags.map((t) => (
                      <Chip key={t} label={t} selected={c.tags.includes(t)} onPress={() => toggle(t)} />
                    ))}
                  </View>
                </View>
              ))}

              {showSafety && <DisclaimerInline />}

              <View style={{ gap: 8 }}>
                <Label>Note (optional)</Label>
                <TextInput
                  value={c.note ?? ''}
                  onChangeText={(note) => setC((x) => ({ ...x, note }))}
                  placeholder="Anything you want to remember"
                  placeholderTextColor={colors.taupe}
                  multiline
                  maxLength={500}
                  style={s.input}
                />
              </View>

              <Button title="Save" onPress={save} style={{ marginTop: 4 }} />
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const ENERGY_ICONS: IconName[] = ['battery-10', 'battery-30', 'battery-50', 'battery-80', 'battery'];
const ENERGY_WORDS = ['running on empty', 'low', 'okay', 'good', 'full of energy'];
const MOOD_ICONS: IconName[] = ['emoticon-cry-outline', 'emoticon-sad-outline', 'emoticon-neutral-outline', 'emoticon-happy-outline', 'emoticon-excited-outline'];
const MOOD_WORDS = ['rough', 'low', 'okay', 'good', 'great'];
const GROUP_ICONS: Record<string, IconName> = {
  appetite: 'silverware-fork-knife',
  energy: 'lightning-bolt-outline',
  mood: 'emoticon-outline',
  digestion: 'stomach',
  workout: 'dumbbell',
  other: 'dots-horizontal-circle-outline',
};

function Scale({ label, icon, icons, words, value, onChange }: { label: string; icon: IconName; icons: IconName[]; words: string[]; value?: number; onChange: (v?: number) => void }) {
  return (
    <View style={{ gap: 10 }}>
      <IconLabel icon={icon}>{label}</IconLabel>
      <View style={s.scale}>
        {icons.map((name, i) => {
          const n = i + 1;
          const on = value === n;
          return (
            <Pressable
              key={n}
              onPress={() => onChange(on ? undefined : n)}
              accessibilityRole="button"
              accessibilityLabel={`${label} ${n} of 5, ${words[i]}`}
              accessibilityState={{ selected: on }}
              style={[s.dot, on && s.dotOn]}
            >
              <MaterialCommunityIcons name={name} size={28} color={on ? colors.cream : colors.charcoal} />
            </Pressable>
          );
        })}
      </View>
      <Text style={s.word}>{value ? `${value}/5 · ${words[value - 1]}` : 'Tap one'}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: 24, gap: 16, paddingBottom: 48 },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 56, height: 56, borderRadius: 28, borderWidth: 1, borderColor: colors.sand, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.offBlack, borderColor: colors.offBlack },
  dotText: { fontFamily: fonts.semi, fontSize: 18, color: colors.offBlack },
  word: { fontFamily: fonts.semi, fontSize: 15, color: colors.offBlack, textAlign: 'center' },
  input: {
    minHeight: 80,
    fontFamily: fonts.body,
    fontSize: 17,
    color: colors.offBlack,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: 'top',
  },
});
