import { router, useLocalSearchParams } from 'expo-router';

import { ContactForm } from '@/components/contact-form';
import { ScreenShell } from '@/components/screen-shell';
import { strings } from '@/i18n/strings';
import { draftFromContact, EMPTY_DRAFT } from '@/lib/contacts';
import { useAppStore } from '@/store';

export default function EditContactScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useAppStore((state) => state.contacts.find((contact) => contact.id === id));
  const addContact = useAppStore((state) => state.addContact);
  const updateContact = useAppStore((state) => state.updateContact);

  return (
    <ScreenShell
      testID="contact-edit-screen"
      title={existing ? strings.contacts.form.editTitle : strings.contacts.form.addTitle}
      subtitle={existing ? undefined : strings.contacts.form.confirmHint}>
      <ContactForm
        initial={existing ? draftFromContact(existing) : EMPTY_DRAFT}
        allowPicker={!existing}
        onSubmit={async (contact) => {
          if (existing) {
            await updateContact(existing.id, contact);
            router.back();
          } else {
            const created = await addContact(contact);
            router.replace({ pathname: '/contacts/[id]', params: { id: created.id } });
          }
        }}
      />
    </ScreenShell>
  );
}
