import { act, create } from 'react-test-renderer';

import { CountdownCard } from '@/components/emergency/countdown-card';
import { EmergencyEndedCard } from '@/components/emergency/emergency-ended-card';
import { EmergencyStatusCard } from '@/components/emergency/emergency-status-card';
import { SosTriggerButton } from '@/components/emergency/sos-trigger-button';

type RendererRoot = ReturnType<typeof create>['root'];

function interactable(root: RendererRoot, testID: string) {
  const node = root.findAllByProps({ testID }).find(
    (candidate) =>
      typeof candidate.props.onPress === 'function' && candidate.props.accessibilityRole === 'button',
  );
  if (!node) throw new Error(`No interactable testID "${testID}" found`);
  return node;
}

function renderedValues(root: RendererRoot, testID: string): string[] {
  return root
    .findAllByProps({ testID })
    .map((node) =>
      Array.isArray(node.props.children) ? node.props.children.join('') : String(node.props.children),
    )
    .filter(Boolean);
}

describe('SosTriggerButton', () => {
  it('renders the label and calls onPress when pressed', () => {
    const onPress = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(<SosTriggerButton testID="sos-trigger" label="SOS" onPress={onPress} />);
    });

    const trigger = interactable(renderer.root, 'sos-trigger');
    expect(trigger.props.accessibilityRole).toBe('button');
    expect(trigger.props.accessibilityLabel).toBe('SOS');

    act(() => trigger.props.onPress());
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('forwards the disabled state so the native button will not fire', () => {
    const onPress = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <SosTriggerButton testID="sos-trigger" label="SOS" onPress={onPress} disabled />,
      );
    });

    const trigger = interactable(renderer.root, 'sos-trigger');
    expect(trigger.props.disabled).toBe(true);
    expect(trigger.props.accessibilityState.disabled).toBe(true);
  });
});

describe('CountdownCard', () => {
  it('shows the seconds remaining and cancels via the button', () => {
    const onCancel = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <CountdownCard
          testID="sos-countdown"
          remainingSeconds={3}
          eyebrow="Emergency alert"
          prompt="Sending alert in…"
          cancelLabel="Cancel SOS"
          onCancel={onCancel}
        />,
      );
    });

    expect(renderedValues(renderer.root, 'sos-countdown-value')).toContain('3');

    act(() => interactable(renderer.root, 'sos-cancel').props.onPress());
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});

describe('EmergencyStatusCard', () => {
  it('renders accuracy, update count and ends the emergency', () => {
    const onEnd = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <EmergencyStatusCard
          testID="sos-status"
          statusTitle="Emergency active"
          statusBody="Sharing your live location."
          alertStatus="Alert sent to 2 trusted contacts"
          rows={[
            { label: 'Location accuracy', value: '±12 m', valueTestID: 'emergency-test-accuracy' },
            { label: 'Location updates sent', value: '3', valueTestID: 'emergency-test-updates' },
          ]}
          endLabel="End emergency"
          onEnd={onEnd}
        />,
      );
    });

    const values = renderedValues(renderer.root, 'emergency-test-accuracy');
    expect(values).toContain('±12 m');
    expect(renderedValues(renderer.root, 'emergency-test-updates')).toContain('3');

    act(() => interactable(renderer.root, 'sos-end').props.onPress());
    expect(onEnd).toHaveBeenCalledTimes(1);
  });
});

describe('EmergencyEndedCard', () => {
  it('shows the ended message and dismisses via the done button', () => {
    const onDone = jest.fn();
    let renderer!: ReturnType<typeof create>;

    act(() => {
      renderer = create(
        <EmergencyEndedCard
          testID="sos-ended"
          title="Emergency ended"
          body="Live location sharing has stopped."
          doneLabel="Done"
          onDone={onDone}
        />,
      );
    });

    expect(renderer.root.findAllByProps({ testID: 'sos-ended' }).length).toBeGreaterThan(0);

    act(() => interactable(renderer.root, 'sos-done').props.onPress());
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});