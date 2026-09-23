import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { ListRow } from '@/components/list-row';
import { Notice } from '@/components/notice';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { useGuardedAction } from '@/hooks/use-guarded-action';
import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';
import { contactChannels } from '@/lib/contacts';
import { inviteContactBySms } from '@/lib/sms';
import { useAppStore } from '@/store';

export default function ContactDetailScreen() {
  const copy = strings.contacts.detail;
  const { id } = useLocalSearchParams<{ id: string }>();
  const contact = useAppStore((state) => state.contacts.find((item) => item.id === id));
  const userName = useAppStore((state) => state.name) ?? '';
  const removeContact = useAppStore((state) => state.removeContact);
  const guarded = useGuardedAction();
  const [error, setError] = useState<string | null>(null);

  if (!contact) {
    return (
      <ScreenShell testID="contact-detail" title={copy.title}>
        <Notice message={strings.contacts.emptyTitle} />
      </ScreenShell>
    );
  }

  const channels = contactChannels(contact).map((channel) => strings.home.channel[channel]);

  const invite = async () => {
    if (!contact.phone) return;
    const outcome = await inviteContactBySms(contact.phone, userName);
    setError(outcome === 'unavailable' ? copy.inviteUnavailable : null);
  };

  const remove = () =>
    guarded(() =>
      Alert.alert(format(copy.removeConfirmTitle, { name: contact.name }), copy.removeConfirmBody, [
        { text: strings.common.cancel, style: 'cancel' },
        {
          text: strings.common.remove,
          style: 'destructive',
          onPress: async () => {
            try {
              await removeContact(contact.id);
              router.back();
            } catch {
              setError(copy.removeFailed);
            }
          },
        },
      ]),
    );

  return (
    <ScreenShell testID="contact-detail" title={contact.name} subtitle={copy.title}>
      <FeatureCard>
        <View>
          <ListRow testID="contact-detail-email" label={copy.email} value={contact.email ?? strings.home.notSet} />
          <ListRow testID="contact-detail-phone" label={copy.phone} value={contact.phone ?? strings.home.notSet} />
          <ListRow
            testID="contact-detail-whatsapp"
            label={copy.whatsapp}
            value={contact.whatsapp ? copy.whatsappYes : copy.whatsappNo}
          />
          <ListRow
            testID="contact-detail-channels"
            label={strings.contacts.channelsLabel}
            value={channels.length > 0 ? channels.join(', ') : strings.contacts.channelsNone}
          />
        </View>
      </FeatureCard>
      {error ? <Notice testID="contact-detail-error" tone="danger" message={error} /> : null}
      {contact.phone ? (
        <PrimaryButton testID="contact-invite" variant="subtle" label={copy.invite} onPress={() => void invite()} />
      ) : null}
      <PrimaryButton
        testID="contact-edit"
        variant="subtle"
        label={strings.common.edit}
        onPress={() => guarded(() => router.push({ pathname: '/contacts/edit', params: { id: contact.id } }))}
      />
      <PrimaryButton testID="contact-remove" variant="danger" label={strings.common.remove} onPress={() => void remove()} />
    </ScreenShell>
  );
}
