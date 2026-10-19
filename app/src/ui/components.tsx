import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type PressableProps, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, fonts, radius, space } from './theme';

export function Screen({ children, scroll = true, footer }: { children: ReactNode; scroll?: boolean; footer?: ReactNode }) {
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.scroll, { flex: 1 }]}>{children}</View>
      )}
      {footer}
    </SafeAreaView>
  );
}

/** League Spartan Bold, always lowercase (brand rule). */
export function Title({ children, size = 30, style }: { children: string; size?: number; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.title, { fontSize: size, lineHeight: size * 1.08 }, style]}>{children.toLowerCase()}</Text>;
}

export function Body({ children, style, muted, small, semi }: { children: ReactNode; style?: StyleProp<TextStyle>; muted?: boolean; small?: boolean; semi?: boolean }) {
  return (
    <Text
      style={[
        styles.body,
        small && { fontSize: 15, lineHeight: 20 },
        muted && { color: colors.charcoal },
        semi && { fontFamily: fonts.semi },
        style,
      ]}
    >
      {children}
    </Text>
  );
}

export function Label({ children, style }: { children: string; style?: StyleProp<TextStyle> }) {
  return <Text style={[styles.label, style]}>{children.toUpperCase()}</Text>;
}

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

/** Small green icon + uppercase label, for section headers. */
export function IconLabel({ icon, children }: { icon: IconName; children: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={styles.iconBubble}>
        <MaterialCommunityIcons name={icon} size={17} color={colors.moss} />
      </View>
      <Text style={styles.label}>{children.toUpperCase()}</Text>
    </View>
  );
}

type BtnKind = 'primary' | 'secondary' | 'ghost';
export function Button({ title, kind = 'primary', style, ...rest }: { title: string; kind?: BtnKind; style?: StyleProp<ViewStyle> } & PressableProps) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.btn, styles[`btn_${kind}`], pressed && { opacity: 0.75 }, rest.disabled && { opacity: 0.4 }, style]}
      {...rest}
    >
      <Text style={[styles.btnText, kind === 'primary' && { color: colors.cream }]}>{title}</Text>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress?: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && { opacity: 0.8 }]}
    >
      <Text style={[styles.chipText, selected && { color: colors.cream }]}>{label}</Text>
    </Pressable>
  );
}

export function TopBar({ left, right }: { left?: ReactNode; right?: ReactNode }) {
  return (
    <View style={styles.topbar}>
      <View>{left}</View>
      <View>{right}</View>
    </View>
  );
}

export function LinkText({ title, onPress }: { title: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={10}>
      <Text style={styles.link}>{title}</Text>
    </Pressable>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.offWhite },
  scroll: { padding: space.xl, paddingBottom: 60, gap: space.lg },
  title: { fontFamily: fonts.head, color: colors.offBlack, letterSpacing: -0.3 },
  body: { fontFamily: fonts.body, fontSize: 17, lineHeight: 24, color: colors.offBlack },
  label: { fontFamily: fonts.semi, fontSize: 12, letterSpacing: 1.4, color: colors.charcoal },
  iconBubble: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.beige, alignItems: 'center', justifyContent: 'center' },
  btn: { borderRadius: radius.md, paddingVertical: 15, paddingHorizontal: space.lg, alignItems: 'center', justifyContent: 'center' },
  btn_primary: { backgroundColor: colors.offBlack },
  btn_secondary: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.sand },
  btn_ghost: { backgroundColor: 'transparent' },
  btnText: { fontFamily: fonts.semi, fontSize: 17, color: colors.offBlack },
  card: { backgroundColor: colors.white, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.beige, padding: space.lg },
  chip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.sand, backgroundColor: colors.cream, paddingVertical: 9, paddingHorizontal: 14 },
  chipOn: { backgroundColor: colors.offBlack, borderColor: colors.offBlack },
  chipText: { fontFamily: fonts.semi, fontSize: 15, color: colors.offBlack },
  topbar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 32 },
  link: { fontFamily: fonts.semi, fontSize: 16, color: colors.bronze },
});
