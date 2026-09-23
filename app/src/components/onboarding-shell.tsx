import type { ReactNode } from 'react';

import { ScreenShell } from '@/components/screen-shell';
import { ThemedText } from '@/components/themed-text';
import { format } from '@/i18n/format';
import { strings } from '@/i18n/strings';

export const ONBOARDING_STEPS = ['index', 'name', 'permissions', 'contacts', 'interval', 'ready'] as const;
export type OnboardingStep = (typeof ONBOARDING_STEPS)[number];

export type OnboardingShellProps = {
  step: OnboardingStep;
  title: string;
  body?: string;
  footer: ReactNode;
  children?: ReactNode;
};

export function OnboardingShell({ step, title, body, footer, children }: OnboardingShellProps) {
  const index = ONBOARDING_STEPS.indexOf(step);
  return (
    <ScreenShell testID={`onboarding-${step}`} title={title} subtitle={body} footer={footer} showBack={index > 0}>
      <ThemedText type="small" themeColor="textSecondary">
        {format(strings.onboarding.progress, { step: index + 1, total: ONBOARDING_STEPS.length })}
      </ThemedText>
      {children}
    </ScreenShell>
  );
}
