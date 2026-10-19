// "This is just for you…" Shown in full the first time, then as a short line.
import { DISCLAIMER, DISCLAIMER_SHORT } from '@lb/shared';
import { StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import { Body, Button, Card } from './components';
import { colors, fonts } from './theme';

/** Full notice with "I understand" until acknowledged. Returns true while it blocks the screen. */
export function DisclaimerGate() {
  const { disclaimerAck, ackDisclaimer } = useStore();
  if (disclaimerAck) return null;
  return (
    <Card style={s.card}>
      <Body>{DISCLAIMER}</Body>
      <Button title="I understand" onPress={ackDisclaimer} style={{ marginTop: 8 }} />
    </Card>
  );
}

export function DisclaimerLine() {
  return (
    <View style={s.line}>
      <Text style={s.lineText}>{DISCLAIMER_SHORT}</Text>
    </View>
  );
}

/** Full text again, inline (e.g. after tapping dizzy or nauseous). */
export function DisclaimerInline() {
  return (
    <Card style={[s.card, { backgroundColor: colors.cream }]}>
      <Body small>{DISCLAIMER}</Body>
    </Card>
  );
}

const s = StyleSheet.create({
  card: { borderLeftWidth: 4, borderLeftColor: colors.bronze, gap: 4 },
  line: { paddingVertical: 6 },
  lineText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.charcoal },
});
