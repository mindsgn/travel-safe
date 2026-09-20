import { useEffect } from 'react';
import { act, create } from 'react-test-renderer';

import { createMemoryDeviceCodeStore } from '@/lib/device-identity';

import { useDeviceCode } from './use-device-code';

jest.mock('@/lib/device-identity-sqlite', () => ({
  sqliteDeviceCodeStore: {
    get: () => null,
    set: () => undefined,
  },
}));

function Probe({ onCode, store }: { onCode: (code: string) => void; store: ReturnType<typeof createMemoryDeviceCodeStore> }) {
  const code = useDeviceCode(store);
  useEffect(() => {
    onCode(code);
  }, [code, onCode]);
  return null;
}

describe('useDeviceCode', () => {
  it('returns a stable saved code', async () => {
    const store = createMemoryDeviceCodeStore('TS-STABLE01');
    const codes: string[] = [];
    await act(async () => {
      create(<Probe store={store} onCode={(code) => codes.push(code)} />);
    });
    expect(codes.at(-1)).toBe('TS-STABLE01');
  });
});
