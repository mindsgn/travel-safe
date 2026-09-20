import { router } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { strings } from '@/i18n/strings';
import { useTrustedContactsStore } from '@/store/trusted-contacts-store';

const EXPLAINER_STEPS = [
  strings.trustedContacts.onboarding.steps.one,
  strings.trustedContacts.onboarding.steps.two,
  strings.trustedContacts.onboarding.steps.three,
];

type Phase =
  | { kind: 'steps'; index: number }
  | { kind: 'request' }
  | { kind: 'denied' };

export default function TrustedContactsOnboardingScreen() {
  const [phase, setPhase] = useState<Phase>({ kind: 'steps', index: 0 });
  const requestPermission = useTrustedContactsStore((state) => state.requestPermission);

  const step = EXPLAINER_STEPS[phase.kind === 'steps' ? phase.index : 0];

  const handleAllow = async () => {
    const granted = await requestPermission();
    if (granted) {
      router.replace('/trusted-contacts');
    } else {
      setPhase({ kind: 'denied' });
    }
  };

  const handleContinue = () => {
    if (phase.kind !== 'steps') return;
    if (phase.index < EXPLAINER_STEPS.length - 1) {
      setPhase({ kind: 'steps', index: phase.index + 1 });
    } else {
      setPhase({ kind: 'request' });
    }
  };

  const footer =
    phase.kind === 'steps' ? (
      <PrimaryButton
        testID="onboarding-continue"
        label={strings.trustedContacts.onboarding.continue}
        onPress={handleContinue}
      />
    ) : phase.kind === 'request' ? (
      <>
        <PrimaryButton
          testID="onboarding-allow-contacts"
          label={strings.trustedContacts.onboarding.request.allow}
          onPress={handleAllow}
        />
        <PrimaryButton
          testID="onboarding-enter-manually"
          variant="subtle"
          label={strings.trustedContacts.onboarding.request.enterManually}
          onPress={() => router.replace('/trusted-contacts/add?manual=1')}
        />
      </>
    ) : (
      <>
        <PrimaryButton
          testID="onboarding-open-settings"
          label={strings.trustedContacts.onboarding.openSettings}
          onPress={() => Linking.openSettings()}
        />
        <PrimaryButton
          testID="onboarding-enter-manually"
          variant="subtle"
          label={strings.trustedContacts.onboarding.request.enterManually}
          onPress={() => router.replace('/trusted-contacts/add?manual=1')}
        />
      </>
    );

  return (
    <ScreenShell
      testID="trusted-contacts-onboarding"
      title={strings.trustedContacts.onboarding.title}
      footer={footer}>
      {phase.kind === 'steps' ? (
        <FeatureCard
          testID="onboarding-step"
          step={step.step}
          title={step.title}
          body={step.body}
        />
      ) : phase.kind === 'request' ? (
        <FeatureCard
          testID="onboarding-request"
          title={strings.trustedContacts.onboarding.requestTitle}
          body={strings.trustedContacts.onboarding.request.body}
        />
      ) : (
        <FeatureCard
          testID="onboarding-denied"
          title={strings.trustedContacts.onboarding.deniedTitle}
          body={strings.trustedContacts.onboarding.deniedBody}
        />
      )}
    </ScreenShell>
  );
}