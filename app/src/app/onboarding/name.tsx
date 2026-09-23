import { router } from 'expo-router';
import { useState } from 'react';

import { Notice } from '@/components/notice';
import { OnboardingShell } from '@/components/onboarding-shell';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { strings } from '@/i18n/strings';
import { MAX_NAME_LENGTH } from '@/lib/contacts';
import { registrationErrorMessage } from '@/lib/error-messages';
import { useAppStore } from '@/store';

export default function NameScreen() {
  const copy = strings.onboarding.name;
  const savedName = useAppStore((state) => state.name);
  const register = useAppStore((state) => state.register);
  const [name, setName] = useState(savedName ?? '');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!name.trim()) {
      setError(copy.missing);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // The account is created here so contacts can be saved server-side in the next steps.
      await register(name);
      router.push('/onboarding/permissions');
    } catch (err) {
      setError(registrationErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <OnboardingShell
      step="name"
      title={copy.title}
      body={copy.body}
      footer={
        <PrimaryButton
          testID="onboarding-name-continue"
          label={saving ? copy.creating : strings.common.continue}
          loading={saving}
          onPress={submit}
        />
      }>
      <TextField
        testID="onboarding-name-input"
        label={copy.label}
        placeholder={copy.placeholder}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setError(null);
        }}
        maxLength={MAX_NAME_LENGTH}
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="done"
        onSubmitEditing={submit}
      />
      {error ? <Notice testID="onboarding-name-error" tone="danger" message={error} /> : null}
    </OnboardingShell>
  );
}
