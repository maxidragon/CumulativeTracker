export const WCA_ORIGIN = "https://www.worldcubeassociation.org";

export const getWcif = async (competitionId: string): Promise<any> => {
  const response = await wcaApiRequest(`competitions/${competitionId}/wcif/public`);
  if (!response.ok) {
    throw new Error(
      `Error fetching WCIF for competition ${competitionId}: ${response.statusText}`
    );
  }
  return response.json();
};

export const wcaApiRequest = (path: string, token?: string) => {
  const headers = new Headers();
  headers.append("Content-Type", "application/json");
  if (token) {
    headers.append("Authorization", `Bearer ${token}`);
  }
  return fetch(`${WCA_ORIGIN}/api/v0/${path}`, {
    method: "GET",
    headers: headers,
    redirect: "follow",
  });
};
