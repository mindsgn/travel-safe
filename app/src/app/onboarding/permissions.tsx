import { router } from 'expo-router';

import { OnboardingShell } from '@/components/onboarding-shell';
import { PermissionCard } from '@/components/permission-card';
import { PrimaryButton } from '@/components/primary-button';
import { usePermissions } from '@/hooks/use-permissions';
import { strings } from '@/i18n/strings';
import { ONBOARDING_PERMISSIONS } from '@/lib/permissions';

export default function PermissionsScreen() {
  const copy = strings.onboarding.permissions;
  const { states, request, openSettings } = usePermissions(ONBOARDING_PERMISSIONS);

  return (
    <OnboardingShell
      step="permissions"
      title={copy.title}
      body={copy.body}
      footer={
        <PrimaryButton
          testID="onboarding-permissions-continue"
          label={copy.continue}
          onPress={() => router.push('/onboarding/contacts')}
        />
      }>
      {ONBOARDING_PERMISSIONS.map((key) => (
        <PermissionCard
          key={key}
          copyKey={key}
          status={states[key]?.status ?? 'undetermined'}
          onRequest={() => void request(key)}
          onOpenSettings={() => void openSettings()}
        />
      ))}
      <PermissionCard copyKey="contacts" />
      <PermissionCard copyKey="battery" />
    </OnboardingShell>
  );
}
