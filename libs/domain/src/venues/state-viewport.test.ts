import { describe, expect, it } from 'vitest';

import { findCity } from '../geo/index.js';
import { DZ_CITY_VENUES } from './data/dz.js';
import {
  containsPoint,
  getCityViewportSnapshot,
  getMarketViewport,
  getStateViewport,
  getUnplacedTownViewport,
} from './index.js';

const ALGIERS = '556';
const MEDEA_STATE = '26';

describe('getStateViewport', () => {
  it('opens on the snapshotted city of the state, where one exists', () => {
    const algiers = getCityViewportSnapshot('DZ', ALGIERS);
    const state = findCity('DZ', ALGIERS)?.stateCode;
    if (!algiers || !state) throw new Error('Algiers left the snapshot');

    expect(getStateViewport('DZ', state)).toEqual(algiers);
  });

  it('covers every snapshotted city of the state', () => {
    const inMedea = Object.values(DZ_CITY_VENUES).filter(
      (snapshot) =>
        findCity('DZ', snapshot.cityCode)?.stateCode === MEDEA_STATE,
    );
    const viewport = getStateViewport('DZ', MEDEA_STATE);

    expect(inMedea.length).toBeGreaterThan(0);
    expect(viewport).not.toBeNull();
    for (const snapshot of inMedea)
      expect(
        containsPoint(viewport?.bounds ?? [0, 0, 0, 0], snapshot.center),
      ).toBe(true);
  });

  it('is narrower than the market it sits in', () => {
    const state = getStateViewport('DZ', MEDEA_STATE);
    const market = getMarketViewport('DZ');
    if (!state || !market) throw new Error('the DZ snapshot is empty');

    expect(state.bounds[2] - state.bounds[0]).toBeLessThan(
      market.bounds[2] - market.bounds[0],
    );
  });

  it('returns nothing for a state with no snapshotted city', () => {
    expect(getStateViewport('DZ', 'no-such-state')).toBeNull();
    expect(getStateViewport('XX', MEDEA_STATE)).toBeNull();
  });
});

describe('getUnplacedTownViewport', () => {
  it('opens on the town’s state where the snapshot holds a city in it', () => {
    const state = getStateViewport('DZ', MEDEA_STATE);

    expect(state).not.toBeNull();
    expect(getUnplacedTownViewport('DZ', MEDEA_STATE)).toEqual(state);
  });

  it('widens to the market for a state the snapshot does not cover', () => {
    const market = getMarketViewport('DZ');

    expect(market).not.toBeNull();
    expect(getUnplacedTownViewport('DZ', 'no-such-state')).toEqual(market);
  });

  it('has nowhere to open in a market with no snapshot', () => {
    expect(getUnplacedTownViewport('XX', MEDEA_STATE)).toBeNull();
  });
});
