import { useState } from 'react';

import { FeatureCard } from '@/components/feature-card';
import { Notice } from '@/components/notice';
import { PermissionCard } from '@/components/permission-card';
import { ScreenShell } from '@/components/screen-shell';
import { ToggleRow } from '@/components/toggle-row';
import { usePermissions } from '@/hooks/use-permissions';
import { strings } from '@/i18n/strings';
import { startJourneyTracking, stopJourneyTracking } from '@/lib/location';
import { useAppStore } from '@/store';

const KEYS = ['backgroundLocation'] as const;

export default function JourneySettingsScreen() {
  const copy = strings.settings.journey;
  const enabled = useAppStore((state) => state.journeySharing);
  const setJourneySharing = useAppStore((state) => state.setJourneySharing);
  const { states, request, openSettings } = usePermissions(KEYS);
  const [error, setError] = useState<string | null>(null);

  const toggle = async (value: boolean) => {
    setError(null);
    if (!value) {
      await stopJourneyTracking();
      await setJourneySharing(false);
      return;
    }
    const permission = await request('backgroundLocation');
    if (permission?.status !== 'granted') {
      setError(copy.needsPermission);
      return;
    }
    try {
      await startJourneyTracking();
      await setJourneySharing(true);
    } catch {
      setError(copy.needsPermission);
    }
  };

  return (
    <ScreenShell testID="settings-journey" title={copy.title} subtitle={copy.body}>
      <FeatureCard>
        <ToggleRow testID="journey-toggle" label={copy.toggle} value={enabled} onChange={(value) => void toggle(value)} />
      </FeatureCard>
      <Notice message={copy.notCheckIn} />
      {error ? <Notice testID="journey-error" tone="warning" message={error} /> : null}
      <PermissionCard
        copyKey="backgroundLocation"
        status={states.backgroundLocation?.status ?? 'undetermined'}
        onOpenSettings={() => void openSettings()}
      />
    </ScreenShell>
  );
}
