// "This is just for you…" Shown in full the first time, then as a short line.
import { DISCLAIMER, DISCLAIMER_SHORT } from '@lb/shared';
import { Modal, StyleSheet, Text, View } from 'react-native';
import { useStore } from '@/lib/store';
import { Body, Button, Card, Title } from './components';
import { colors, fonts } from './theme';

/** First time only: a pop-up with the full notice and "I understand". */
export function DisclaimerGate() {
  const { disclaimerAck, ackDisclaimer } = useStore();
  return (
    <Modal visible={!disclaimerAck} transparent animationType="fade" onRequestClose={() => {}}>
      <View style={s.backdrop}>
        <View style={s.popup}>
          <Title size={22}>before you start</Title>
          <Body>{DISCLAIMER}</Body>
          <Button title="I understand" onPress={ackDisclaimer} style={{ marginTop: 8 }} />
        </View>
      </View>
    </Modal>
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
  backdrop: { flex: 1, backgroundColor: 'rgba(28,27,25,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  popup: { backgroundColor: colors.offWhite, borderRadius: 18, padding: 24, gap: 12, width: '100%', maxWidth: 420 },
  card: { borderLeftWidth: 4, borderLeftColor: colors.bronze, gap: 4 },
  line: { paddingVertical: 6 },
  lineText: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.charcoal },
});
