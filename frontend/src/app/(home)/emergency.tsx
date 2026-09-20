import { router } from 'expo-router';

import { EmergencyPanel } from '@/components/emergency/emergency-panel';

export default function EmergencyTabScreen() {
  return <EmergencyPanel testID="emergency-screen" onDone={() => router.navigate('/')} />;
}