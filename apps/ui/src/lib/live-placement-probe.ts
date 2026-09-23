import { logger } from '@founders-coffee/observability';

export const LIVE_PLACEMENT_PROBE_PATH = '/api/live-placement-probe';

const CANDIDATE_HINTS = [
  'weur',
  'me',
  'afr',
] as const satisfies readonly DurableObjectLocationHint[];
const ROUNDS = 5;
const PROBE_ENVIRONMENTS: ReadonlySet<string> = new Set([
  'development',
  'staging',
]);

interface ProbeEnv {
  readonly APP_ENVIRONMENT?: string;
  readonly EVENT_LIVE: DurableObjectNamespace;
}

type HintTiming = {
  hint: DurableObjectLocationHint;
  roomStatus: number;
  roundTripMs: number[];
};

type EdgeFacts = {
  colo?: string;
  country?: string;
  clientTcpRtt?: number;
};

/** Whether this deployment answers the placement probe: staging and local development, never production. */
export const servesPlacementProbe = (env: {
  readonly APP_ENVIRONMENT?: string;
}): boolean => PROBE_ENVIRONMENTS.has(env.APP_ENVIRONMENT ?? '');

/**
 * Time `ROUNDS` sequential round trips to the probe room created under `hint`.
 *
 * The probe rooms are ordinary live room objects under names no meetup can take, so each is created
 * with its hint on the first probe that reaches it and stays where that put it. A plain GET is
 * refused by the room with 405 before it touches storage, which makes the round trip the whole of
 * the cost: nothing is written, and no socket or alarm is left behind. The first round includes
 * waking the object, so it is reported with the rest rather than folded into an average.
 */
const timeRoom = async (
  namespace: DurableObjectNamespace,
  hint: DurableObjectLocationHint,
): Promise<HintTiming> => {
  const room = namespace.get(namespace.idFromName(`placement-probe:${hint}`), {
    locationHint: hint,
  });
  const roundTripMs: number[] = [];
  let roomStatus = 0;
  for (let round = 0; round < ROUNDS; round += 1) {
    const started = Date.now();
    const answer = await room.fetch('https://placement-probe/');
    roundTripMs.push(Date.now() - started);
    roomStatus = answer.status;
    await answer.body?.cancel();
  }
  return { hint, roomStatus, roundTripMs };
};

/**
 * Measure, from the Cloudflare edge that served this request, how far a live room is under each
 * location hint the markets could use (#88). Temporary: it exists to record those figures and is
 * removed once they are.
 *
 * A member's live traffic runs from their browser to the edge that served them, then from that edge
 * to the room. Only the second leg depends on the hint, so that is what is timed, room by room and
 * one round trip at a time. `clientTcpRttMs` is Cloudflare's measure of the first leg, for reading
 * the two together; it is null when the browser reached the edge over QUIC. Each result is logged
 * too, so figures taken by people in another market can be read back from the Worker's logs.
 */
export const probeLivePlacement = async (
  request: Request,
  env: ProbeEnv,
): Promise<Response> => {
  const hints: HintTiming[] = [];
  for (const hint of CANDIDATE_HINTS)
    hints.push(await timeRoom(env.EVENT_LIVE, hint));
  const edge = (request.cf ?? {}) as EdgeFacts;
  const result = {
    colo: edge.colo ?? null,
    country: edge.country ?? null,
    clientTcpRttMs: edge.clientTcpRtt ?? null,
    hints,
  };
  logger.info('live_placement_probed', result);
  return Response.json(result, { headers: { 'cache-control': 'no-store' } });
};
