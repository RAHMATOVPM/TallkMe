import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useOnlineCount(userId: string) {
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;

    const beat = async () => {
      await supabase.from("presence").upsert(
        { user_id: userId, last_seen: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      const { data } = await supabase.rpc("online_count");
      if (!cancelled && typeof data === "number") setCount(data);
    };

    beat();
    const id = setInterval(beat, 10_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [userId]);

  return count;
}
