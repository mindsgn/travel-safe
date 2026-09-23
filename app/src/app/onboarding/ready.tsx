import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { ListRow } from '@/components/list-row';
import { Notice } from '@/components/notice';
import { OnboardingShell } from '@/components/onboarding-shell';
import { PrimaryButton } from '@/components/primary-button';
import { Spacing } from '@/constants/theme';
import { plural } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { checkInResultMessage, type UserMessage } from '@/lib/home-copy';
import { formatInterval } from '@/lib/intervals';
import { useAppStore } from '@/store';

export default function ReadyScreen() {
  const copy = strings.onboarding.ready;
  const intervalDays = useAppStore((state) => state.intervalDays);
  const contactCount = useAppStore((state) => state.contacts.length);
  const checkIn = useAppStore((state) => state.checkIn);
  const completeOnboarding = useAppStore((state) => state.completeOnboarding);
  const checkingIn = useAppStore((state) => state.checkingIn);
  const [message, setMessage] = useState<UserMessage | null>(null);

  const start = async () => {
    const outcome = await checkIn();
    if (outcome.kind === 'rejected') {
      setMessage(checkInResultMessage(outcome, new Date()));
      return;
    }
    // A local-only first check-in still completes onboarding; home shows it as unsynced.
    await completeOnboarding();
  };

  return (
    <OnboardingShell
      step="ready"
      title={copy.title}
      body={copy.body}
      footer={
        <PrimaryButton
          testID="onboarding-ready-start"
          label={checkingIn ? copy.starting : copy.start}
          loading={checkingIn}
          onPress={start}
        />
      }>
      <FeatureCard>
        <View style={styles.rows}>
          <ListRow testID="ready-interval" label={copy.summaryInterval} value={formatInterval(intervalDays)} />
          <ListRow
            testID="ready-contacts"
            label={copy.summaryContacts}
            value={contactCount > 0 ? plural(strings.home.contactsCount, contactCount) : copy.noContacts}
          />
        </View>
      </FeatureCard>
      <Notice tone="warning" message={strings.onboarding.interval.warning} />
      {message ? <Notice tone={message.tone} message={message.message} /> : null}
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({ rows: { gap: Spacing.half } });
