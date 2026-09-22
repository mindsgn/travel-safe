import { router } from 'expo-router';

import { EmergencyPanel } from '@/components/emergency/emergency-panel';
import { ScrollView } from 'react-native';

export default function EmergencyTabScreen() {
  return (
    <ScrollView>
      <EmergencyPanel testID="emergency-screen" onDone={() => router.navigate('/')} />
    </ScrollView>
  );
}
