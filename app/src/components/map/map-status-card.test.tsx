import { act, create, type ReactTestRenderer } from 'react-test-renderer';

import { MapStatusCard } from './map-status-card';

function render(status: Parameters<typeof MapStatusCard>[0]['status'], onRetry?: () => void) {
  let renderer!: ReactTestRenderer;
  act(() => {
    renderer = create(<MapStatusCard status={status} onRetry={onRetry} />);
  });
  return renderer;
}

function findByTestID(root: ReactTestRenderer, testID: string) {
  const match = root.root.findAllByProps({ testID });
  if (match.length === 0) throw new Error(`No testID "${testID}" found`);
  return match[0];
}

describe('MapStatusCard', () => {
  it('renders nothing for idle, ready and stale statuses', () => {
    for (const status of ['idle', 'ready', 'stale'] as const) {
      const root = render(status);
      expect(root.toJSON()).toBeNull();
    }
  });

  it('shows a loading card while locating', () => {
    const root = render('locating');
    expect(findByTestID(root, 'map-loading')).toBeTruthy();
    expect(findByTestID(root, 'map-loading-indicator')).toBeTruthy();
  });

  it('shows the permission denied card', () => {
    const root = render('permission-denied');
    expect(findByTestID(root, 'map-permission-denied')).toBeTruthy();
  });

  it('shows the services disabled card', () => {
    const root = render('services-disabled');
    expect(findByTestID(root, 'map-services-disabled')).toBeTruthy();
  });

  it('shows the GPS unavailable card', () => {
    const root = render('gps-unavailable');
    expect(findByTestID(root, 'map-gps-unavailable')).toBeTruthy();
  });

  it('shows the inaccurate card', () => {
    const root = render('inaccurate');
    expect(findByTestID(root, 'map-inaccurate')).toBeTruthy();
  });

  it('shows the generic error card for unknown failures', () => {
    const root = render('error');
    expect(findByTestID(root, 'map-location-error')).toBeTruthy();
  });

  it('lets a recoverable state retry', () => {
    const onRetry = jest.fn();
    const root = render('error', onRetry);
    const retry = findByTestID(root, 'map-retry');
    act(() => retry.props.onPress());
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('hides the retry button when no retry handler is provided', () => {
    const root = render('error');
    expect(() => findByTestID(root, 'map-retry')).toThrow();
  });
});