// Add your plan: scan the QR, paste the link, or pick a photo of the QR.
import { PROVIDER_NAME } from '@lb/shared';
import { CameraView, scanFromURLAsync, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Linking, StyleSheet, TextInput, View } from 'react-native';
import { useStore, type ImportResult } from '@/lib/store';
import { Body, Button, Card, LinkText, Screen, Title, TopBar } from '@/ui/components';
import { colors, fonts, radius } from '@/ui/theme';

type Mode = 'choose' | 'scan' | 'paste';

export default function AddPlan() {
  const router = useRouter();
  const params = useLocalSearchParams<{ link?: string }>();
  const { importFromText, setFlash, plans } = useStore();
  const [mode, setMode] = useState<Mode>('choose');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [pasted, setPasted] = useState('');
  const [permission, requestPermission] = useCameraPermissions();
  const scanning = useRef(false);

  const handle = async (text: string) => {
    setBusy(true);
    try {
      const r = await importFromText(text);
      if (r.ok && r.changed) {
        setFlash({ title: r.title, body: r.body });
        router.dismissTo('/today');
        return;
      }
      setResult(r);
      setMode('choose');
    } finally {
      setBusy(false);
      scanning.current = false;
    }
  };

  // Arrived from a tapped link (deep link).
  useEffect(() => {
    if (params.link) handle(String(params.link));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.link]);

  const startScan = async () => {
    setResult(null);
    if (!permission?.granted) {
      const p = await requestPermission();
      if (!p.granted) {
        setResult({ ok: false, title: 'camera is off', body: 'To scan, allow camera access in Settings. You can also paste the link or pick a photo of the QR code instead.' });
        return;
      }
    }
    setMode('scan');
  };

  const paste = async () => {
    setResult(null);
    let text = '';
    try {
      text = await Clipboard.getStringAsync();
    } catch {
      text = '';
    }
    if (/#?p\d+\./.test(text)) return handle(text);
    setMode('paste');
  };

  const fromPhoto = async () => {
    setResult(null);
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    if (res.canceled || !res.assets?.length) return;
    setBusy(true);
    try {
      const found = await scanFromURLAsync(res.assets[0].uri, ['qr']);
      if (!found.length) {
        setResult({ ok: false, title: "couldn't find a QR code", body: 'Try a clearer photo or screenshot where the whole QR code is visible.' });
        return;
      }
      await handle(found[0].data);
    } catch {
      setResult({ ok: false, title: "couldn't read that photo", body: 'Try a screenshot of the QR code, or paste the link instead.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll={mode !== 'scan'}>
      <TopBar left={plans.length > 0 || router.canGoBack() ? <LinkText title="‹ Back" onPress={() => (mode === 'choose' ? router.back() : setMode('choose'))} /> : null} />
      <Title>add your plan</Title>

      {mode === 'choose' && (
        <>
          <Body muted>Use the QR code or link from {PROVIDER_NAME}.</Body>
          {result && (
            <Card style={{ borderLeftWidth: 4, borderLeftColor: result.ok ? colors.sage : colors.bronze, gap: 6 }}>
              <Title size={20}>{result.title}</Title>
              <Body>{result.body}</Body>
              {result.ok && <Button title="Back to today" kind="secondary" onPress={() => router.dismissTo('/today')} style={{ marginTop: 6 }} />}
              {!result.ok && result.title === 'camera is off' && <LinkText title="Open Settings" onPress={() => Linking.openSettings()} />}
            </Card>
          )}
          {busy ? (
            <ActivityIndicator color={colors.offBlack} style={{ marginTop: 24 }} />
          ) : (
            <View style={{ gap: 12, marginTop: 8 }}>
              <Button title="Scan QR code" onPress={startScan} />
              <Button title="Paste link" kind="secondary" onPress={paste} />
              <Button title="From a photo" kind="secondary" onPress={fromPhoto} />
              <Body muted small style={{ marginTop: 4 }}>
                Got the QR as a picture in Spruce? Save it to Photos, then choose From a photo.
              </Body>
            </View>
          )}
        </>
      )}

      {mode === 'paste' && (
        <View style={{ gap: 12 }}>
          <Body muted>Paste the whole link here. Press and hold in the box, then tap Paste.</Body>
          <TextInput
            value={pasted}
            onChangeText={setPasted}
            multiline
            autoFocus
            autoCorrect={false}
            autoCapitalize="none"
            placeholder="https://…"
            placeholderTextColor={colors.taupe}
            style={s.input}
          />
          <Button title={busy ? 'Adding…' : 'Add plan'} disabled={!pasted.trim() || busy} onPress={() => handle(pasted)} />
        </View>
      )}

      {mode === 'scan' && (
        <View style={{ flex: 1, gap: 12 }}>
          <Body muted>Point your camera at the QR code.</Body>
          <View style={s.cameraWrap}>
            <CameraView
              style={StyleSheet.absoluteFill}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => {
                if (scanning.current) return;
                scanning.current = true;
                handle(data);
              }}
            />
            {busy && (
              <View style={s.cameraBusy}>
                <ActivityIndicator color={colors.cream} />
              </View>
            )}
          </View>
          <Button title="Cancel" kind="secondary" onPress={() => setMode('choose')} />
        </View>
      )}
    </Screen>
  );
}

const s = StyleSheet.create({
  input: {
    minHeight: 120,
    fontFamily: fonts.body,
    fontSize: 15,
    color: colors.offBlack,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.sand,
    borderRadius: radius.md,
    padding: 12,
    textAlignVertical: 'top',
  },
  cameraWrap: { flex: 1, minHeight: 360, borderRadius: radius.lg, overflow: 'hidden', backgroundColor: colors.offBlack },
  cameraBusy: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(28,27,25,0.5)' },
});
