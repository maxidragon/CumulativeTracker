import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { fetchLiveResults } from "../../lib/wcaLive";

export function useLiveResults(competitionId: string, enabled: boolean) {
  return useQuery({
    queryKey: ["wca-live", "results", competitionId],
    queryFn: ({ signal }) => fetchLiveResults(competitionId, signal),
    enabled,
    refetchInterval: enabled ? 30_000 : false,
    refetchOnWindowFocus: true,
    retry: false,
  });
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState(() => navigator.onLine);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
