import { router } from 'expo-router';

import { FeatureCard } from '@/components/feature-card';
import { OnboardingShell } from '@/components/onboarding-shell';
import { PrimaryButton } from '@/components/primary-button';
import { ThemedText } from '@/components/themed-text';
import { strings } from '@/i18n/strings';

export default function IntroScreen() {
  const copy = strings.onboarding.intro;
  return (
    <OnboardingShell
      step="index"
      title={copy.title}
      footer={
        <PrimaryButton testID="onboarding-start" label={copy.start} onPress={() => router.push('/onboarding/name')} />
      }>
      <FeatureCard title={copy.problemTitle} body={copy.problemBody} />
      <FeatureCard title={copy.solutionTitle} body={copy.solutionBody} />
      <ThemedText type="small" themeColor="textSecondary">
        {copy.trustBody}
      </ThemedText>
    </OnboardingShell>
  );
}
