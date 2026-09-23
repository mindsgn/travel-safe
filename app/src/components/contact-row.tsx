import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n/strings';
import { contactChannels, type EmergencyContact } from '@/lib/contacts';

export type ContactRowProps = { contact: EmergencyContact; onPress: () => void; index: number };

export function ContactRow({ contact, onPress, index }: ContactRowProps) {
  const theme = useTheme();
  const channels = contactChannels(contact).map((channel) => strings.home.channel[channel]);
  const detail = [contact.email, contact.phone].filter(Boolean).join(' · ');

  return (
    <Pressable
      testID={`contact-row-${index}`}
      accessibilityRole="button"
      accessibilityLabel={`${contact.name}, ${channels.join(', ')}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: theme.backgroundElement, borderColor: theme.border },
        pressed && styles.pressed,
      ]}>
      <View style={[styles.avatar, { backgroundColor: theme.backgroundSelected }]}>
        <ThemedText type="smallBold">{contact.name.trim().charAt(0).toUpperCase()}</ThemedText>
      </View>
      <View style={styles.text}>
        <ThemedText type="smallBold">{contact.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary" numberOfLines={1}>
          {detail}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {channels.length > 0
            ? `${strings.contacts.channelsLabel}: ${channels.join(', ')}`
            : strings.contacts.channelsNone}
        </ThemedText>
      </View>
      <ThemedText themeColor="textSecondary">›</ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  text: { flex: 1, gap: Spacing.half },
  pressed: { opacity: 0.7 },
});
