import { router } from 'expo-router';
import { useEffect } from 'react';
import { Alert, FlatList, Linking, StyleSheet, View } from 'react-native';

import { FeatureCard } from '@/components/feature-card';
import { PrimaryButton } from '@/components/primary-button';
import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { TrustedContactCard } from '@/components/trusted-contact-card';
import { Spacing } from '@/constants/theme';
import { strings } from '@/i18n/strings';
import { isRelationshipKey } from '@/lib/trusted-contacts';
import { useTrustedContactsStore } from '@/store/trusted-contacts-store';

export default function TrustedContactsScreen() {
  const contacts = useTrustedContactsStore((state) => state.contacts);
  const isLoaded = useTrustedContactsStore((state) => state.isLoaded);
  const error = useTrustedContactsStore((state) => state.error);
  const permission = useTrustedContactsStore((state) => state.permission);
  const loadContacts = useTrustedContactsStore((state) => state.loadContacts);
  const checkPermission = useTrustedContactsStore((state) => state.checkPermission);
  const removeContact = useTrustedContactsStore((state) => state.removeContact);

  useEffect(() => {
    void Promise.all([loadContacts(), checkPermission()]);
  }, [loadContacts, checkPermission]);

  const needsOnboarding = !permission || permission.status === 'undetermined';
  const showOnboarding = needsOnboarding && contacts.length === 0;
  const showDenied = permission?.status === 'denied' && contacts.length === 0;

  const isInitialized = isLoaded && permission !== null;

  return (
    <ScreenShell
      testID="trusted-contacts-screen"
      title={strings.trustedContacts.list.title}
      subtitle={strings.trustedContacts.list.subtitle}
      footer={
        !showOnboarding && !showDenied ? (
          <PrimaryButton
            testID="trusted-contacts-add"
            label={strings.trustedContacts.list.add}
            onPress={() => router.push('/trusted-contacts/add')}
          />
        ) : null
      }>
      <FeatureCard
        testID="trusted-contacts-security-note"
        body={strings.trustedContacts.list.securityNote}
      />

      {!isInitialized ? (
        <View style={styles.centered}>
          <ThemedText type="small" themeColor="textSecondary">
            {strings.trustedContacts.list.loading}
          </ThemedText>
        </View>
      ) : showOnboarding ? (
        <FeatureCard
          testID="trusted-contacts-onboarding-card"
          title={strings.trustedContacts.list.setupTitle}
          body={strings.trustedContacts.list.onboardingBody}>
          <PrimaryButton
            testID="trusted-contacts-onboarding-cta"
            label={strings.trustedContacts.list.startOnboarding}
            onPress={() => router.push('/trusted-contacts/onboarding')}
          />
          <PrimaryButton
            testID="trusted-contacts-enter-manually"
            variant="subtle"
            label={strings.trustedContacts.onboarding.request.enterManually}
            onPress={() => router.push('/trusted-contacts/add?manual=1')}
          />
        </FeatureCard>
      ) : showDenied ? (
        <FeatureCard
          testID="trusted-contacts-denied-card"
          title={strings.trustedContacts.list.permissionDeniedTitle}
          body={strings.trustedContacts.list.permissionDeniedBody}>
          <PrimaryButton
            testID="open-settings"
            label={strings.trustedContacts.list.openSettings}
            onPress={() => Linking.openSettings()}
          />
          <PrimaryButton
            testID="trusted-contacts-enter-manually"
            variant="subtle"
            label={strings.trustedContacts.list.manualEntryHint}
            onPress={() => router.push('/trusted-contacts/add?manual=1')}
          />
        </FeatureCard>
      ) : contacts.length === 0 ? (
        <FeatureCard
          testID="trusted-contacts-empty"
          title={strings.trustedContacts.list.emptyTitle}
          body={strings.trustedContacts.list.emptyBody}>
          <PrimaryButton
            testID="trusted-contacts-add-first"
            label={strings.trustedContacts.list.addFirst}
            onPress={() => router.push('/trusted-contacts/add')}
          />
        </FeatureCard>
      ) : (
        <FlatList
          testID="trusted-contacts-list"
          data={contacts}
          keyExtractor={(contact) => contact.id}
          scrollEnabled={false}
          contentContainerStyle={styles.list}
          ListHeaderComponent={
            error ? <ThemedText type="small">{error}</ThemedText> : null
          }
          renderItem={({ item }) => (
            <TrustedContactCard
              contact={item}
              relationshipLabel={
                isRelationshipKey(item.relationship)
                  ? strings.trustedContacts.relationships[item.relationship]
                  : strings.trustedContacts.relationships.other
              }
              onEdit={() => router.push(`/trusted-contacts/add?id=${item.id}`)}
              onRemove={() =>
                Alert.alert(
                  strings.appName,
                  `${strings.trustedContacts.list.remove} ${item.name}?`,
                  [
                    { text: strings.trustedContacts.list.cancel, style: 'cancel' },
                    {
                      text: strings.trustedContacts.list.confirmRemove,
                      style: 'destructive',
                      onPress: () => removeContact(item.id),
                    },
                  ],
                )
              }
            />
          )}
        />
      )}
    </ScreenShell>
  );
}

const styles = StyleSheet.create({
  centered: {
    paddingVertical: Spacing.six,
    alignItems: 'center',
  },
  list: {
    gap: Spacing.three,
  },
});