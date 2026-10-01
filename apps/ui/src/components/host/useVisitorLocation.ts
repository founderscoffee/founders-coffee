import { useState } from 'react';

export type Coordinates = { longitude: number; latitude: number };

/**
 * Ask the browser where the visitor is, settling on null when they refuse or it cannot tell.
 */
const askBrowser = (): Promise<Coordinates | null> =>
  new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
        }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 6_000 },
    );
  });

/**
 * Where the visitor is, asked of the browser only when they press Locate me, and whether the
 * browser is still finding out: a precise fix can take seconds, too long for a press to go
 * unanswered.
 */
export const useVisitorLocation = () => {
  const [isFinding, setIsFinding] = useState(false);
  const locate = async (): Promise<Coordinates | null> => {
    setIsFinding(true);
    const coordinates = await askBrowser();
    setIsFinding(false);
    return coordinates;
  };
  return { isFinding, locate };
};
