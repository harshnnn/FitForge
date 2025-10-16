import React, { useState, lazy, Suspense, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Zap, Menu, Plus, Calendar } from "lucide-react";
import { useMuscleData } from "../hooks/useMuscleData";
import { useUserGender } from "../hooks/useUserGender";
import { useExercises } from "../hooks/useExercises";
import { useAuth } from "../hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ThreeScene from "@/components/ThreeScene"; // Import the ThreeScene component
import { toast } from "sonner";

// Types
interface CustomPlan {
  id: string;
  name: string;
  description: string | null;
  user_id: string;
  created_at: string;
  updated_at: string;
}

interface Exercise {
  id: string;
  name: string;
  description: string | null;
  muscle_group: string;
  image_url: string | null;
  video_url: string | null;
}

const MuscleSelector = () => {
  const navigate = useNavigate();
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
  const [mobileGroupsOpen, setMobileGroupsOpen] = useState(false);
  const threeSceneRef = useRef<any>(null);
  const exercises = useExercises(selectedMuscle);

  // Modal and form state
  const [isAddToPlanModalOpen, setIsAddToPlanModalOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string>("");
  const [sets, setSets] = useState<number>(3);
  const [reps, setReps] = useState<string>("8-12");
  const [dayOfWeek, setDayOfWeek] = useState<string>("monday");
  const [notes, setNotes] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCreatingPlan, setIsCreatingPlan] = useState(false);
  const [newPlanName, setNewPlanName] = useState<string>("");
  const [newPlanDescription, setNewPlanDescription] = useState<string>("");

  const { isAuthenticated } = useAuth();

  // Fetch custom plans when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const fetchCustomPlans = async () => {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const { data, error } = await supabase
            .from("user_custom_plans")
            .select("*")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });

          if (error) throw error;
          setCustomPlans(data || []);
        } catch (error) {
          console.error("Error fetching custom plans:", error);
        }
      };
      fetchCustomPlans();
    } else {
      setCustomPlans([]);
    }
  }, [isAuthenticated]);

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

  // Handle adding exercise to custom plan
  const handleAddToPlan = (exercise: Exercise) => {
    if (!isAuthenticated) {
      toast.error("Please log in to add exercises to custom plans.");
      return;
    }
    setSelectedExercise(exercise);
    setIsAddToPlanModalOpen(true);
  };

  // Handle creating a new plan
  const handleCreateNewPlan = async () => {
    if (!newPlanName.trim()) return;

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: newPlan, error } = await supabase
        .from("user_custom_plans")
        .insert({
          name: newPlanName.trim(),
          description: newPlanDescription.trim() || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (error) throw error;

      // Add the new plan to the list
      setCustomPlans(prev => [newPlan, ...prev]);
      setSelectedPlanId(newPlan.id);
      setIsCreatingPlan(false);
      setNewPlanName("");
      setNewPlanDescription("");

      toast.success(`Plan "${newPlan.name}" created successfully!`);
    } catch (error) {
      console.error("Error creating new plan:", error);
      toast.error("Failed to create plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding exercise to selected plan
  const handleAddExerciseToPlan = async () => {
    if (!selectedExercise || !selectedPlanId) return;

    setIsLoading(true);
    try {
      const { error } = await supabase
        .from("user_custom_plan_exercises")
        .insert({
          user_custom_plan_id: selectedPlanId,
          exercise_id: selectedExercise.id,
          day_of_week: dayOfWeek as any,
          sets: sets,
          reps: reps,
          notes: notes.trim() || null,
        });

      if (error) throw error;

      // Reset form and close modal
      setIsAddToPlanModalOpen(false);
      setSelectedExercise(null);
      setSelectedPlanId("");
      setSets(3);
      setReps("8-12");
      setDayOfWeek("monday");
      setNotes("");
      setIsCreatingPlan(false);
      setNewPlanName("");
      setNewPlanDescription("");

      toast.success(`"${selectedExercise.name}" added to your plan!`);
    } catch (error) {
      console.error("Error adding exercise to plan:", error);
      toast.error("Failed to add exercise to plan. Please try again.");
    } finally {
      setIsLoading(false);
    }
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

        <div className="relative flex flex-col lg:flex-row gap-8 mb-8">
          {/* Mobile Muscle Groups Drawer Button */}
          {/* <button
            className="lg:hidden fixed top-6 left-4 z-50 p-3 rounded-full bg-accent text-accent-foreground shadow-lg focus:outline-none focus:ring-2 focus:ring-accent/50"
            onClick={() => setMobileGroupsOpen(true)}
            aria-label="Open muscle groups"
            style={{ boxShadow: "0 2px 16px 0 rgba(0,0,0,0.12)" }}
          >
            <Menu className="w-6 h-6" />
          </button> */}

          {/* Muscle Groups Panel (Drawer on mobile, card on desktop) */}
          <div>
            {/* Overlay for mobile drawer */}
            {mobileGroupsOpen && (
              <div
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm transition-opacity lg:hidden"
                onClick={() => setMobileGroupsOpen(false)}
                aria-label="Close muscle groups overlay"
              />
            )}
            <Card
              className={`border-border/50 w-full max-w-xs shadow-xl bg-gradient-to-br from-background to-muted/60 transition-transform duration-300 z-50
                fixed top-0 left-0 h-full overflow-y-auto lg:static lg:translate-x-0
                ${mobileGroupsOpen ? "translate-x-0" : "-translate-x-full"} lg:block`}
              style={{ minWidth: "240px" }}
            >
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Muscle Groups</CardTitle>
                  <CardDescription>Expand a group to see muscles</CardDescription>
                </div>
                {/* Close button for mobile */}
                <button
                  className="lg:hidden ml-2 p-2 rounded-full hover:bg-muted transition-colors"
                  onClick={() => setMobileGroupsOpen(false)}
                  aria-label="Close muscle groups"
                >
                  ✕
                </button>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.keys(groupToMuscles).map((group) => (
                    <div key={group} className="mb-2">
                      <button
                        className={`flex items-center justify-between w-full px-4 py-2 rounded-lg font-semibold text-lg transition-all duration-200 shadow-sm border border-border/30 bg-card/80 hover:bg-accent/30 focus:outline-none ${expandedGroup === group ? "bg-accent/40 text-accent-foreground" : ""}`}
                        onClick={() => {
                          if (expandedGroup === group) {
                            setExpandedGroup(null);
                            setSelectedGroup(null);
                          } else {
                            setExpandedGroup(group);
                            setSelectedGroup(group); // Select all muscles in this group in the 3D model
                            setSelectedMuscle(null);
                            setSelectedMuscleLabel(null);
                          }
                        }}
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
          </div>

          {/* 3D Model Card (always visible, fills space) */}
          <Card className="border-border/50 h-[600px] flex-1 shadow-2xl bg-gradient-to-br from-background to-muted/60 rounded-2xl overflow-hidden flex flex-col relative">
            <CardHeader className="pb-2 border-b border-border/20 bg-gradient-to-r from-accent/10 to-transparent flex flex-row items-center justify-between relative">
              <div>
                <CardTitle className="text-2xl font-bold tracking-tight">3D Model</CardTitle>
                <CardDescription className="text-base">Select a muscle on the model</CardDescription>
              </div>
              {/* Mobile Muscle Groups Drawer Button - floating, glassy, and visually integrated */}
              <button
                className="lg:hidden absolute top-4 right-4 z-30 p-3 rounded-full bg-white/70 backdrop-blur-md text-accent-foreground shadow-xl border border-border/30 hover:bg-accent/90 hover:text-white transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-accent/50"
                onClick={() => setMobileGroupsOpen(true)}
                aria-label="Open muscle groups"
                style={{ boxShadow: "0 4px 24px 0 rgba(0,0,0,0.14)" }}
              >
                <Menu className="w-6 h-6" />
              </button>
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
                    {exercises
                      .slice() // copy array
                      .sort((a, b) => b.rating - a.rating) // sort by rating descending
                      .map((exercise) => (
                        <Card key={exercise.id} className="border-border/30 hover:border-primary/50 transition-colors bg-card/90">
                          <CardHeader className="flex flex-row items-center gap-4">
                            <img
                              src={exercise.image_url}
                              alt={exercise.name}
                              className="w-16 h-16 object-cover rounded-lg border border-border/20 shadow"
                              loading="lazy"
                            />
                            <div className="flex-1">
                              <CardTitle className="text-lg flex items-center gap-2">
                                {exercise.name}
                                <span className="flex items-center ml-2">
                                  {Array.from({ length: 5 }).map((_, i) => (
                                    <svg
                                      key={i}
                                      className={`w-4 h-4 ${i < exercise.rating ? 'text-yellow-400' : 'text-muted-foreground/30'}`}
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.967a1 1 0 00.95.69h4.175c.969 0 1.371 1.24.588 1.81l-3.38 2.455a1 1 0 00-.364 1.118l1.287 3.966c.3.922-.755 1.688-1.54 1.118l-3.38-2.454a1 1 0 00-1.175 0l-3.38 2.454c-.784.57-1.838-.196-1.54-1.118l1.287-3.966a1 1 0 00-.364-1.118L2.05 9.394c-.783-.57-.38-1.81.588-1.81h4.175a1 1 0 00.95-.69l1.286-3.967z" />
                                    </svg>
                                  ))}
                                </span>
                              </CardTitle>
                              <CardDescription className="text-xs text-muted-foreground mt-1">
                                {exercise.muscle_group && (
                                  <span className="capitalize font-semibold mr-2 text-accent-foreground/80">
                                    {getMuscleLabel(exercise.muscle_group)}
                                  </span>
                                )}
                              </CardDescription>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm text-muted-foreground mb-3">{exercise.description}</p>
                            <div className="flex gap-2">
                              {exercise.video_url && (
                                <a
                                  href={exercise.video_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
                                >
                                  ▶ Watch Video
                                </a>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleAddToPlan(exercise)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium border-primary/50 text-primary hover:bg-primary hover:text-primary-foreground transition-colors ml-auto"
                              >
                                <Plus className="w-3 h-3" />
                                Add to Plan
                              </Button>
                            </div>
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

      {/* Add to Plan Modal */}
      <Dialog open={isAddToPlanModalOpen} onOpenChange={setIsAddToPlanModalOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Add Exercise to Custom Plan</DialogTitle>
            <DialogDescription>
              Add "{selectedExercise?.name}" to one of your custom workout plans.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Plan Selection */}
            <div className="space-y-2">
              <Label htmlFor="plan-select">Select Plan</Label>
              {customPlans.length > 0 ? (
                <Select value={selectedPlanId} onValueChange={setSelectedPlanId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a plan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {customPlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">No custom plans found. Create one below.</p>
              )}
            </div>

            {/* Create New Plan Toggle */}
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="create-new-plan"
                checked={isCreatingPlan}
                onChange={(e) => setIsCreatingPlan(e.target.checked)}
                className="rounded"
              />
              <Label htmlFor="create-new-plan" className="text-sm">
                Create a new plan instead
              </Label>
            </div>

            {/* New Plan Form */}
            {isCreatingPlan && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/50">
                <div>
                  <Label htmlFor="new-plan-name">Plan Name</Label>
                  <Input
                    id="new-plan-name"
                    value={newPlanName}
                    onChange={(e) => setNewPlanName(e.target.value)}
                    placeholder="e.g., Upper Body Strength"
                  />
                </div>
                <div>
                  <Label htmlFor="new-plan-description">Description (Optional)</Label>
                  <Textarea
                    id="new-plan-description"
                    value={newPlanDescription}
                    onChange={(e) => setNewPlanDescription(e.target.value)}
                    placeholder="Brief description of your plan..."
                    rows={2}
                  />
                </div>
              </div>
            )}

            {/* Exercise Configuration */}
            {!isCreatingPlan && selectedPlanId && (
              <div className="space-y-3 border rounded-lg p-3 bg-muted/50">
                <h4 className="font-medium text-sm">Exercise Configuration</h4>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor="sets">Sets</Label>
                    <Input
                      id="sets"
                      type="number"
                      min="1"
                      max="10"
                      value={sets}
                      onChange={(e) => setSets(parseInt(e.target.value) || 3)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="reps">Reps</Label>
                    <Input
                      id="reps"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      placeholder="8-12"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="day-of-week">Day of Week</Label>
                  <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="monday">Monday</SelectItem>
                      <SelectItem value="tuesday">Tuesday</SelectItem>
                      <SelectItem value="wednesday">Wednesday</SelectItem>
                      <SelectItem value="thursday">Thursday</SelectItem>
                      <SelectItem value="friday">Friday</SelectItem>
                      <SelectItem value="saturday">Saturday</SelectItem>
                      <SelectItem value="sunday">Sunday</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Textarea
                    id="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any specific notes for this exercise..."
                    rows={2}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsAddToPlanModalOpen(false);
                setSelectedExercise(null);
                setSelectedPlanId("");
                setIsCreatingPlan(false);
                setNewPlanName("");
                setNewPlanDescription("");
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={isCreatingPlan ? handleCreateNewPlan : handleAddExerciseToPlan}
              disabled={
                isLoading ||
                (isCreatingPlan ? !newPlanName.trim() : !selectedPlanId)
              }
            >
              {isLoading ? "Loading..." : isCreatingPlan ? "Create Plan" : "Add to Plan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
};

export default MuscleSelector;