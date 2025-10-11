import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import ThreeScene from "@/components/ThreeScene";

const MuscleSelector = () => {
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [gender, setGender] = useState<string>("male");

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

  const muscleGroups = [
    "chest", "back", "shoulders", "biceps", "triceps", 
    "legs", "abs", "glutes", "calves", "forearms"
  ];

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
              <div className="aspect-square bg-muted rounded-lg overflow-hidden">
                <ThreeScene gender={gender} onMuscleSelect={setSelectedMuscle} />
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
                {muscleGroups.map((muscle) => (
                  <Badge
                    key={muscle}
                    variant={selectedMuscle === muscle ? "default" : "outline"}
                    className={`cursor-pointer capitalize text-sm py-2 px-4 ${
                      selectedMuscle === muscle
                        ? "bg-gradient-primary shadow-glow-primary"
                        : "hover:bg-muted"
                    }`}
                    onClick={() => setSelectedMuscle(muscle)}
                  >
                    {muscle}
                  </Badge>
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