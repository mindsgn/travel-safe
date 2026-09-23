import { StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';

export type PermissionCopyKey = keyof typeof strings.permissions;

export type PermissionCardProps = {
  copyKey: PermissionCopyKey;
  /** Omitted for capabilities that need no runtime permission. */
  status?: 'granted' | 'denied' | 'undetermined';
  onRequest?: () => void;
  onOpenSettings?: () => void;
};

export function PermissionCard({ copyKey, status, onRequest, onOpenSettings }: PermissionCardProps) {
  const copy = strings.permissions[copyKey];
  const statusLabel =
    status === undefined
      ? strings.onboarding.permissions.noPermissionNeeded
      : status === 'granted'
        ? strings.onboarding.permissions.granted
        : status === 'denied'
          ? strings.onboarding.permissions.denied
          : null;

  return (
    <FeatureCard testID={`permission-${copyKey}`}>
      <View style={styles.header}>
        <ThemedText type="smallBold" style={styles.title}>
          {copy.title}
        </ThemedText>
        {statusLabel ? (
          <ThemedText
            testID={`permission-${copyKey}-status`}
            type="small"
            themeColor={status === 'denied' ? 'warning' : 'textSecondary'}>
            {statusLabel}
          </ThemedText>
        ) : null}
      </View>
      <Detail label={strings.onboarding.permissions.usedFor} value={copy.usedFor} />
      <Detail label={strings.onboarding.permissions.why} value={copy.why} />
      <Detail label={strings.onboarding.permissions.ifDenied} value={copy.ifDenied} />
      {status === 'undetermined' && onRequest ? (
        <PrimaryButton testID={`permission-${copyKey}-allow`} label={strings.onboarding.permissions.allow} onPress={onRequest} />
      ) : null}
      {status === 'denied' && onOpenSettings ? (
        <PrimaryButton
          testID={`permission-${copyKey}-settings`}
          variant="subtle"
          label={strings.common.openSettings}
          onPress={onOpenSettings}
        />
      ) : null}
    </FeatureCard>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detail}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="small">{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  title: { flex: 1, fontSize: 16 },
  detail: { gap: Spacing.half },
});
