import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import type { TrustedContactRow } from '@/db/schema';
import { strings } from '@/i18n/strings';

export type TrustedContactCardProps = {
  contact: TrustedContactRow;
  relationshipLabel: string;
  onEdit: () => void;
  onRemove: () => void;
};

export function TrustedContactCard({
  contact,
  relationshipLabel,
  onEdit,
  onRemove,
}: TrustedContactCardProps) {
  return (
    <ThemedView
      testID={`trusted-contact-card-${contact.id}`}
      type="backgroundElement"
      style={styles.container}>
      <View style={styles.info}>
        <ThemedText type="smallBold">{contact.name}</ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {contact.phone}
        </ThemedText>
        <ThemedView type="backgroundSelected" style={styles.badge}>
          <ThemedText type="small" themeColor="textSecondary">
            {relationshipLabel}
          </ThemedText>
        </ThemedView>
      </View>

      <View style={styles.actions}>
        <Pressable
          testID={`trusted-contact-edit-${contact.id}`}
          accessibilityRole="button"
          onPress={onEdit}
          hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.actionLabel}>
            {strings.trustedContacts.list.edit}
          </ThemedText>
        </Pressable>
        <Pressable
          testID={`trusted-contact-remove-${contact.id}`}
          accessibilityRole="button"
          onPress={onRemove}
          hitSlop={8}>
          <ThemedText type="small" themeColor="textSecondary" style={styles.actionLabel}>
            {strings.trustedContacts.list.remove}
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.two,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    flex: 1,
    gap: Spacing.one,
  },
  badge: {
    alignSelf: 'flex-start',
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.two,
    paddingVertical: Spacing.half,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  actionLabel: {
    textDecorationLine: 'underline',
  },
});