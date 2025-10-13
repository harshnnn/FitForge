import React, { useState, useEffect, lazy, Suspense } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

// Lazy load the ThreeScene component
const ThreeScene = lazy(() => import("@/components/ThreeScene"));

// --- Place this outside your component ---
type MeshNameOverride = {
  label: string;
  group?: string;
  // add other properties if needed
};
const meshNameOverrides: Record<string, MeshNameOverride> = {
  //Upper Body
  neck: { label: "Neck" },
  //Shoulder
  upper_traps: { label: "Upper traps", group: "Shoulder" },
  side_delts: { label: "Side Delts", group: "Shoulder" },
  front_delts: { label: "Front Delts", group: "Shoulder" },
  rear_delts: { label: "Rear Delts", group: "Shoulder" },
  //Chest
  chest_lower: { label: "Lower Chest", group: "Chest" },
  chest_middle: { label: "Middle Chest", group: "Chest" },
  chest_upper_left: { label: "Upper Chest (Left)", group: "Chest" },
  chest_upper_right: { label: "Upper Chest (Right)", group: "Chest" },
  //Mid section
  abs: { label: "Abs", group: "Core" },
  obliques: { label: "Obliques", group: "Core" },
  serratus_anterior: { label: "Serratus anterior", group: "Core" },
  //Arms
  biceps: { label: "Biceps", group: "Arms" },
  triceps: { label: "Triceps", group: "Arms" },
  forearms: { label: "Forearms", group: "Arms" },
  //Back
  mid_traps: { label: "Mid Traps", group: "Back" },
  lower_traps: { label: "Lower Traps", group: "Back" },
  teres_major: { label: "Teres Major", group: "Back" },
  infraspinatus: { label: "Infraspinatus", group: "Back" },
  lats: { label: "Lats", group: "Back" },
  lower_back: { label: "Lower Back", group: "Back" },
  //Lower Body
  glutes: { label: "Glutes", group:"Legs" },
  adductors: { label: "Adductors", group:"Legs" },
  quads: { label: "Quads" , group:"Legs"},
  hamstrings: { label: "Hamstrings", group:"Legs" },
  shin: { label: "Shin" , group:"Legs"},
  calves: { label: "Calves" , group:"Legs"},
};
const groupToMuscles: Record<string, string[]> = {};
Object.entries(meshNameOverrides).forEach(([meshKey, value]) => {
  const group = value.group;
  if (group) {
    if (!groupToMuscles[group]) groupToMuscles[group] = [];
    groupToMuscles[group].push(meshKey);
  }
});

const MuscleSelector = () => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [gender, setGender] = useState<string>("male");
  const [exercises, setExercises] = useState<any[]>([]);

  // This array will be passed to ThreeScene for highlighting
  const selectedMuscles = selectedGroup
    ? groupToMuscles[selectedGroup]
    : selectedMuscle
      ? [selectedMuscle]
      : [];

  useEffect(() => {
    loadUserGender();
  }, []);

  useEffect(() => {
    if (selectedMuscle) {
      loadExercises();
    }
  }, [selectedMuscle]);

  const loadUserGender = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("gender")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data?.gender) {
        setGender(data.gender);
      }
    } catch (error) {
      console.error("Error loading gender:", error);
    }
  };

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .eq("muscle_group", selectedMuscle);

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error("Error loading exercises:", error);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-accent rounded-full shadow-glow-accent">
              <Zap className="w-8 h-8 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            3D Muscle Selector
          </h1>
          <p className="text-muted-foreground">
            Select a muscle group to see exercises
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 mb-8">
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Interactive 3D Model</CardTitle>
              <CardDescription>Click on muscles to explore exercises</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="aspect-square min-h-[300px] bg-muted rounded-lg overflow-hidden">
                <Suspense fallback={<div>Loading 3D...</div>}>
                  <ThreeScene
                    gender={gender}
                    onMuscleSelect={setSelectedMuscle}
                    selectedMuscles={selectedMuscles}
                  />
                </Suspense>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <CardTitle>Muscle Groups</CardTitle>
              <CardDescription>Or select from the list below</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {Object.keys(groupToMuscles).map((group) => (
                  <div key={group} className="mb-2">
                    <button
                      className={`font-bold capitalize w-full text-left px-2 py-1 rounded ${selectedGroup === group ? "bg-accent" : "hover:bg-muted"}`}
                      onClick={() => {
                        setExpandedGroup(group); // Always expand the group when clicked
                        setSelectedGroup(group); // Set the group as selected
                        setSelectedMuscle(null); // Clear individual muscle selection
                      }}
                    >
                      {group}
                    </button>
                    {expandedGroup === group && (
                      <div className="pl-4">
                        {groupToMuscles[group].map((muscleKey) => (
                          <button
                            key={muscleKey}
                            className={`block w-full text-left px-2 py-1 rounded capitalize ${selectedMuscle === muscleKey ? "bg-primary text-white" : "hover:bg-muted"}`}
                            onClick={() => {
                              setSelectedMuscle(muscleKey);
                              setSelectedGroup(null);
                            }}
                          >
                            {meshNameOverrides[muscleKey].label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {selectedMuscle && (
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="capitalize">{selectedMuscle} Exercises</CardTitle>
              <CardDescription>
                {exercises.length} exercise{exercises.length !== 1 ? "s" : ""} found
              </CardDescription>
            </CardHeader>
            <CardContent>
              {exercises.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  No exercises found for this muscle group yet.
                </p>
              ) : (
                <div className="grid md:grid-cols-2 gap-4">
                  {exercises.map((exercise) => (
                    <Card key={exercise.id} className="border-border/30 hover:border-primary/50 transition-colors">
                      <CardHeader>
                        <CardTitle className="text-lg">{exercise.name}</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">{exercise.description}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default MuscleSelector;