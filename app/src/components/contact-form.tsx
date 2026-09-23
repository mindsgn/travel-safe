import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Notice } from '@/components/notice';
import { PrimaryButton } from '@/components/primary-button';
import { TextField } from '@/components/text-field';
import { ThemedText } from '@/components/themed-text';
import { ToggleRow } from '@/components/toggle-row';
import { Spacing } from '@/constants/theme';
import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { pickContactDraft } from '@/lib/contact-picker';
import { validateContact, type ContactDraft, type ContactField, type NormalizedContact } from '@/lib/contacts';
import { contactErrorText, contactSaveErrorMessage } from '@/lib/error-messages';
import { detectCallingCode } from '@/lib/phone-region';

type FieldErrors = Partial<Record<ContactField | 'form', string>>;

export type ContactFormProps = {
  initial: ContactDraft;
  onSubmit: (contact: NormalizedContact) => Promise<void>;
  submitLabel?: string;
  allowPicker?: boolean;
};

export function ContactForm({ initial, onSubmit, submitLabel = strings.contacts.form.save, allowPicker = true }: ContactFormProps) {
  const [draft, setDraft] = useState<ContactDraft>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [callingCode, setCallingCode] = useState<string | undefined>();

  useEffect(() => {
    let active = true;
    detectCallingCode().then((code) => {
      if (active) setCallingCode(code);
    });
    return () => {
      active = false;
    };
  }, []);

  const change = (patch: Partial<ContactDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setErrors({});
    setSaveError(null);
  };

  const pick = async () => {
    try {
      const picked = await pickContactDraft();
      if (picked) change({ ...picked, whatsapp: draft.whatsapp });
    } catch {
      setSaveError(strings.contacts.form.pickFailed);
    }
  };

  const submit = async () => {
    const result = validateContact(draft, callingCode);
    if (!result.ok) {
      const mapped: FieldErrors = {};
      for (const [field, code] of Object.entries(result.errors)) {
        if (code) mapped[field as ContactField | 'form'] = contactErrorText(code);
      }
      setErrors(mapped);
      return;
    }
    setSaving(true);
    try {
      await onSubmit(result.contact);
    } catch (error) {
      setSaveError(contactSaveErrorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const phoneHint = callingCode
    ? format(strings.contacts.form.phoneHint, { code: callingCode })
    : strings.contacts.form.phoneHintNoRegion;

  return (
    <View style={styles.container}>
      {allowPicker ? (
        <View style={styles.group}>
          <PrimaryButton testID="contact-pick" variant="subtle" label={strings.contacts.form.pick} onPress={pick} />
          <ThemedText type="small" themeColor="textSecondary">
            {strings.contacts.form.pickHint}
          </ThemedText>
        </View>
      ) : null}

      <TextField
        testID="contact-name"
        label={strings.contacts.form.name}
        placeholder={strings.contacts.form.namePlaceholder}
        value={draft.name}
        onChangeText={(name) => change({ name })}
        error={errors.name}
        autoCapitalize="words"
        textContentType="name"
      />
      <TextField
        testID="contact-email"
        label={strings.contacts.form.email}
        placeholder={strings.contacts.form.emailPlaceholder}
        value={draft.email}
        onChangeText={(email) => change({ email })}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
      />
      <TextField
        testID="contact-phone"
        label={strings.contacts.form.phone}
        placeholder={strings.contacts.form.phonePlaceholder}
        value={draft.phone}
        onChangeText={(phone) => change({ phone })}
        error={errors.phone}
        hint={phoneHint}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
      />
      <ToggleRow
        testID="contact-whatsapp"
        label={strings.contacts.form.whatsapp}
        hint={strings.contacts.form.whatsappHint}
        value={draft.whatsapp}
        onChange={(whatsapp) => change({ whatsapp })}
      />

      {errors.form ? (
        <Notice testID="contact-form-error" tone="danger" message={errors.form} />
      ) : (
        <ThemedText type="small" themeColor="textSecondary">
          {strings.contacts.form.requirement}
        </ThemedText>
      )}
      {saveError ? <Notice testID="contact-save-error" tone="danger" message={saveError} /> : null}

      <PrimaryButton testID="contact-save" label={saving ? strings.common.saving : submitLabel} loading={saving} onPress={submit} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: Spacing.three },
  group: { gap: Spacing.one },
});
