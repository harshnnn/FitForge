import React, { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Target, TrendingUp, Save, CheckCircle, Dumbbell, Clock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

// Types
interface WorkoutPlan {
  id: string;
  name: string;
  days_per_week: number;
  goal: string;
  description: string;
}

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

interface PlanExercise {
  id: string;
  workout_plan_id: string;
  exercise_id: string;
  sets: number;
  reps: string;
  day_number: number;
  exercise: Exercise;
}

interface CustomPlanExercise {
  id: string;
  user_custom_plan_id: string;
  exercise_id: string;
  day_of_week: string;
  sets: number;
  reps: string;
  notes: string | null;
  exercise: Exercise;
}

interface ProgressEntry {
  exercise_id: string;
  planned_sets: number;
  planned_reps: string;
  actual_sets: number;
  weight_used: number | null;
  weight_unit: 'kg' | 'lbs';
  reps_completed: number[];
  notes: string;
}

const ProgressLogger = () => {
  const { isAuthenticated } = useAuth();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [selectedPlanType, setSelectedPlanType] = useState<'standard' | 'custom' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | CustomPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [planExercises, setPlanExercises] = useState<(PlanExercise | CustomPlanExercise)[]>([]);
  const [progressEntries, setProgressEntries] = useState<Record<string, ProgressEntry>>({});
  const [sessionNotes, setSessionNotes] = useState<string>("");
  const [workoutDate, setWorkoutDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  const DAYS_OF_WEEK = [
    { value: "monday", label: "Monday" },
    { value: "tuesday", label: "Tuesday" },
    { value: "wednesday", label: "Wednesday" },
    { value: "thursday", label: "Thursday" },
    { value: "friday", label: "Friday" },
    { value: "saturday", label: "Saturday" },
    { value: "sunday", label: "Sunday" },
  ];

  // Load plans on component mount
  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
      try {
        // Load standard plans
        const { data: standardPlans, error: standardError } = await supabase
          .from("workout_plans")
          .select("*")
          .order("name");

        if (standardError) throw standardError;

        // Load custom plans if authenticated
        let customPlansData: CustomPlan[] = [];
        if (isAuthenticated) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: customData, error: customError } = await supabase
              .from("user_custom_plans")
              .select("*")
              .eq("user_id", user.id)
              .order("name");

            if (customError) throw customError;
            customPlansData = customData || [];
          }
        }

        setWorkoutPlans(standardPlans || []);
        setCustomPlans(customPlansData);
      } catch (error) {
        console.error("Error loading plans:", error);
        toast.error("Failed to load workout plans");
      }
      setLoading(false);
    };

    loadPlans();
  }, [isAuthenticated]);

  // Load sessions when user opens History tab
  useEffect(() => {
    const loadSessions = async () => {
      if (!isAuthenticated || activeTab !== 'history') return;
      setLoadingSessions(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setSessions([]);
          setLoadingSessions(false);
          return;
        }

        // Fetch sessions with their entries
        const { data, error } = await supabase
          .from('workout_progress_sessions')
          .select('*, workout_progress_entries(*)')
          .eq('user_id', user.id)
          .order('workout_date', { ascending: false });

        if (error) throw error;
        const sessionsData = data || [];

        // Collect plan ids by type so we can fetch their names in batch
        const customPlanIds = Array.from(new Set(sessionsData.filter((s: any) => s.plan_type === 'custom').map((s: any) => s.plan_id)));
        const standardPlanIds = Array.from(new Set(sessionsData.filter((s: any) => s.plan_type === 'standard').map((s: any) => s.plan_id)));

        const planNameMap: Record<string, string> = {};

        if (standardPlanIds.length > 0) {
          const { data: stdPlans } = await supabase
            .from('workout_plans')
            .select('id, name')
            .in('id', standardPlanIds);

          (stdPlans || []).forEach((p: any) => {
            planNameMap[p.id] = p.name;
          });
        }

        if (customPlanIds.length > 0) {
          const { data: custPlans } = await supabase
            .from('user_custom_plans')
            .select('id, name')
            .in('id', customPlanIds);

          (custPlans || []).forEach((p: any) => {
            planNameMap[p.id] = p.name;
          });
        }

        // Attach a friendly plan_name to each session for display
        const mapped = sessionsData.map((s: any) => ({
          ...s,
          plan_name: planNameMap[s.plan_id] || (s.plan_type === 'custom' ? 'Custom Plan' : 'Standard Plan'),
        }));

        setSessions(mapped);
      } catch (err) {
        console.error('Error loading progress sessions:', err);
        toast.error('Failed to load progress');
      }
      setLoadingSessions(false);
    };

    loadSessions();
  }, [isAuthenticated, activeTab]);

  // Load exercises when plan and day are selected
  useEffect(() => {
    const loadExercises = async () => {
      if (!selectedPlan || !selectedDay) {
        setPlanExercises([]);
        return;
      }

      setLoading(true);
      try {
        let exercisesData: (PlanExercise | CustomPlanExercise)[] = [];

        if (selectedPlanType === 'standard') {
          const dayNumber = parseInt(selectedDay.replace('day_', ''));
          const { data, error } = await supabase
            .from("workout_plan_exercises")
            .select("*, exercise:exercises(*)")
            .eq("workout_plan_id", selectedPlan.id)
            .eq("day_number", dayNumber)
            .order("id");

          if (error) throw error;
          exercisesData = data || [];
        } else if (selectedPlanType === 'custom') {
          const { data, error } = await supabase
            .from("user_custom_plan_exercises")
            .select("*, exercise:exercises(*)")
            .eq("user_custom_plan_id", selectedPlan.id)
            .eq("day_of_week", selectedDay)
            .order("id");

          if (error) throw error;
          exercisesData = data || [];
        }

        setPlanExercises(exercisesData);

        // Initialize progress entries
        const initialEntries: Record<string, ProgressEntry> = {};
        exercisesData.forEach((exercise: any) => {
          initialEntries[exercise.exercise_id] = {
            exercise_id: exercise.exercise_id,
            planned_sets: exercise.sets,
            planned_reps: exercise.reps,
            actual_sets: 0,
            weight_used: null,
            weight_unit: 'kg',
            reps_completed: [],
            notes: "",
          };
        });
        setProgressEntries(initialEntries);
      } catch (error) {
        console.error("Error loading exercises:", error);
        toast.error("Failed to load exercises");
      }
      setLoading(false);
    };

    loadExercises();
  }, [selectedPlan, selectedDay, selectedPlanType]);

  // Get available days for selected plan
  const availableDays = useMemo(() => {
    if (!selectedPlan || !selectedPlanType) return [];

    if (selectedPlanType === 'standard') {
      const plan = selectedPlan as WorkoutPlan;
      return Array.from({ length: plan.days_per_week }, (_, i) => ({
        value: `day_${i + 1}`,
        label: `Day ${i + 1}`,
      }));
    } else {
      // For custom plans, we need to check which days have exercises
      // This would require a separate query, but for now we'll show all days
      return DAYS_OF_WEEK;
    }
  }, [selectedPlan, selectedPlanType]);

  const handlePlanSelect = (planType: 'standard' | 'custom', plan: WorkoutPlan | CustomPlan) => {
    setSelectedPlanType(planType);
    setSelectedPlan(plan);
    setSelectedDay("");
    setPlanExercises([]);
    setProgressEntries({});
  };

  const updateProgressEntry = (exerciseId: string, field: keyof ProgressEntry, value: any) => {
    setProgressEntries(prev => ({
      ...prev,
      [exerciseId]: {
        ...prev[exerciseId],
        [field]: value,
      },
    }));
  };

  const handleSaveProgress = async () => {
    if (!selectedPlan || !selectedDay || !selectedPlanType) {
      toast.error("Please select a plan and day first");
      return;
    }

    // Check if at least one exercise has been logged
    const hasProgress = Object.values(progressEntries).some(entry =>
      entry.actual_sets > 0 || entry.weight_used !== null || entry.reps_completed.length > 0
    );

    if (!hasProgress) {
      toast.error("Please log progress for at least one exercise");
      return;
    }

    setSaving(true);
    try {
      // Ensure we have the current authenticated user from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        throw new Error("User not authenticated");
      }

      // Create progress session
      const { data: session, error: sessionError } = await supabase
        .from("workout_progress_sessions")
        .insert({
          user_id: user.id,
          plan_type: selectedPlanType,
          plan_id: selectedPlan.id,
          day_identifier: selectedDay,
          workout_date: workoutDate,
          notes: sessionNotes.trim() || null,
        })
        .select()
        .single();

      if (sessionError) throw sessionError;

      // Create progress entries
      const entriesToInsert = Object.values(progressEntries)
        .filter(entry => entry.actual_sets > 0 || entry.weight_used !== null || entry.reps_completed.length > 0)
        .map(entry => ({
          session_id: session.id,
          exercise_id: entry.exercise_id,
          planned_sets: entry.planned_sets,
          planned_reps: entry.planned_reps,
          actual_sets: entry.actual_sets,
          weight_used: entry.weight_used,
          weight_unit: entry.weight_unit,
          reps_completed: JSON.stringify(entry.reps_completed),
          notes: entry.notes.trim() || null,
        }));

      if (entriesToInsert.length > 0) {
        const { error: entriesError } = await supabase
          .from("workout_progress_entries")
          .insert(entriesToInsert);

        if (entriesError) throw entriesError;
      }

      toast.success("Progress logged successfully!");

      // Reset form
      setProgressEntries({});
      setSessionNotes("");
      setSelectedPlan(null);
      setSelectedPlanType(null);
      setSelectedDay("");
      setPlanExercises([]);

    } catch (error) {
      console.error("Error saving progress:", error);
      toast.error("Failed to save progress. Please try again.");
    }
    setSaving(false);
  };

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container mx-auto px-4 py-8">
          <div className="text-center">
            <h1 className="text-2xl font-bold mb-4">Progress Logging</h1>
            <p className="text-muted-foreground">Please log in to track your workout progress.</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        {/* Tabs: Log / History */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-muted/20 p-1">
            <button
              className={`px-6 py-2 rounded-full font-semibold ${activeTab === 'log' ? 'bg-background text-primary shadow' : 'text-muted-foreground'}`}
              onClick={() => setActiveTab('log')}
            >
              Log Progress
            </button>
            <button
              className={`px-6 py-2 rounded-full font-semibold ${activeTab === 'history' ? 'bg-background text-primary shadow' : 'text-muted-foreground'}`}
              onClick={() => setActiveTab('history')}
            >
              Progress 
            </button>
          </div>
        </div>

        {activeTab === 'history' ? (
          <Card className="mb-8 border-border/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Progress 
              </CardTitle>
              <CardDescription>Review your past workout sessions and entries</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSessions ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  <p className="text-muted-foreground mt-2">Loading history...</p>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground">No progress sessions found.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {sessions.map((s) => (
                    <Card key={s.id} className="border-border/30">
                      <CardContent>
                        <div className="flex items-center justify-between">
                          <div>
                            <h4 className="font-semibold">{s.plan_name} {s.plan_type === 'custom' ? '(custom)' : ''}</h4>
                            <p className="text-sm text-muted-foreground">{s.day_identifier} • {s.workout_date}</p>
                            {s.notes && <p className="text-sm mt-2">{s.notes}</p>}
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold">{s.workout_date}</p>
                          </div>
                        </div>

                        <div className="mt-4">
                          <h5 className="font-medium mb-2">Entries</h5>
                          {s.workout_progress_entries && s.workout_progress_entries.length > 0 ? (
                            <div className="space-y-3">
                              {s.workout_progress_entries.map((e: any) => (
                                <div key={e.id} className="p-3 border rounded-lg bg-muted/10">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-semibold">Exercise: {e.exercise_id}</p>
                                      <p className="text-sm text-muted-foreground">Planned: {e.planned_sets} sets × {e.planned_reps} reps</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="font-semibold">{e.actual_sets} sets</p>
                                      <p className="text-sm text-muted-foreground">{e.weight_used ? `${e.weight_used} ${e.weight_unit}` : 'No weight'}</p>
                                    </div>
                                  </div>
                                  {e.reps_completed && (
                                    <p className="text-sm mt-2">Reps: {JSON.parse(e.reps_completed).join(', ')}</p>
                                  )}
                                  {e.notes && <p className="text-sm mt-2">Notes: {e.notes}</p>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground">No entries for this session.</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        ) : null}
        {/* Header */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-accent rounded-full shadow-glow-accent">
              <TrendingUp className="w-8 h-8 text-accent-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Log Your Progress
          </h1>
          <p className="text-muted-foreground">
            Track your workout progress and see your gains over time
          </p>
        </div>

        {/* Plan Selection */}
        <Card className="mb-8 border-border/40 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="w-5 h-5" />
              Select Workout Plan
            </CardTitle>
            <CardDescription>
              Choose the plan you followed today to log your progress
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6">
              {/* Standard Plans */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Standard Plans</h3>
                <div className="space-y-3">
                  {workoutPlans.map((plan) => (
                    <Card
                      key={plan.id}
                      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                        selectedPlan?.id === plan.id && selectedPlanType === 'standard'
                          ? 'ring-2 ring-primary bg-primary/5'
                          : 'hover:bg-muted/50'
                      }`}
                      onClick={() => handlePlanSelect('standard', plan)}
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{plan.name}</h4>
                            <p className="text-sm text-muted-foreground">{plan.days_per_week} days/week</p>
                          </div>
                          {selectedPlan?.id === plan.id && selectedPlanType === 'standard' && (
                            <CheckCircle className="w-5 h-5 text-primary" />
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>

              {/* Custom Plans */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Your Custom Plans</h3>
                <div className="space-y-3">
                  {customPlans.length > 0 ? (
                    customPlans.map((plan) => (
                      <Card
                        key={plan.id}
                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                          selectedPlan?.id === plan.id && selectedPlanType === 'custom'
                            ? 'ring-2 ring-primary bg-primary/5'
                            : 'hover:bg-muted/50'
                        }`}
                        onClick={() => handlePlanSelect('custom', plan)}
                      >
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{plan.name}</h4>
                              <p className="text-sm text-muted-foreground">
                                {plan.description || 'Custom workout plan'}
                              </p>
                            </div>
                            {selectedPlan?.id === plan.id && selectedPlanType === 'custom' && (
                              <CheckCircle className="w-5 h-5 text-primary" />
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      No custom plans yet. Create one to get started!
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Selection and Progress Logging */}
        {selectedPlan && (
          <Card className="mb-8 border-border/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {selectedPlan.name} - Log Progress
              </CardTitle>
              <CardDescription>
                Select the day you worked out and log your performance
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Date and Day Selection */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workout-date">Workout Date</Label>
                  <Input
                    id="workout-date"
                    type="date"
                    value={workoutDate}
                    onChange={(e) => setWorkoutDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="day-select">Day of Plan</Label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select day..." />
                    </SelectTrigger>
                    <SelectContent>
                      {availableDays.map((day) => (
                        <SelectItem key={day.value} value={day.value}>
                          {day.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Exercises */}
              {selectedDay && (
                <div className="space-y-6">
                  {loading ? (
                    <div className="text-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                      <p className="text-muted-foreground mt-2">Loading exercises...</p>
                    </div>
                  ) : planExercises.length > 0 ? (
                    <>
                      <h3 className="text-xl font-semibold">Exercises Completed</h3>
                      <div className="space-y-4">
                        {planExercises.map((exercise) => {
                          const progress = progressEntries[exercise.exercise_id];
                          if (!progress) return null;

                          return (
                            <Card key={exercise.id} className="border-border/30">
                              <CardContent className="p-6">
                                <div className="flex items-start gap-4 mb-4">
                                  <img
                                    src={exercise.exercise.image_url || `https://via.placeholder.com/80/000000/FFFFFF?text=${exercise.exercise.name.charAt(0)}`}
                                    alt={exercise.exercise.name}
                                    className="w-20 h-20 rounded-lg object-cover border"
                                  />
                                  <div className="flex-1">
                                    <h4 className="text-lg font-semibold">{exercise.exercise.name}</h4>
                                    <p className="text-sm text-muted-foreground capitalize">
                                      {exercise.exercise.muscle_group.replace("_", " ")}
                                    </p>
                                    <div className="flex gap-2 mt-2">
                                      <Badge variant="outline">
                                        Planned: {exercise.sets} sets × {exercise.reps} reps
                                      </Badge>
                                    </div>
                                  </div>
                                </div>

                                {/* Progress Logging */}
                                <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
                                  <div>
                                    <Label htmlFor={`sets-${exercise.exercise_id}`}>Sets Completed</Label>
                                    <Input
                                      id={`sets-${exercise.exercise_id}`}
                                      type="number"
                                      min="0"
                                      max={exercise.sets}
                                      value={progress.actual_sets}
                                      onChange={(e) => updateProgressEntry(
                                        exercise.exercise_id,
                                        'actual_sets',
                                        parseInt(e.target.value) || 0
                                      )}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor={`weight-${exercise.exercise_id}`}>Weight Used</Label>
                                    <div className="flex gap-2 mt-1">
                                      <Input
                                        id={`weight-${exercise.exercise_id}`}
                                        type="number"
                                        min="0"
                                        step="0.5"
                                        value={progress.weight_used || ''}
                                        onChange={(e) => updateProgressEntry(
                                          exercise.exercise_id,
                                          'weight_used',
                                          e.target.value ? parseFloat(e.target.value) : null
                                        )}
                                        placeholder="0"
                                      />
                                      <Select
                                        value={progress.weight_unit}
                                        onValueChange={(value: 'kg' | 'lbs') =>
                                          updateProgressEntry(exercise.exercise_id, 'weight_unit', value)
                                        }
                                      >
                                        <SelectTrigger className="w-16">
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          <SelectItem value="kg">kg</SelectItem>
                                          <SelectItem value="lbs">lbs</SelectItem>
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>
                                  <div className="md:col-span-2">
                                    <Label htmlFor={`reps-${exercise.exercise_id}`}>Reps per Set (comma-separated)</Label>
                                    <Input
                                      id={`reps-${exercise.exercise_id}`}
                                      value={progress.reps_completed.join(', ')}
                                      onChange={(e) => {
                                        const reps = e.target.value.split(',').map(r => parseInt(r.trim())).filter(r => !isNaN(r));
                                        updateProgressEntry(exercise.exercise_id, 'reps_completed', reps);
                                      }}
                                      placeholder="e.g., 10, 8, 12"
                                      className="mt-1"
                                    />
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <Label htmlFor={`notes-${exercise.exercise_id}`}>Exercise Notes (Optional)</Label>
                                  <Textarea
                                    id={`notes-${exercise.exercise_id}`}
                                    value={progress.notes}
                                    onChange={(e) => updateProgressEntry(exercise.exercise_id, 'notes', e.target.value)}
                                    placeholder="How did this exercise feel? Any observations..."
                                    rows={2}
                                    className="mt-1"
                                  />
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </div>

                      {/* Session Notes */}
                      <div>
                        <Label htmlFor="session-notes">Session Notes (Optional)</Label>
                        <Textarea
                          id="session-notes"
                          value={sessionNotes}
                          onChange={(e) => setSessionNotes(e.target.value)}
                          placeholder="Overall thoughts about today's workout..."
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      {/* Save Button */}
                      <div className="flex justify-end">
                        <Button
                          onClick={handleSaveProgress}
                          disabled={saving}
                          className="bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800"
                        >
                          {saving ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                              Saving...
                            </>
                          ) : (
                            <>
                              <Save className="w-4 h-4 mr-2" />
                              Save Progress
                            </>
                          )}
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-8">
                      <Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No exercises found for this day.</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ProgressLogger;