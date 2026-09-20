import { Contact, ContactField } from 'expo-contacts';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { PrimaryButton } from '@/components/primary-button';
import { RelationSelector } from '@/components/relation-selector';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { strings } from '@/i18n/strings';
import {
  DEFAULT_RELATIONSHIP,
  fullNameFromContact,
  isRelationshipKey,
  normalizePhoneNumber,
  pickBestPhone,
  type AddContactFailureReason,
  type RelationshipKey,
} from '@/lib/trusted-contacts';
import { useTrustedContactsStore } from '@/store/trusted-contacts-store';

type AddFailureReason = AddContactFailureReason;

type PhoneOption = {
  label?: string;
  number: string;
};

export default function AddTrustedContactScreen() {
  const theme = useTheme();
  const { id: editIdParam, manual } = useLocalSearchParams<{ id?: string; manual?: string }>();
  const editId = typeof editIdParam === 'string' && editIdParam ? editIdParam : undefined;

  const contacts = useTrustedContactsStore((state) => state.contacts);
  const isLoaded = useTrustedContactsStore((state) => state.isLoaded);
  const loadContacts = useTrustedContactsStore((state) => state.loadContacts);
  const addContact = useTrustedContactsStore((state) => state.addContact);
  const updateContact = useTrustedContactsStore((state) => state.updateContact);

  const editContact = useMemo(
    () => (editId ? contacts.find((contact) => contact.id === editId) : undefined),
    [contacts, editId],
  );

  const [mode, setMode] = useState<'choose' | 'form'>(() =>
    editId || manual === '1' || Platform.OS === 'web' ? 'form' : 'choose',
  );
  const [name, setName] = useState(editContact?.name ?? '');
  const [phone, setPhone] = useState(editContact?.phone ?? '');
  const [relationship, setRelationship] = useState<RelationshipKey>(
    editContact && isRelationshipKey(editContact.relationship)
      ? editContact.relationship
      : DEFAULT_RELATIONSHIP,
  );
  const [deviceContactId, setDeviceContactId] = useState<string | null>(
    editContact?.device_contact_id ?? null,
  );
  const [phoneOptions, setPhoneOptions] = useState<PhoneOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editId && !isLoaded) {
      loadContacts();
    }
  }, [editId, isLoaded, loadContacts]);

  const [syncedContactId, setSyncedContactId] = useState<string | null>(null);
  if (editContact && editContact.id !== syncedContactId) {
    setSyncedContactId(editContact.id);
    setName(editContact.name);
    setPhone(editContact.phone);
    setRelationship(
      isRelationshipKey(editContact.relationship)
        ? editContact.relationship
        : DEFAULT_RELATIONSHIP,
    );
    setDeviceContactId(editContact.device_contact_id);
    setMode('form');
  }

  const handlePickFromContacts = async () => {
    setError(null);
    try {
      const picked = await Contact.presentPicker();
      if (!picked) return;
      const details = await picked.getDetails([
        ContactField.FULL_NAME,
        ContactField.GIVEN_NAME,
        ContactField.FAMILY_NAME,
        ContactField.COMPANY,
        ContactField.PHONES,
      ]);
      const options = (details.phones ?? []).map(
        (phoneEntry): PhoneOption => ({ label: phoneEntry.label, number: phoneEntry.number ?? '' }),
      );
      const best = pickBestPhone(options);
      if (!best) {
        setError(strings.trustedContacts.add.noPhones);
        return;
      }
      const pickedName = details.fullName || fullNameFromContact(details);
      setName(pickedName);
      setPhone(best);
      setPhoneOptions(options);
      setDeviceContactId(picked.id);
      setMode('form');
    } catch {
      setError(strings.trustedContacts.add.pickerError);
    }
  };

  const startManual = () => {
    setError(null);
    setMode('form');
  };

  const errorForReason = (reason: AddFailureReason): string => {
    switch (reason) {
      case 'missing_name':
        return strings.trustedContacts.add.errors.missingName;
      case 'invalid_phone':
        return strings.trustedContacts.add.errors.invalidPhone;
      case 'duplicate':
        return strings.trustedContacts.add.errors.duplicate;
      case 'limit':
        return strings.trustedContacts.add.errors.limit;
    }
  };

  const handleSave = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    const input = { name, phone, relationship, deviceContactId };
    const result = editId
      ? await updateContact(editId, input)
      : await addContact(input);
    setSaving(false);
    if (result.ok) {
      router.back();
    } else {
      setError(errorForReason(result.reason));
    }
  };

  const missingEditRow = Boolean(editId) && !editContact && isLoaded;

  return (
    <ScreenShell
      testID="add-contact-screen"
      title={
        editId
          ? strings.trustedContacts.add.editTitle
          : strings.trustedContacts.add.title
      }
      footer={
        mode === 'form' && !missingEditRow ? (
          <PrimaryButton
            testID="save-contact"
            label={
              saving
                ? strings.trustedContacts.add.saving
                : strings.trustedContacts.add.save
            }
            disabled={saving}
            onPress={handleSave}
          />
        ) : null
      }>
      {missingEditRow ? (
        <FeatureCard
          testID="add-contact-missing"
          body={strings.trustedContacts.add.errors.loadFailed}
        />
      ) : mode === 'choose' ? (
        <>
          <FeatureCard
            testID="add-from-contacts"
            title={strings.trustedContacts.add.chooseFromContacts}
            body={strings.trustedContacts.add.chooseBody}>
            <PrimaryButton
              label={strings.trustedContacts.add.chooseFromContacts}
              onPress={handlePickFromContacts}
            />
          </FeatureCard>
          <FeatureCard
            testID="add-manually"
            title={strings.trustedContacts.add.manual}
            body={strings.trustedContacts.add.manualBody}>
            <PrimaryButton
              variant="subtle"
              label={strings.trustedContacts.add.manual}
              onPress={startManual}
            />
          </FeatureCard>
        </>
      ) : (
        <>
          <FeatureCard
            testID="add-confirm-hint"
            body={strings.trustedContacts.add.confirmHint}
          />

          {phoneOptions.length > 1 ? (
            <View style={styles.block}>
              <ThemedText type="smallBold">
                {strings.trustedContacts.add.phoneSelectionTitle}
              </ThemedText>
              {phoneOptions.map((option, index) => {
                const selected = normalizePhoneNumber(option.number) === normalizePhoneNumber(phone);
                return (
                  <Pressable
                    key={`${option.label}-${index}`}
                    testID={`contact-phone-option-${index}`}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    onPress={() => {
                      const number = normalizePhoneNumber(option.number);
                      if (number) {
                        setPhone(number);
                      }
                    }}
                    style={({ pressed }) => [
                      styles.phoneOption,
                      {
                        backgroundColor: selected
                          ? theme.backgroundSelected
                          : theme.backgroundElement,
                      },
                      pressed && styles.pressed,
                    ]}>
                    <ThemedText type="smallBold">
                      {option.label || option.number}
                    </ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {option.number}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          <View style={styles.block}>
            <ThemedText type="smallBold">{strings.trustedContacts.add.nameLabel}</ThemedText>
            <TextInput
              testID="contact-name-input"
              value={name}
              onChangeText={setName}
              placeholder={strings.trustedContacts.add.namePlaceholder}
              placeholderTextColor={theme.textSecondary}
              autoCapitalize="words"
              autoCorrect={false}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
            />
          </View>

          <View style={styles.block}>
            <ThemedText type="smallBold">{strings.trustedContacts.add.phoneLabel}</ThemedText>
            <TextInput
              testID="contact-phone-input"
              value={phone}
              onChangeText={setPhone}
              placeholder={strings.trustedContacts.add.phonePlaceholder}
              placeholderTextColor={theme.textSecondary}
              keyboardType="phone-pad"
              autoCapitalize="none"
              autoCorrect={false}
              style={[
                styles.input,
                { color: theme.text, backgroundColor: theme.backgroundElement },
              ]}
            />
          </View>

          <View style={styles.block}>
            <ThemedText type="smallBold">
              {strings.trustedContacts.add.relationshipLabel}
            </ThemedText>
            <RelationSelector
              value={relationship}
              onChange={setRelationship}
              getLabel={(key) => strings.trustedContacts.relationships[key]}
            />
          </View>

          {error ? (
            <ThemedText testID="add-error" type="small" themeColor="textSecondary">
              {error}
            </ThemedText>
          ) : null}
        </>
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: Spacing.two,
  },
  input: {
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.three,
    fontSize: 16,
  },
  phoneOption: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  pressed: {
    opacity: 0.7,
  },
});