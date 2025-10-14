import React, { useState, useEffect, lazy, Suspense, useRef } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

// Lazy load the ThreeScene component
const ThreeScene = lazy(() => import("@/components/ThreeScene"));

import { useMuscleData } from "@/hooks/useMuscleData";
import { useUserGender } from "@/hooks/useUserGender";
import { useExercises } from "@/hooks/useExercises";


// Use custom hooks for muscle data, gender, and exercises
const {
  meshNameOverrides,
  groupToMuscles,
  linkedMuscles,
  backFacingMuscles,
  sideFacingMuscles,
  prettify,
} = useMuscleData();
const gender = useUserGender();

const MuscleSelector = () => {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  // gender and exercises now come from hooks
  const exercises = useExercises(selectedMuscle);
  const [selectedMuscleLabel, setSelectedMuscleLabel] = useState<string | null>(null);
  const threeSceneRef = useRef<any>(null);

  // This array will be passed to ThreeScene for highlighting
  const selectedMuscles =
    selectedGroup
      ? groupToMuscles[selectedGroup]
      : selectedMuscle && linkedMuscles[selectedMuscle]
        ? linkedMuscles[selectedMuscle]
        : selectedMuscle
          ? [selectedMuscle]
          : [];


  // All data loading is now handled by hooks

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
                    ref={threeSceneRef}
                    gender={gender}
                    onMuscleSelect={(muscleKey, muscleLabel) => {
                      setSelectedMuscle(muscleKey);
                      setSelectedMuscleLabel(muscleLabel);
                      setSelectedGroup(null);
                    }}
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
                        {group === "Chest" ? (
                          <>
                            <button
                              className={`block w-full text-left px-2 py-1 rounded capitalize ${
                                (selectedMuscle === "chest_upper_left" || selectedMuscle === "chest_upper_right")
                                  ? "bg-primary text-white"
                                  : "hover:bg-muted"
                              }`}
                              onClick={() => {
                                setSelectedMuscle("chest_upper_left");
                                setSelectedMuscleLabel("Upper Chest");
                                setSelectedGroup(null);
                                if (threeSceneRef.current) {
                                  threeSceneRef.current.rotateTo("front");
                                }
                              }}
                            >
                              Upper Chest
                            </button>
                            {/* Render the rest of the chest muscles except upper left/right */}
                            {groupToMuscles[group]
                              .filter(
                                (muscleKey) =>
                                  muscleKey !== "chest_upper_left" && muscleKey !== "chest_upper_right"
                              )
                              .map((muscleKey) => (
                                <button
                                  key={muscleKey}
                                  className={`block w-full text-left px-2 py-1 rounded capitalize ${
                                    selectedMuscle === muscleKey ? "bg-primary text-white" : "hover:bg-muted"
                                  }`}
                                  onClick={() => {
                                    setSelectedMuscle(muscleKey);
                                    setSelectedMuscleLabel(meshNameOverrides[muscleKey]?.label || prettify(muscleKey));
                                    setSelectedGroup(null);
                                    if (threeSceneRef.current) {
                                      if (backFacingMuscles.includes(muscleKey)) {
                                        threeSceneRef.current.rotateTo("back");
                                      } else if (sideFacingMuscles.includes(muscleKey)) {
                                        threeSceneRef.current.rotateTo("side");
                                      } else {
                                        threeSceneRef.current.rotateTo("front");
                                      }
                                    }
                                  }}
                                >
                                  {meshNameOverrides[muscleKey].label}
                                </button>
                              ))}
                          </>
                        ) : (
                          groupToMuscles[group].map((muscleKey) => (
                            <button
                              key={muscleKey}
                              className={`block w-full text-left px-2 py-1 rounded capitalize ${
                                selectedMuscle === muscleKey ? "bg-primary text-white" : "hover:bg-muted"
                              }`}
                              onClick={() => {
                                setSelectedMuscle(muscleKey);
                                setSelectedMuscleLabel(meshNameOverrides[muscleKey]?.label || prettify(muscleKey));
                                setSelectedGroup(null);
                                if (threeSceneRef.current) {
                                  if (backFacingMuscles.includes(muscleKey)) {
                                    threeSceneRef.current.rotateTo("back");
                                  } else if (sideFacingMuscles.includes(muscleKey)) {
                                    threeSceneRef.current.rotateTo("side");
                                  } else {
                                    threeSceneRef.current.rotateTo("front");
                                  }
                                }
                              }}
                            >
                              {meshNameOverrides[muscleKey].label}
                            </button>
                          ))
                        )}
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
              <CardTitle className="capitalize">
                {selectedMuscleLabel || meshNameOverrides[selectedMuscle]?.label || prettify(selectedMuscle)} Exercises
              </CardTitle>
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