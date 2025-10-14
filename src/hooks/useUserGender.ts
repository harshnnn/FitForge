import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useUserGender() {
  const [gender, setGender] = useState<string>("male");
  useEffect(() => {
    async function loadUserGender() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data } = await supabase
          .from("profiles")
          .select("gender")
          .eq("user_id", user.id)
          .maybeSingle();
        if (data?.gender) setGender(data.gender);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error loading gender:", error);
      }
    }
    loadUserGender();
  }, []);
  return gender;
}
