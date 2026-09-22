import Constants from 'expo-constants';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QRCode } from '@/shared/components/base/qr-code';

import { FeatureCard } from '@/components/feature-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useDeviceCode } from '@/hooks/use-device-code';
import { strings } from '@/i18n/strings';

export default function AccountScreen() {
  const version = Constants.expoConfig?.version ?? '0.0.0';
  const deviceCode = useDeviceCode();

  return (
    <ThemedView testID="account-screen" style={styles.root}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View
          style={styles.scroll}>
          <View style={{flex:1}}>
            <QRCode
              style={{alignSelf: "center"}}>
              <QRCode.Label>Show QR Code</QRCode.Label>
              <QRCode.Value value={deviceCode} />
                <QRCode.Actions>
                  <QRCode.CloseButton />
                </QRCode.Actions>
            </QRCode>
          </View>


          <View testID="account-version" style={styles.version}>
            <ThemedText type="small" themeColor="textSecondary">
              {strings.account.version.replace('{version}', version)}
            </ThemedText>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingBottom: 100
  },
  safeArea: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    paddingHorizontal: Spacing.three,
    paddingTop: Spacing.two,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  header: {
    gap: Spacing.half,
    paddingVertical: Spacing.two,
  },
  version: {
    alignItems: 'center',
    paddingTop: Spacing.two,
  },
  pressed: {
    opacity: 0.8,
  },
});
