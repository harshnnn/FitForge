import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Save, Dumbbell, Calendar, Target, Zap, Menu } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import ThreeScene from "@/components/ThreeScene";
import { useMuscleData } from "@/hooks/useMuscleData";
import { useUserGender } from "@/hooks/useUserGender";
import { useExercises } from "@/hooks/useExercises";

type Exercise = Tables<"exercises">;
type DayOfWeek = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";

interface PlanExercise {
  id: string;
  exercise: Exercise;
  dayOfWeek: DayOfWeek;
  sets: number;
  reps: string;
  notes?: string;
}

const DAYS_OF_WEEK: { value: DayOfWeek; label: string; short: string }[] = [
  { value: "monday", label: "Monday", short: "Mon" },
  { value: "tuesday", label: "Tuesday", short: "Tue" },
  { value: "wednesday", label: "Wednesday", short: "Wed" },
  { value: "thursday", label: "Thursday", short: "Thu" },
  { value: "friday", label: "Friday", short: "Fri" },
  { value: "saturday", label: "Saturday", short: "Sat" },
  { value: "sunday", label: "Sunday", short: "Sun" },
];

const CustomPlanCreator = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const { groupToMuscles, linkedMuscles, meshNameOverrides, prettify } = useMuscleData();
  const gender = useUserGender();
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedMuscleKeys, setSelectedMuscleKeys] = useState<string[] | null>(null);
  const [selectedMuscleBase, setSelectedMuscleBase] = useState<string | null>(null);
  
  const apiQueryKeys = React.useMemo(() => {
    if (!selectedMuscleBase && !selectedMuscleKeys) return null;
    const base = selectedMuscleBase;
    const children = selectedMuscleKeys || (selectedMuscle ? [selectedMuscle] : []);
    const keys: string[] = [];
    if (base) keys.push(base);
    keys.push(...children.filter(Boolean));
    return Array.from(new Set(keys));
  }, [selectedMuscleBase, selectedMuscleKeys, selectedMuscle]);

  const muscleExercises = useExercises(apiQueryKeys);
  const exercisesListRef = useRef<HTMLDivElement | null>(null);
  const configRef = useRef<HTMLDivElement | null>(null);
  const [planExercises, setPlanExercises] = useState<PlanExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("monday");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState("8-12");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);
  const [muscleQuery, setMuscleQuery] = useState("");
  const [exerciseQuery, setExerciseQuery] = useState("");
  const [showMuscleFilters, setShowMuscleFilters] = useState(true);

  useEffect(() => {
    loadExercises();
  }, []);

  const filteredMuscles = (muscleQuery
    ? Object.keys(meshNameOverrides).filter(k => (meshNameOverrides[k]?.label || prettify(k)).toLowerCase().includes(muscleQuery.toLowerCase()))
    : (selectedGroup ? groupToMuscles[selectedGroup] : Object.values(groupToMuscles).flat())
  );

  const filteredExercises = (exerciseQuery
    ? exercises.filter(ex => ex.name.toLowerCase().includes(exerciseQuery.toLowerCase()))
    : muscleExercises
  );

  const displayMuscleGroups = React.useMemo(() => {
    const map: Record<string, string[]> = {};
    const normalize = (label: string) => {
      return label.replace(/\s*\((left|right)\)\s*$/i, '').replace(/\s*[-–—]\s*(left|right)$/i, '').replace(/\s+(left|right)$/i, '').trim();
    };

    for (const key of filteredMuscles) {
      const raw = (meshNameOverrides[key]?.label || prettify(key)) as string;
      const base = normalize(raw);
      if (!map[base]) map[base] = [];
      map[base].push(key);
    }

    return map;
  }, [filteredMuscles, meshNameOverrides, prettify]);

  function normalizeBaseKey(key: string) {
    return key.replace(/_(?:left|right)$/i, '');
  }

  useEffect(() => {
    if (selectedExercise) setShowExerciseDialog(true);
  }, [selectedExercise]);

  useEffect(() => {
    const state = location.state as { preSelectedExercise?: Exercise; fromMuscleSelector?: boolean };
    if (state?.preSelectedExercise && state?.fromMuscleSelector) {
      setSelectedExercise(state.preSelectedExercise);
      setShowExerciseDialog(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  const loadExercises = async () => {
    try {
      const { data, error } = await supabase
        .from("exercises")
        .select("*")
        .order("name");

      if (error) throw error;
      setExercises(data || []);
    } catch (error) {
      console.error("Error loading exercises:", error);
      toast.error("Failed to load exercises");
    }
  };

  const addExerciseToPlan = () => {
    if (!selectedExercise) return;

    const newPlanExercise: PlanExercise = {
      id: `${selectedExercise.id}-${selectedDay}-${Date.now()}`,
      exercise: selectedExercise,
      dayOfWeek: selectedDay,
      sets,
      reps,
      notes: notes.trim() || undefined,
    };

    setPlanExercises(prev => [...prev, newPlanExercise]);
    setSelectedExercise(null);
    setSets(3);
    setReps("8-12");
    setNotes("");
    setShowExerciseDialog(false);
    toast.success("Exercise added to plan!");
  };

  const removeExerciseFromPlan = (exerciseId: string) => {
    setPlanExercises(prev => prev.filter(ex => ex.id !== exerciseId));
    toast.success("Exercise removed from plan");
  };

  const getExercisesForDay = (day: DayOfWeek) => {
    return planExercises.filter(ex => ex.dayOfWeek === day);
  };

  const savePlan = async () => {
    if (!planName.trim()) {
      toast.error("Please enter a plan name");
      return;
    }

    if (planExercises.length === 0) {
      toast.error("Please add at least one exercise to your plan");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { data: plan, error: planError } = await supabase
        .from("user_custom_plans")
        .insert({
          name: planName.trim(),
          description: planDescription.trim() || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (planError) throw planError;

      const exercisesToInsert = planExercises.map(ex => ({
        user_custom_plan_id: plan.id,
        exercise_id: ex.exercise.id,
        day_of_week: ex.dayOfWeek,
        sets: ex.sets,
        reps: ex.reps,
        notes: ex.notes || null,
      }));

      const { error: exercisesError } = await supabase
        .from("user_custom_plan_exercises")
        .insert(exercisesToInsert);

      if (exercisesError) throw exercisesError;

      toast.success("Custom workout plan created successfully!");
      navigate("/workouts");
    } catch (error) {
      console.error("Error saving plan:", error);
      toast.error("Failed to save workout plan");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-6 lg:py-8 max-w-7xl">
        {/* Header - Optimized for mobile */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex justify-center mb-3 sm:mb-4">
            <div className="p-3 sm:p-4 bg-gradient-accent rounded-full shadow-glow-accent">
              <Plus className="w-6 h-6 sm:w-8 sm:h-8 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent px-2">
            Create Custom Workout Plan
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground px-4">
            Design your perfect workout routine
          </p>
        </div>

        <div className="flex flex-col lg:grid lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
          {/* Plan Configuration - Full width on mobile */}
          <div className="w-full lg:col-span-1 space-y-4 sm:space-y-6">
            <Card className="border-border/50 shadow-lg">
              <CardHeader className="pb-3 sm:pb-6">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Target className="w-4 h-4 sm:w-5 sm:h-5" />
                  Plan Details
                </CardTitle>
                <CardDescription className="text-xs sm:text-sm">
                  Give your workout plan a name
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div>
                  <Label htmlFor="plan-name" className="text-sm">Plan Name *</Label>
                  <Input
                    id="plan-name"
                    placeholder="e.g., Upper/Lower Split"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="mt-1.5 h-10 sm:h-11"
                  />
                </div>
                <div>
                  <Label htmlFor="plan-description" className="text-sm">Description</Label>
                  <Textarea
                    id="plan-description"
                    placeholder="Describe your workout plan..."
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    className="mt-1.5 min-h-[80px] sm:min-h-[100px] text-sm"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Exercise Button - Sticky on mobile */}
            <div className="sticky top-16 z-10 lg:static">
              <Card className="border-border/50 shadow-lg">
                <CardContent className="pt-4 sm:pt-6 pb-4">
                  <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
                    <DialogTrigger asChild>
                      <Button className="w-full bg-gradient-accent hover:opacity-90 h-11 sm:h-12 text-sm sm:text-base font-medium">
                        <Plus className="w-4 h-4 mr-2" />
                        Add Exercise
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="w-[calc(100vw-1rem)] max-w-[calc(100vw-1rem)] h-[95vh] sm:w-[95vw] sm:max-w-6xl sm:h-[90vh] overflow-hidden p-0">
                      <div className="flex flex-col h-full overflow-hidden">
                        <DialogHeader className="px-3 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4 border-b shrink-0">
                          <DialogTitle className="text-lg sm:text-xl">Add Exercise to Plan</DialogTitle>
                          <DialogDescription className="text-xs sm:text-sm">
                            Select an exercise and configure its details
                          </DialogDescription>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto custom-scrollbar px-3 sm:px-6 py-3 sm:py-4">
                          <div className="space-y-4 sm:space-y-6">
                            {/* Search Controls - Stacked on mobile */}
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-3">
                              <Label className="text-sm sm:text-base font-semibold">Select Exercise</Label>
                              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                <div className="relative flex-1 sm:flex-initial">
                                  <input
                                    aria-label="Search muscles"
                                    placeholder="Search muscles..."
                                    value={muscleQuery}
                                    onChange={(e) => setMuscleQuery(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 rounded bg-muted/10 text-xs sm:text-sm placeholder:text-muted-foreground border border-border/50 focus:border-primary focus:outline-none"
                                  />
                                  {muscleQuery && (
                                    <button
                                      aria-label="Clear muscle search"
                                      onClick={() => setMuscleQuery("")}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 hover:bg-muted/20 rounded"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>

                                <div className="relative flex-1 sm:flex-initial">
                                  <input
                                    aria-label="Search exercises"
                                    placeholder="Filter exercises..."
                                    value={exerciseQuery}
                                    onChange={(e) => setExerciseQuery(e.target.value)}
                                    className="w-full sm:w-auto px-3 py-2 rounded bg-muted/10 text-xs sm:text-sm placeholder:text-muted-foreground border border-border/50 focus:border-primary focus:outline-none"
                                  />
                                  {exerciseQuery && (
                                    <button
                                      aria-label="Clear exercise search"
                                      onClick={() => setExerciseQuery("")}
                                      className="absolute right-2 top-1/2 -translate-y-1/2 text-xs px-1.5 py-0.5 hover:bg-muted/20 rounded"
                                    >
                                      ✕
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Main Selection Grid - Stacked on mobile, side-by-side on desktop */}
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
                              {/* 3D Model */}
                              <div className="order-1 lg:order-1">
                                <div className="relative h-56 sm:h-64 lg:h-80 bg-gradient-to-b from-muted/5 to-transparent rounded-lg overflow-hidden border border-border/30">
                                  <ThreeScene
                                    gender={gender}
                                    selectedMuscles={
                                      selectedMuscleKeys
                                        ? selectedMuscleKeys.flatMap(k => linkedMuscles[k] ?? [k])
                                        : (selectedMuscle ? (linkedMuscles[selectedMuscle] ?? [selectedMuscle]) : [])
                                    }
                                    onMuscleSelect={(muscleKey: string, muscleLabel: string) => {
                                      const keys = linkedMuscles[muscleKey] ?? [muscleKey];
                                      const groupFound = Object.keys(groupToMuscles).find((g) => (groupToMuscles[g] || []).includes(muscleKey));
                                      if (groupFound) setSelectedGroup(groupFound);
                                      setSelectedMuscleKeys(keys);
                                      setSelectedMuscle(keys[0]);
                                      setSelectedMuscleBase(normalizeBaseKey(keys[0]));
                                      setShowExerciseDialog(true);
                                      setTimeout(() => exercisesListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                                    }}
                                    className="w-full h-full"
                                  />
                                </div>
                              </div>

                              {/* Muscle Selection */}
                              <div className="order-2 lg:order-2">
                                <div className="mb-3 z-20 relative">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="font-medium text-xs sm:text-sm">Filter by Muscle</div>
                                    <button 
                                      className="text-xs text-muted-foreground hover:text-foreground transition-colors" 
                                      onClick={() => setShowMuscleFilters(prev => !prev)}
                                    >
                                      {showMuscleFilters ? 'Hide' : 'Show'}
                                    </button>
                                  </div>
                                  {showMuscleFilters && (
                                    <div className="flex gap-1.5 sm:gap-2 overflow-x-auto pb-2 -mx-1 px-1 custom-scrollbar">
                                      {Object.keys(groupToMuscles).map((group) => (
                                        <button
                                          key={group}
                                          onClick={() => { setSelectedGroup(group); setSelectedMuscle(null); }}
                                          className={`text-xs sm:text-sm px-3 py-1.5 sm:px-4 sm:py-2 rounded-full font-medium whitespace-nowrap transition-all ${selectedGroup === group ? 'bg-primary text-white shadow-md scale-105' : 'bg-muted/20 hover:bg-muted/30'}`}
                                          title={`Show muscles in ${group}`}
                                        >
                                          {group}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <div className="max-h-56 sm:max-h-64 lg:max-h-80 overflow-auto space-y-2 p-2 bg-muted/5 rounded-lg border border-border/30 custom-scrollbar">
                                  {Object.entries(displayMuscleGroups).map(([label, keys]) => (
                                    <button
                                      key={label}
                                      onClick={() => {
                                        const groupFound = Object.keys(groupToMuscles).find((g) => (groupToMuscles[g] || []).includes(keys[0]));
                                        if (groupFound) setSelectedGroup(groupFound);
                                        setSelectedMuscleKeys(keys);
                                        setSelectedMuscle(keys[0]);
                                        setSelectedMuscleBase(normalizeBaseKey(keys[0]));
                                        setTimeout(() => exercisesListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
                                      }}
                                      className={`w-full text-left px-2.5 py-2.5 sm:px-3 sm:py-3 rounded-lg flex items-center gap-2.5 sm:gap-3 transition-all active:scale-98 ${((selectedMuscleKeys && selectedMuscleKeys.length === keys.length && selectedMuscleKeys.every(k => keys.includes(k))) || (selectedMuscle && keys.includes(selectedMuscle))) ? 'bg-primary/10 ring-2 ring-primary shadow-sm' : 'hover:bg-muted/10'}`}
                                    >
                                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-muted/30 rounded-md flex items-center justify-center text-xs sm:text-sm font-semibold shrink-0">
                                        {((meshNameOverrides[keys[0]]?.label || label)[0] || 'M').toUpperCase()}
                                      </div>
                                      <div className="truncate text-xs sm:text-sm font-medium">{label}</div>
                                    </button>
                                  ))}
                                </div>
                              </div>

                              {/* Exercise List */}
                              <div className="order-3 lg:order-3">
                                <div className="text-xs sm:text-sm font-medium mb-2">Available Exercises</div>
                                <div ref={exercisesListRef} className="space-y-2 max-h-56 sm:max-h-64 lg:max-h-80 overflow-auto custom-scrollbar p-2 bg-muted/5 rounded-lg border border-border/30">
                                  {filteredExercises.length === 0 ? (
                                    <div className="text-xs sm:text-sm text-muted-foreground text-center py-8">No exercises found</div>
                                  ) : (
                                    filteredExercises.map((ex) => (
                                      <div key={ex.id} className="flex items-center gap-2.5 sm:gap-3 bg-card/60 p-2.5 sm:p-3 rounded-lg border border-border/30 hover:border-border/60 transition-all">
                                        <img 
                                          src={ex.image_url || '/placeholder-exercise.jpg'} 
                                          alt={ex.name} 
                                          className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover shrink-0" 
                                        />
                                        <div className="flex-1 min-w-0">
                                          <div className="font-medium text-xs sm:text-sm truncate">{ex.name}</div>
                                          <div className="text-[10px] sm:text-xs text-muted-foreground truncate">
                                            {ex.muscle_group ? prettify(ex.muscle_group) : 'General'}
                                          </div>
                                        </div>
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            setSelectedExercise(ex as Exercise);
                                            setShowExerciseDialog(true);
                                            setTimeout(() => configRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
                                          }}
                                          className="px-2 py-1.5 sm:px-3 sm:py-2 text-xs shrink-0 h-auto"
                                        >
                                          {selectedExercise?.id === ex.id ? 'Selected' : 'Select'}
                                        </Button>
                                      </div>
                                    ))
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Selected Exercise Summary & Configuration */}
                            <div className="space-y-3 sm:space-y-4 border-t pt-4">
                              <div className="flex items-center gap-3 bg-muted/10 p-3 rounded-lg border border-border/30">
                                {selectedExercise ? (
                                  <>
                                    <img 
                                      src={selectedExercise.image_url || '/placeholder-exercise.jpg'} 
                                      alt={selectedExercise.name} 
                                      className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover shrink-0" 
                                    />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-semibold text-sm sm:text-base truncate">{selectedExercise.name}</div>
                                      <div className="text-xs sm:text-sm text-muted-foreground truncate">
                                        {selectedExercise.muscle_group ? prettify(selectedExercise.muscle_group) : 'General'}
                                      </div>
                                    </div>
                                    <div className="text-xs text-muted-foreground shrink-0">
                                      <span className="hidden sm:inline">Day: </span>
                                      <span className="font-medium">{DAYS_OF_WEEK.find(d => d.value === selectedDay)?.short}</span>
                                    </div>
                                  </>
                                ) : (
                                  <div className="text-xs sm:text-sm text-muted-foreground text-center w-full py-2">
                                    Select an exercise to configure
                                  </div>
                                )}
                              </div>

                              <div ref={configRef} className="grid grid-cols-2 gap-3 sm:gap-4">
                                <div>
                                  <Label htmlFor="day-select" className="text-xs sm:text-sm mb-1.5 block">Day of Week</Label>
                                  <Select value={selectedDay} onValueChange={(value: DayOfWeek) => setSelectedDay(value)}>
                                    <SelectTrigger className="h-9 sm:h-10 text-xs sm:text-sm">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {DAYS_OF_WEEK.map((day) => (
                                        <SelectItem key={day.value} value={day.value} className="text-xs sm:text-sm">
                                          {day.label}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div>
                                  <Label htmlFor="sets" className="text-xs sm:text-sm mb-1.5 block">Sets</Label>
                                  <Input
                                    id="sets"
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={sets}
                                    onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                                    className="h-9 sm:h-10 text-xs sm:text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label htmlFor="reps" className="text-xs sm:text-sm mb-1.5 block">Reps</Label>
                                  <Input
                                    id="reps"
                                    placeholder="e.g., 8-12, 10, 3x8-12"
                                    value={reps}
                                    onChange={(e) => setReps(e.target.value)}
                                    className="h-9 sm:h-10 text-xs sm:text-sm"
                                  />
                                </div>
                                <div className="col-span-2">
                                  <Label htmlFor="notes" className="text-xs sm:text-sm mb-1.5 block">Notes (Optional)</Label>
                                  <Textarea
                                    id="notes"
                                    placeholder="Any special instructions..."
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="min-h-[60px] text-xs sm:text-sm"
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Fixed Bottom Actions */}
                        <div className="shrink-0 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 py-3 sm:px-6 sm:py-4">
                          <div className="flex justify-end gap-2 sm:gap-3">
                            <Button 
                              variant="outline" 
                              onClick={() => setShowExerciseDialog(false)} 
                              className="px-3 py-2 h-9 sm:h-10 text-xs sm:text-sm"
                            >
                              Cancel
                            </Button>
                            <Button
                              onClick={addExerciseToPlan}
                              disabled={!selectedExercise}
                              className="bg-gradient-accent hover:opacity-90 px-4 py-2 h-9 sm:h-10 text-xs sm:text-sm font-medium"
                            >
                              Add to Plan
                            </Button>
                          </div>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Weekly Plan View - Full width on mobile */}
          <div className="w-full lg:col-span-2">
            <Card className="border-border/50 shadow-lg">
              <CardHeader className="pb-3 sm:pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                    <Calendar className="w-4 h-4 sm:w-5 sm:h-5" />
                    Weekly Workout Plan
                  </CardTitle>
                  <Badge variant="secondary" className="w-fit text-xs">
                    {planExercises.length} exercise{planExercises.length !== 1 ? 's' : ''}
                  </Badge>
                </div>
                <CardDescription className="text-xs sm:text-sm mt-1">
                  Organize your exercises throughout the week
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                {DAYS_OF_WEEK.map((day) => {
                  const dayExercises = getExercisesForDay(day.value);
                  return (
                    <div key={day.value} className="border rounded-lg p-3 sm:p-4 bg-muted/5 hover:bg-muted/10 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-sm sm:text-base flex items-center gap-2">
                          <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                          <span className="hidden sm:inline">{day.label}</span>
                          <span className="sm:hidden">{day.short}</span>
                        </h3>
                        <Badge variant="secondary" className="text-[10px] sm:text-xs px-2 py-0.5">
                          {dayExercises.length}
                        </Badge>
                      </div>

                      {dayExercises.length === 0 ? (
                        <p className="text-muted-foreground text-xs sm:text-sm italic text-center py-4 bg-muted/5 rounded border border-dashed border-border/50">
                          No exercises scheduled
                        </p>
                      ) : (
                        <div className="space-y-2 sm:space-y-3">
                          {dayExercises.map((planEx) => (
                            <div 
                              key={planEx.id} 
                              className="flex items-center gap-2.5 sm:gap-3 bg-card/60 rounded-lg p-2.5 sm:p-3 border border-border/30 hover:border-border/60 hover:shadow-sm transition-all"
                            >
                              <img
                                src={planEx.exercise.image_url || "/placeholder-exercise.jpg"}
                                alt={planEx.exercise.name}
                                className="w-12 h-12 sm:w-14 sm:h-14 rounded-md object-cover shrink-0"
                              />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-xs sm:text-sm truncate mb-0.5">
                                  {planEx.exercise.name}
                                </div>
                                <div className="text-[10px] sm:text-xs text-muted-foreground">
                                  <span className="font-medium">{planEx.sets} sets</span>
                                  <span className="mx-1">×</span>
                                  <span className="font-medium">{planEx.reps} reps</span>
                                  {planEx.notes && (
                                    <>
                                      <span className="mx-1 hidden sm:inline">•</span>
                                      <span className="block sm:inline mt-0.5 sm:mt-0 truncate">{planEx.notes}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => removeExerciseFromPlan(planEx.id)}
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 sm:h-9 sm:w-9 p-0 shrink-0"
                                aria-label="Remove exercise"
                              >
                                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Save Plan Button - Sticky on mobile */}
                <div className="sticky bottom-0 sm:static mt-6 pt-4 sm:pt-6 border-t bg-background/95 sm:bg-transparent backdrop-blur sm:backdrop-blur-none -mx-3 sm:mx-0 px-3 sm:px-0 pb-3 sm:pb-0">
                  <Button
                    onClick={savePlan}
                    disabled={isLoading || !planName.trim() || planExercises.length === 0}
                    className="w-full bg-gradient-primary hover:opacity-90 h-11 sm:h-12 text-sm sm:text-base font-semibold shadow-lg hover:shadow-xl transition-all"
                    size="lg"
                  >
                    <Save className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                    {isLoading ? "Saving Plan..." : "Save Workout Plan"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default CustomPlanCreator;