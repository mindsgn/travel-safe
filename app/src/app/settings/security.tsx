import { useEffect, useState } from 'react';

import { FeatureCard } from '@/components/feature-card';
import { Notice } from '@/components/notice';
import { ScreenShell } from '@/components/screen-shell';
import { ToggleRow } from '@/components/toggle-row';
import { strings } from '@/i18n/strings';
import { authenticate, canAuthenticate } from '@/lib/local-auth';
import type { SecuritySettings } from '@/store/app-store';
import { useAppStore } from '@/store';

export default function SecuritySettingsScreen() {
  const copy = strings.settings.security;
  const security = useAppStore((state) => state.security);
  const updateSecurity = useAppStore((state) => state.updateSecurity);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    void canAuthenticate().then(setAvailable);
  }, []);

  // Changing either setting requires a successful challenge, so the protection can't be switched off by someone else.
  const change = async (patch: Partial<SecuritySettings>) => {
    setMessage(null);
    const outcome = await authenticate(copy.prompt);
    if (outcome === 'success') await updateSecurity(patch);
    else if (outcome === 'unavailable') setMessage(copy.unavailable);
    else setMessage(strings.errors.authCancelled);
  };

  return (
    <ScreenShell testID="settings-security" title={copy.title} subtitle={copy.body}>
      {available === false ? <Notice tone="warning" message={copy.unavailable} /> : null}
      <FeatureCard>
        <ToggleRow
          testID="security-protect-settings"
          label={copy.protectSettings}
          hint={copy.protectSettingsHint}
          value={security.protectSettings}
          disabled={available === false}
          onChange={(value) => void change({ protectSettings: value })}
        />
        <ToggleRow
          testID="security-protect-check-in"
          label={copy.protectCheckIn}
          hint={copy.protectCheckInHint}
          value={security.protectCheckIn}
          disabled={available === false}
          onChange={(value) => void change({ protectCheckIn: value })}
        />
      </FeatureCard>
      {message ? <Notice tone="info" message={message} /> : null}
    </ScreenShell>
  );
}
