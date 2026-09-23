import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';

import { ContactRow } from '@/components/contact-row';
import { FeatureCard } from '@/components/feature-card';
import { Notice } from '@/components/notice';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { useGuardedAction } from '@/hooks/use-guarded-action';
import { strings } from '@/i18n/strings';
import { useAppStore } from '@/store';

export default function ContactsScreen() {
  const copy = strings.contacts;
  const contacts = useAppStore((state) => state.contacts);
  const contactsError = useAppStore((state) => state.contactsError);
  const loadContacts = useAppStore((state) => state.loadContacts);
  const guarded = useGuardedAction();

  useFocusEffect(
    useCallback(() => {
      void loadContacts();
    }, [loadContacts]),
  );

  return (
    <ScreenShell
      testID="contacts-screen"
      title={copy.title}
      subtitle={copy.subtitle}
      footer={
        <PrimaryButton
          testID="contacts-add"
          label={copy.add}
          onPress={() => guarded(() => router.push('/contacts/edit'))}
        />
      }>
      {contactsError ? <Notice tone="warning" message={copy.loadFailed} /> : null}
      {contacts.length === 0 ? (
        <FeatureCard testID="contacts-empty" title={copy.emptyTitle} body={copy.emptyBody} />
      ) : (
        contacts.map((contact, index) => (
          <ContactRow
            key={contact.id}
            contact={contact}
            index={index}
            onPress={() => router.push({ pathname: '/contacts/[id]', params: { id: contact.id } })}
          />
        ))
      )}
    </ScreenShell>
  );
}
