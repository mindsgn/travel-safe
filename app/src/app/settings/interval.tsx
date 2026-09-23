import { useState } from 'react';

import { IntervalPicker } from '@/components/interval-picker';
import { Notice } from '@/components/notice';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { formatRelativeDateTime, parseDate } from '@/lib/dates';
import { intervalErrorMessage } from '@/lib/error-messages';
import type { UserMessage } from '@/lib/home-copy';
import { getAppStore, useAppStore } from '@/store';

export default function IntervalSettingsScreen() {
  const copy = strings.settings.interval;
  const saved = useAppStore((state) => state.intervalDays);
  const setIntervalDays = useAppStore((state) => state.setIntervalDays);
  const [days, setDays] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<UserMessage | null>(null);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await setIntervalDays(days);
      const deadline = parseDate(getAppStore().getState().status?.next_deadline_at);
      setMessage({
        tone: 'success',
        message: format(copy.saved, {
          deadline: deadline ? formatRelativeDateTime(deadline, new Date()) : strings.home.notSet,
        }),
      });
    } catch (error) {
      setMessage({ tone: 'danger', message: intervalErrorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      testID="settings-interval"
      title={copy.title}
      subtitle={strings.onboarding.interval.body}
      footer={
        <PrimaryButton
          testID="settings-interval-save"
          label={saving ? strings.common.saving : strings.common.save}
          loading={saving}
          disabled={days === saved}
          onPress={save}
        />
      }>
      <IntervalPicker value={days} onChange={setDays} disabled={saving} />
      <Notice tone="warning" message={strings.onboarding.interval.warning} />
      {message ? <Notice testID="settings-interval-message" tone={message.tone} message={message.message} /> : null}
    </ScreenShell>
  );
}
