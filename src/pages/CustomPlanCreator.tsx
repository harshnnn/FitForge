import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { Plus, X, Save, Dumbbell, Calendar, Target, Zap } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

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
  const [planName, setPlanName] = useState("");
  const [planDescription, setPlanDescription] = useState("");
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [planExercises, setPlanExercises] = useState<PlanExercise[]>([]);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOfWeek>("monday");
  const [sets, setSets] = useState(3);
  const [reps, setReps] = useState("8-12");
  const [notes, setNotes] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showExerciseDialog, setShowExerciseDialog] = useState(false);

  useEffect(() => {
    loadExercises();
  }, []);

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

      // Create the custom plan
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

      // Add exercises to the plan
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

  const groupedExercises = exercises.reduce((acc, exercise) => {
    const group = exercise.muscle_group;
    if (!acc[group]) acc[group] = [];
    acc[group].push(exercise);
    return acc;
  }, {} as Record<string, Exercise[]>);

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-accent rounded-full shadow-glow-accent">
              <Plus className="w-8 h-8 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Create Custom Workout Plan
          </h1>
          <p className="text-muted-foreground">
            Design your perfect workout routine with exercises tailored to your goals
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Plan Configuration */}
          <div className="lg:col-span-1 space-y-6">
            <Card className="border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="w-5 h-5" />
                  Plan Details
                </CardTitle>
                <CardDescription>
                  Give your workout plan a name and description
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="plan-name">Plan Name *</Label>
                  <Input
                    id="plan-name"
                    placeholder="e.g., Upper/Lower Split"
                    value={planName}
                    onChange={(e) => setPlanName(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="plan-description">Description</Label>
                  <Textarea
                    id="plan-description"
                    placeholder="Describe your workout plan..."
                    value={planDescription}
                    onChange={(e) => setPlanDescription(e.target.value)}
                    className="mt-1 min-h-[100px]"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Add Exercise Button */}
            <Card className="border-border/50 shadow-xl">
              <CardContent className="pt-6">
                <Dialog open={showExerciseDialog} onOpenChange={setShowExerciseDialog}>
                  <DialogTrigger asChild>
                    <Button className="w-full bg-gradient-accent hover:opacity-90">
                      <Plus className="w-4 h-4 mr-2" />
                      Add Exercise
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                      <DialogTitle>Add Exercise to Plan</DialogTitle>
                      <DialogDescription>
                        Select an exercise and configure its sets, reps, and day
                      </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-6">
                      {/* Exercise Selection */}
                      <div>
                        <Label className="text-base font-semibold mb-3 block">Select Exercise</Label>
                        <Tabs defaultValue={Object.keys(groupedExercises)[0]} className="w-full">
                          <TabsList className="grid w-full grid-cols-4">
                            {Object.keys(groupedExercises).map((group) => (
                              <TabsTrigger key={group} value={group} className="capitalize">
                                {group}
                              </TabsTrigger>
                            ))}
                          </TabsList>
                          {Object.entries(groupedExercises).map(([group, groupExercises]) => (
                            <TabsContent key={group} value={group} className="mt-4">
                              <div className="grid grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                {groupExercises.map((exercise) => (
                                  <Button
                                    key={exercise.id}
                                    variant={selectedExercise?.id === exercise.id ? "default" : "outline"}
                                    className="h-auto p-3 text-left justify-start"
                                    onClick={() => setSelectedExercise(exercise)}
                                  >
                                    <div>
                                      <div className="font-semibold">{exercise.name}</div>
                                      <div className="text-xs text-muted-foreground mt-1">
                                        {exercise.description?.slice(0, 50)}...
                                      </div>
                                    </div>
                                  </Button>
                                ))}
                              </div>
                            </TabsContent>
                          ))}
                        </Tabs>
                      </div>

                      {/* Configuration */}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="day-select">Day of Week</Label>
                          <Select value={selectedDay} onValueChange={(value: DayOfWeek) => setSelectedDay(value)}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {DAYS_OF_WEEK.map((day) => (
                                <SelectItem key={day.value} value={day.value}>
                                  {day.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label htmlFor="sets">Sets</Label>
                          <Input
                            id="sets"
                            type="number"
                            min="1"
                            max="10"
                            value={sets}
                            onChange={(e) => setSets(parseInt(e.target.value) || 1)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="reps">Reps</Label>
                          <Input
                            id="reps"
                            placeholder="e.g., 8-12, 10, 3x8-12"
                            value={reps}
                            onChange={(e) => setReps(e.target.value)}
                          />
                        </div>
                        <div className="col-span-2">
                          <Label htmlFor="notes">Notes (Optional)</Label>
                          <Textarea
                            id="notes"
                            placeholder="Any special instructions..."
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            className="min-h-[60px]"
                          />
                        </div>
                      </div>

                      <div className="flex justify-end gap-3">
                        <Button variant="outline" onClick={() => setShowExerciseDialog(false)}>
                          Cancel
                        </Button>
                        <Button
                          onClick={addExerciseToPlan}
                          disabled={!selectedExercise}
                          className="bg-gradient-accent hover:opacity-90"
                        >
                          Add to Plan
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </div>

          {/* Weekly Plan View */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Weekly Workout Plan
                </CardTitle>
                <CardDescription>
                  {planExercises.length} exercise{planExercises.length !== 1 ? 's' : ''} added
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {DAYS_OF_WEEK.map((day) => {
                    const dayExercises = getExercisesForDay(day.value);
                    return (
                      <div key={day.value} className="border rounded-lg p-4">
                        <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                          <Calendar className="w-4 h-4" />
                          {day.label}
                          <Badge variant="secondary" className="ml-auto">
                            {dayExercises.length} exercise{dayExercises.length !== 1 ? 's' : ''}
                          </Badge>
                        </h3>

                        {dayExercises.length === 0 ? (
                          <p className="text-muted-foreground text-sm italic">No exercises scheduled</p>
                        ) : (
                          <div className="space-y-3">
                            {dayExercises.map((planEx) => (
                              <div key={planEx.id} className="flex items-center justify-between bg-muted/50 rounded-lg p-3">
                                <div className="flex items-center gap-3">
                                  <img
                                    src={planEx.exercise.image_url || "/placeholder-exercise.jpg"}
                                    alt={planEx.exercise.name}
                                    className="w-10 h-10 rounded object-cover"
                                  />
                                  <div>
                                    <div className="font-medium">{planEx.exercise.name}</div>
                                    <div className="text-sm text-muted-foreground">
                                      {planEx.sets} sets × {planEx.reps} reps
                                      {planEx.notes && ` • ${planEx.notes}`}
                                    </div>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeExerciseFromPlan(planEx.id)}
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Save Plan Button */}
                <div className="mt-8 pt-6 border-t">
                  <Button
                    onClick={savePlan}
                    disabled={isLoading || !planName.trim() || planExercises.length === 0}
                    className="w-full bg-gradient-primary hover:opacity-90 text-lg py-3"
                    size="lg"
                  >
                    <Save className="w-5 h-5 mr-2" />
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