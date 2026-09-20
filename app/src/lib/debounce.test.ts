import { debounce } from './debounce';

describe('debounce', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('delays the callback until the wait has elapsed', () => {
    const fn = jest.fn();
    const handle = debounce(fn, 300);
    handle.call();
    handle.call();
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(300);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('cancels a pending callback', () => {
    const fn = jest.fn();
    const handle = debounce(fn, 300);
    handle.call();
    handle.cancel();
    jest.advanceTimersByTime(300);
    expect(fn).not.toHaveBeenCalled();
  });
});
