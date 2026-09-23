import { router } from 'expo-router';
import { useState } from 'react';

import { IntervalPicker } from '@/components/interval-picker';
import { Notice } from '@/components/notice';
import { OnboardingShell } from '@/components/onboarding-shell';
import { PrimaryButton } from '@/components/primary-button';
import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { formatRelativeDateTime } from '@/lib/dates';
import { intervalErrorMessage } from '@/lib/error-messages';
import { computeDeadline } from '@/lib/intervals';
import { useAppStore } from '@/store';

export default function OnboardingIntervalScreen() {
  const copy = strings.onboarding.interval;
  const saved = useAppStore((state) => state.intervalDays);
  const setIntervalDays = useAppStore((state) => state.setIntervalDays);
  const [days, setDays] = useState(saved);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const now = new Date();

  const submit = async () => {
    setSaving(true);
    setError(null);
    try {
      if (days !== saved) await setIntervalDays(days);
      router.push('/onboarding/ready');
    } catch (err) {
      setError(intervalErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step="interval"
      title={copy.title}
      body={copy.body}
      footer={
        <PrimaryButton
          testID="onboarding-interval-continue"
          label={saving ? strings.common.saving : strings.common.continue}
          loading={saving}
          onPress={submit}
        />
      }>
      <IntervalPicker value={days} onChange={setDays} disabled={saving} />
      <Notice
        testID="interval-deadline-preview"
        message={format(strings.intervals.selectedHint, {
          deadline: formatRelativeDateTime(computeDeadline(now, days), now),
        })}
      />
      <Notice testID="interval-warning" tone="warning" message={copy.warning} />
      {error ? <Notice tone="danger" message={error} /> : null}
    </OnboardingShell>
  );
}
