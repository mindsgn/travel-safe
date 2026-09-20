import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { EmergencyService } from '@/lib/emergency-services';

export type EmergencyServicesCardProps = {
  title: string;
  subtitle: string;
  services: readonly EmergencyService[];
  onCall: (service: EmergencyService) => void;
  testID?: string;
};

export function EmergencyServicesCard({
  title,
  subtitle,
  services,
  onCall,
  testID,
}: EmergencyServicesCardProps) {
  const theme = useTheme();

  return (
    <ThemedView testID={testID} type="backgroundElement" style={styles.container}>
      <ThemedText type="smallBold">{title}</ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {subtitle}
      </ThemedText>
      <View style={styles.list}>
        {services.map((service) => (
          <Pressable
            key={service.id}
            testID={`emergency-service-${service.id}`}
            accessibilityRole="button"
            accessibilityLabel={service.name}
            onPress={() => onCall(service)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: theme.backgroundSelected },
              pressed && styles.pressed,
            ]}>
            <View style={styles.rowText}>
              <ThemedText type="smallBold">{service.name}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                {service.hint}
              </ThemedText>
            </View>
            <ThemedText type="smallBold">{service.number}</ThemedText>
          </Pressable>
        ))}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: Spacing.three,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  list: {
    gap: Spacing.two,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
  },
  rowText: {
    flex: 1,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});