import { act, create } from 'react-test-renderer';

import { TripPlannerCard } from './trip-planner-card';

function findByTestID(root: ReturnType<typeof create>, testID: string) {
  const match = root.root.findAllByProps({ testID });
  if (match.length === 0) throw new Error(`No testID "${testID}" found`);
  return match[0];
}

const ORIGIN = { latitude: -33.9249, longitude: 18.4241, label: 'Cape Town CBD' };
const DESTINATION = { latitude: -33.927, longitude: 18.447, label: 'Woodstock' };

describe('TripPlannerCard', () => {
  it('shows the origin field with a current-location action and hides the destination', () => {
    const onUseCurrentLocation = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TripPlannerCard
          canUseCurrentLocation
          statusMessage="Planning route…"
          origin={null}
          destination={null}
          onPressOrigin={jest.fn()}
          onPressDestination={jest.fn()}
          onUseCurrentLocation={onUseCurrentLocation}
        />,
      );
    });
    expect(findByTestID(renderer, 'trip-plan-card')).toBeTruthy();
    expect(findByTestID(renderer, 'trip-origin-input')).toBeTruthy();
    expect(findByTestID(renderer, 'trip-route-hint')).toBeTruthy();
    expect(() => findByTestID(renderer, 'trip-destination-input')).toThrow();
    act(() => {
      findByTestID(renderer, 'trip-origin-input-action').props.onPress();
    });
    expect(onUseCurrentLocation).toHaveBeenCalledTimes(1);
  });

  it('asks the user to pick a destination once the origin is set', () => {
    const onPressDestination = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TripPlannerCard
          canUseCurrentLocation
          origin={ORIGIN}
          destination={null}
          onPressOrigin={jest.fn()}
          onPressDestination={onPressDestination}
          onUseCurrentLocation={jest.fn()}
        />,
      );
    });
    expect(findByTestID(renderer, 'trip-origin-input-value').props.children).toBe('Cape Town CBD');
    expect(() => findByTestID(renderer, 'trip-origin-input-action')).toThrow();
    expect(findByTestID(renderer, 'trip-destination-input')).toBeTruthy();
    act(() => {
      findByTestID(renderer, 'trip-destination-input').props.onPress();
    });
    expect(onPressDestination).toHaveBeenCalledTimes(1);
  });

  it('hides the current-location action when GPS is unavailable', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TripPlannerCard
          canUseCurrentLocation={false}
          origin={null}
          destination={null}
          onPressOrigin={jest.fn()}
          onPressDestination={jest.fn()}
          onUseCurrentLocation={jest.fn()}
        />,
      );
    });
    expect(() => findByTestID(renderer, 'trip-origin-input-action')).toThrow();
  });

  it('renders an origin press that opens the origin search', () => {
    const onPressOrigin = jest.fn();
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TripPlannerCard
          canUseCurrentLocation
          origin={null}
          destination={null}
          onPressOrigin={onPressOrigin}
          onPressDestination={jest.fn()}
          onUseCurrentLocation={jest.fn()}
        />,
      );
    });
    act(() => {
      findByTestID(renderer, 'trip-origin-input').props.onPress();
    });
    expect(onPressOrigin).toHaveBeenCalledTimes(1);
  });

  it('shows the selected destination label', () => {
    let renderer: ReturnType<typeof create>;
    act(() => {
      renderer = create(
        <TripPlannerCard
          canUseCurrentLocation
          origin={ORIGIN}
          destination={DESTINATION}
          onPressOrigin={jest.fn()}
          onPressDestination={jest.fn()}
          onUseCurrentLocation={jest.fn()}
        />,
      );
    });
    expect(findByTestID(renderer, 'trip-destination-input-value').props.children).toBe('Woodstock');
  });
});