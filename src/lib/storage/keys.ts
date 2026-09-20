export const storageKeys = {
  calculator: "ct:v1:calculator",
  recentCompetitions: "ct:v1:recent",
  session: "ct:v1:session",
  settings: "ct:v1:settings",
  budgets: (competitionId: string) => `ct:v1:budgets:${competitionId}`,
  token: (competitionId: string) => `ct:v1:token:${competitionId}`,
  wcif: (competitionId: string) => `ct:v1:wcif:${competitionId}`,
} as const;
