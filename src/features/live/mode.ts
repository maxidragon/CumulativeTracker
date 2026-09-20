import { isScoretakingTokenExpired, readScoretakingToken } from "../../lib/wcaLive";
import type { AuthSession } from "../auth/model";
import type { CompetitionTracking } from "../competition/trackingStore";

export function activeLiveToken(
  competitionId: string,
  tracking: CompetitionTracking | undefined,
  session: AuthSession | null,
) {
  if (!tracking?.liveEnabled || !session) return null;
  const token = readScoretakingToken(competitionId);
  return token && !isScoretakingTokenExpired(token) ? token : null;
}
