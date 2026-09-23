import { router } from 'expo-router';
import { useState } from 'react';

import { Notice } from '@/components/notice';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { TextField } from '@/components/text-field';
import { strings } from '@/i18n/strings';
import { isNetworkError } from '@/lib/api/client';
import { MAX_NAME_LENGTH } from '@/lib/contacts';
import { useAppStore } from '@/store';

export default function NameSettingsScreen() {
  const saved = useAppStore((state) => state.name);
  const updateName = useAppStore((state) => state.updateName);
  const [name, setName] = useState(saved ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      setError(strings.onboarding.name.missing);
      return;
    }
    setSaving(true);
    try {
      await updateName(name);
      router.back();
    } catch (err) {
      setError(isNetworkError(err) ? strings.onboarding.name.failedOffline : strings.settings.name.failed);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScreenShell
      testID="settings-name"
      title={strings.settings.name.title}
      subtitle={strings.onboarding.name.body}
      footer={
        <PrimaryButton
          testID="settings-name-save"
          label={saving ? strings.common.saving : strings.common.save}
          loading={saving}
          onPress={save}
        />
      }>
      <TextField
        testID="settings-name-input"
        label={strings.onboarding.name.label}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        maxLength={MAX_NAME_LENGTH}
        autoCapitalize="words"
        textContentType="name"
      />
      {error ? <Notice tone="danger" message={error} /> : null}
    </ScreenShell>
  );
}
