import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ContactRow } from '@/components/contact-row';
import { Notice } from '@/components/notice';
import { OnboardingShell } from '@/components/onboarding-shell';
import { PrimaryButton } from '@/components/primary-button';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import { useAppStore } from '@/store';

export default function OnboardingContactsScreen() {
  const copy = strings.onboarding.contacts;
  const contacts = useAppStore((state) => state.contacts);
  const next = () => router.push('/onboarding/interval');

  return (
    <OnboardingShell
      step="contacts"
      title={copy.title}
      body={copy.body}
      footer={
        <View style={styles.footer}>
          {contacts.length === 0 ? <Notice tone="warning" message={copy.skipWarning} /> : null}
          <PrimaryButton
            testID="onboarding-contacts-continue"
            variant={contacts.length === 0 ? 'subtle' : 'primary'}
            label={contacts.length === 0 ? copy.skip : copy.continueWith}
            onPress={next}
          />
        </View>
      }>
      {contacts.map((contact, index) => (
        <ContactRow
          key={contact.id}
          contact={contact}
          index={index}
          onPress={() => router.push({ pathname: '/onboarding/add-contact', params: { id: contact.id } })}
        />
      ))}
      <PrimaryButton
        testID="onboarding-contacts-add"
        variant={contacts.length === 0 ? 'primary' : 'subtle'}
        label={copy.add}
        onPress={() => router.push('/onboarding/add-contact')}
      />
    </OnboardingShell>
  );
}

const styles = StyleSheet.create({ footer: { gap: Spacing.two } });
