import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export function useExercises(selectedMuscle: string | string[] | null) {
  const [exercises, setExercises] = useState<any[]>([]);
  useEffect(() => {
    if (!selectedMuscle) {
      setExercises([]);
      return;
    }

    async function loadExercises() {
      try {
        let query = supabase.from("exercises").select("*");

        if (Array.isArray(selectedMuscle)) {
          const muscles = selectedMuscle.includes("quads")
            ? Array.from(new Set([...(selectedMuscle as string[]), "adductors"]))
            : selectedMuscle;
          // query any of the provided muscle_group keys
          query = query.in("muscle_group", muscles as string[]);
        } else {
          if (selectedMuscle === "quads") {
            query = query.in("muscle_group", ["quads", "adductors"]);
          } else {
            query = query.eq("muscle_group", selectedMuscle as string);
          }
        }

        const { data, error } = await query;
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
