import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useExercises(selectedMuscle: string | null) {
  const [exercises, setExercises] = useState<any[]>([]);
  useEffect(() => {
    if (!selectedMuscle) {
      setExercises([]);
      return;
    }
    async function loadExercises() {
      try {
        const { data, error } = await supabase
          .from("exercises")
          .select("*")
          .eq("muscle_group", selectedMuscle);
        if (error) throw error;
        setExercises(data || []);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error("Error loading exercises:", error);
      }
    }
    loadExercises();
  }, [selectedMuscle]);
  return exercises;
}
