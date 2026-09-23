import { router, useLocalSearchParams } from 'expo-router';

import { ContactForm } from '@/components/contact-form';
import { ScreenShell } from '@/components/screen-shell';
import { strings } from '@/i18n/strings';
import { draftFromContact, EMPTY_DRAFT } from '@/lib/contacts';
import { useAppStore } from '@/store';

export default function OnboardingAddContactScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useAppStore((state) => state.contacts.find((contact) => contact.id === id));
  const addContact = useAppStore((state) => state.addContact);
  const updateContact = useAppStore((state) => state.updateContact);

  return (
    <ScreenShell
      testID="onboarding-add-contact"
      title={existing ? strings.contacts.form.editTitle : strings.contacts.form.addTitle}
      subtitle={strings.contacts.form.confirmHint}>
      <ContactForm
        initial={existing ? draftFromContact(existing) : EMPTY_DRAFT}
        onSubmit={async (contact) => {
          if (existing) await updateContact(existing.id, contact);
          else await addContact(contact);
          router.back();
        }}
      />
    </ScreenShell>
  );
}
