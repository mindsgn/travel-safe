import { getMapboxToken } from '@/lib/config';

export type MapboxTokenSetter = {
  setAccessToken: (token: string) => void;
};

export function configureMapbox(
  token = getMapboxToken(),
  maps?: MapboxTokenSetter | null,
): boolean {
  if (!token || !maps) return false;
  maps.setAccessToken(token);
  return true;
}
