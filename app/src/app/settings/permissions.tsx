import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { FeatureCard } from '@/components/feature-card';
import { PermissionCard } from '@/components/permission-card';
import { ScreenShell } from '@/components/screen-shell';
import { usePermissions } from '@/hooks/use-permissions';
import { strings } from '@/i18n/strings';
import { getBackgroundAvailability, type BackgroundAvailability } from '@/lib/background';
import type { RequestablePermission } from '@/lib/permissions';

const KEYS: readonly RequestablePermission[] = ['notifications', 'location', 'backgroundLocation'];

export default function PermissionsSettingsScreen() {
  const copy = strings.settings.permissions;
  const { states, request, openSettings } = usePermissions(KEYS);
  const [background, setBackground] = useState<BackgroundAvailability | null>(null);

  useFocusEffect(
    useCallback(() => {
      void getBackgroundAvailability().then(setBackground);
    }, []),
  );

  return (
    <ScreenShell testID="settings-permissions" title={copy.title} subtitle={copy.body}>
      {KEYS.map((key) => (
        <PermissionCard
          key={key}
          copyKey={key}
          status={states[key]?.status ?? 'undetermined'}
          onRequest={() => void request(key)}
          onOpenSettings={() => void openSettings()}
        />
      ))}
      {background ? (
        <FeatureCard
          testID="settings-background-task"
          title={copy.backgroundTask}
          body={background === 'available' ? copy.backgroundAvailable : copy.backgroundRestricted}
        />
      ) : null}
      <PermissionCard copyKey="contacts" />
      <PermissionCard copyKey="sms" />
      <PermissionCard copyKey="battery" />
    </ScreenShell>
  );
}
