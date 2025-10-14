import React, { useState, lazy, Suspense, useRef } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";
import { useMuscleData } from "../hooks/useMuscleData";
import { useUserGender } from "../hooks/useUserGender";
import { useExercises } from "../hooks/useExercises";
import ThreeScene from "@/components/ThreeScene"; // Import the ThreeScene component

const MuscleSelector = () => {
  const {
    meshNameOverrides,
    groupToMuscles,
    linkedMuscles,
    backFacingMuscles,
    sideFacingMuscles,
    prettify,
  } = useMuscleData();
  const gender = useUserGender();
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedMuscleLabel, setSelectedMuscleLabel] = useState<string | null>(null);
  const threeSceneRef = useRef<any>(null);
  const exercises = useExercises(selectedMuscle);

  // This array will be passed to ThreeScene for highlighting
  const selectedMuscles =
    selectedGroup
      ? groupToMuscles[selectedGroup]
      : selectedMuscle && linkedMuscles[selectedMuscle]
        ? linkedMuscles[selectedMuscle]
        : selectedMuscle
          ? [selectedMuscle]
          : [];

  // Defensive prettify usage for null/undefined
  const getMuscleLabel = (muscleKey: string | null | undefined) => {
    if (!muscleKey) return "";
    return meshNameOverrides[muscleKey]?.label || prettify(muscleKey);
  };

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

        <div className="flex flex-col lg:flex-row gap-8 mb-8">

          {/* 3D Model Card */}
              <Card className="border-border/50 h-[600px] flex-1 shadow-2xl bg-gradient-to-br from-background to-muted/60 rounded-2xl overflow-hidden flex flex-col">
            <CardHeader className="pb-2 border-b border-border/20 bg-gradient-to-r from-accent/10 to-transparent">
              <CardTitle className="text-2xl font-bold tracking-tight">3D Model</CardTitle>
              <CardDescription className="text-base">Select a muscle on the model</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 flex items-center justify-center p-0">
              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted/40 to-background/80">
                <ThreeScene
                  ref={threeSceneRef}
                  selectedMuscles={selectedMuscles}
                  gender={gender}
                  onMuscleSelect={(muscleKey, muscleLabel) => {
                    setSelectedMuscle(muscleKey);
                    setSelectedMuscleLabel(muscleLabel);
                    setSelectedGroup(null);
                  }}
                  className="w-full h-[500px] max-h-[500px] min-h-[400px] rounded-xl shadow-lg border border-border/30 bg-background"
                />
              </div>
            </CardContent>
          </Card>

          {/* Muscle Groups Selector - Expandable/Collapsible */}
          <Card className="border-border/50 w-full max-w-md shadow-xl bg-gradient-to-br from-background to-muted/60">
            <CardHeader>
              <CardTitle>Muscle Groups</CardTitle>
              <CardDescription>Expand a group to see muscles</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.keys(groupToMuscles).map((group) => (
                  <div key={group} className="mb-2">
                    <button
                      className={`flex items-center justify-between w-full px-4 py-2 rounded-lg font-semibold text-lg transition-all duration-200 shadow-sm border border-border/30 bg-card/80 hover:bg-accent/30 focus:outline-none ${expandedGroup === group ? "bg-accent/40 text-accent-foreground" : ""}`}
                      onClick={() => setExpandedGroup(expandedGroup === group ? null : group)}
                      aria-expanded={expandedGroup === group}
                    >
                      <span className="capitalize">{group}</span>
                      <span className={`ml-2 transition-transform ${expandedGroup === group ? "rotate-90" : "rotate-0"}`}>▶</span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-300 ${expandedGroup === group ? "max-h-96 opacity-100 py-2" : "max-h-0 opacity-0 py-0"}`}
                    >
                      <div className="pl-4 space-y-1">
                        {group === "Chest" && (
                          <button
                            className={`block w-full text-left px-2 py-1 rounded capitalize font-medium ${
                              (selectedMuscle === "chest_upper_left" || selectedMuscle === "chest_upper_right")
                                ? "bg-primary text-white" : "hover:bg-muted"
                            }`}
                            onClick={() => {
                              setSelectedMuscle("chest_upper_left");
                              setSelectedMuscleLabel("Upper Chest");
                              setSelectedGroup(null);
                              if (threeSceneRef.current) threeSceneRef.current.rotateTo("front");
                            }}
                          >
                            Upper Chest
                          </button>
                        )}
                        {groupToMuscles[group]
                          .filter((muscleKey) => group !== "Chest" || (muscleKey !== "chest_upper_left" && muscleKey !== "chest_upper_right"))
                          .map((muscleKey) => (
                            <button
                              key={muscleKey}
                              className={`block w-full text-left px-2 py-1 rounded capitalize font-medium ${selectedMuscle === muscleKey ? "bg-primary text-white" : "hover:bg-muted"}`}
                              onClick={() => {
                                setSelectedMuscle(muscleKey);
                                setSelectedMuscleLabel(getMuscleLabel(muscleKey));
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
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Exercises Panel - Slide-in on selection */}
          <div className={`fixed top-0 right-0 h-full w-full max-w-lg z-50 bg-background/95 shadow-2xl border-l border-border/40 transform transition-transform duration-500 ${selectedMuscle ? "translate-x-0" : "translate-x-full"}`}>
            <div className="p-6 h-full flex flex-col">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold capitalize">
                  {selectedMuscleLabel || getMuscleLabel(selectedMuscle)} Exercises
                </h2>
                <button
                  className="ml-2 p-2 rounded-full hover:bg-muted transition-colors"
                  onClick={() => setSelectedMuscle(null)}
                  aria-label="Close exercises panel"
                >
                  ✕
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {exercises.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No exercises found for this muscle group yet.
                  </p>
                ) : (
                  <div className="grid md:grid-cols-1 gap-4">
                    {exercises.map((exercise) => (
                      <Card key={exercise.id} className="border-border/30 hover:border-primary/50 transition-colors bg-card/90">
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
              </div>
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default MuscleSelector;