import { configureMapbox } from './mapbox';

describe('configureMapbox', () => {
  it('sets the access token when both token and maps SDK exist', () => {
    const maps = { setAccessToken: jest.fn() };
    expect(configureMapbox('pk.test', maps)).toBe(true);
    expect(maps.setAccessToken).toHaveBeenCalledWith('pk.test');
  });

  it('skips configuration without a token or SDK', () => {
    expect(configureMapbox('', { setAccessToken: jest.fn() })).toBe(false);
    expect(configureMapbox('pk.test', null)).toBe(false);
  });
});
