// Optional daily check-in: energy and mood 1–5, optional taps, optional note.
import { CHECKIN_GROUPS, SAFETY_TAGS, formatShort, todayLocal, type CheckIn, type DateStr } from '@lb/shared';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useStore } from '@/lib/store';
import { Body, Button, Chip, Label, LinkText, Title, TopBar } from '@/ui/components';
import { DisclaimerGate, DisclaimerInline, DisclaimerLine } from '@/ui/Disclaimer';
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
              <DisclaimerLine />
              <Scale label="Energy" value={c.energy} onChange={(v) => setC((x) => ({ ...x, energy: v }))} low="low" high="great" />
              <Scale label="Mood" value={c.mood} onChange={(v) => setC((x) => ({ ...x, mood: v }))} low="low" high="great" />

              <Body muted small>Anything else today? Tap any that fit. All optional.</Body>
              {CHECKIN_GROUPS.map((g) => (
                <View key={g.key} style={{ gap: 8 }}>
                  <Label>{g.label}</Label>
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

function Scale({ label, value, onChange, low, high }: { label: string; value?: number; onChange: (v?: number) => void; low: string; high: string }) {
  return (
    <View style={{ gap: 8 }}>
      <Label>{label}</Label>
      <View style={s.scale}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => onChange(value === n ? undefined : n)}
            accessibilityRole="button"
            accessibilityLabel={`${label} ${n} of 5`}
            accessibilityState={{ selected: value === n }}
            style={[s.dot, value === n && s.dotOn]}
          >
            <Text style={[s.dotText, value === n && { color: colors.cream }]}>{n}</Text>
          </Pressable>
        ))}
      </View>
      <View style={s.scaleEnds}>
        <Text style={s.endText}>{low}</Text>
        <Text style={s.endText}>{high}</Text>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  content: { padding: 24, gap: 16, paddingBottom: 48 },
  wrap: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  scale: { flexDirection: 'row', justifyContent: 'space-between' },
  dot: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderColor: colors.sand, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' },
  dotOn: { backgroundColor: colors.offBlack, borderColor: colors.offBlack },
  dotText: { fontFamily: fonts.semi, fontSize: 18, color: colors.offBlack },
  scaleEnds: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 6 },
  endText: { fontFamily: fonts.body, fontSize: 13, color: colors.charcoal },
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
