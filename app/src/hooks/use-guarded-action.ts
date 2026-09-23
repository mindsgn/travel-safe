import { useCallback } from 'react';

import { strings } from '@/i18n/strings';
import { guardSensitiveAction } from '@/lib/local-auth';
import { useAppStore } from '@/store';

/** Wraps an action so it requires Face ID / fingerprint / passcode when settings protection is on. */
export function useGuardedAction() {
  const enabled = useAppStore((state) => state.security.protectSettings);
  return useCallback(
    async (action: () => void | Promise<void>) => {
      if (await guardSensitiveAction(enabled, strings.settings.security.prompt)) await action();
    },
    [enabled],
  );
}
