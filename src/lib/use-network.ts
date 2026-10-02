import { useEffect, useState } from "react";

export type NetworkState = "online" | "offline" | "connecting";

export function useNetworkStatus(): NetworkState {
  const [state, setState] = useState<NetworkState>(
    typeof navigator !== "undefined" && navigator.onLine ? "online" : "offline",
  );

  useEffect(() => {
    const goOnline = () => setState("connecting");
    const goOffline = () => setState("offline");

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // If we were offline and came back online, show "connecting" briefly
    // then settle to "online" after a short delay to mimic iOS behavior
    let timeout: ReturnType<typeof setTimeout>;
    const observer = () => {
      if (navigator.onLine) {
        setState("connecting");
        clearTimeout(timeout);
        timeout = setTimeout(() => setState("online"), 1200);
      }
    };

    window.addEventListener("online", observer);

    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("online", observer);
      clearTimeout(timeout);
    };
  }, []);

  return state;
}
