// src/pages/Workouts.tsx (or your file path)
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dumbbell, Calendar, Target, X, Star, Video, Zap, Moon, Plus, User, Eye, Trash2, Share2, Clipboard, Link2 } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { toast } from 'sonner';
import "../styles/custom-scrollbar.css";
import ProgressLogger from "./ProgressLogger";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ThreeScene from "@/components/ThreeScene";
import { useMuscleData } from "@/hooks/useMuscleData";
import { useUserGender } from "@/hooks/useUserGender";

// 1. ⭐ Strong Typing for Data Integrity & Developer Experience
interface Exercise {
  id: string;
  name: string;
  description: string;
  muscle_group: string;
  image_url?: string;
  video_url?: string;
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

// 2. ⭐ Component Refactor: Skeleton Loader for Better Perceived Performance
const PlanDetailSkeleton = () => (
  <div className="grid md:grid-cols-2 gap-6 animate-pulse">
    {[...Array(4)].map((_, i) => (
      <div key={i} className="rounded-2xl bg-muted/60 p-4 space-y-3">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-xl bg-muted-foreground/20"></div>
          <div className="flex-1 space-y-2">
            <div className="h-5 w-3/4 rounded bg-muted-foreground/20"></div>
            <div className="h-3 w-1/2 rounded bg-muted-foreground/20"></div>
          </div>
        </div>
        <div className="space-y-2 pt-2">
          <div className="h-4 w-full rounded bg-muted-foreground/20"></div>
          <div className="h-4 w-5/6 rounded bg-muted-foreground/20"></div>
        </div>
      </div>
    ))}
  </div>
);

// 3. ⭐ Component Refactor: Professional Exercise Card
const ExerciseCard = ({ planExercise }: { planExercise: PlanExercise }) => {
  const { exercise } = planExercise;
  if (!exercise) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.3 }}
      className="border border-border/20 shadow-lg hover:shadow-primary/10 transition-shadow duration-300 rounded-2xl bg-background/50 overflow-hidden"
    >
      <div className="p-5">
        <div className="flex items-start gap-4 mb-4">
          <img
            src={exercise.image_url || `https://via.placeholder.com/150/000000/FFFFFF?text=${exercise.name.charAt(0)}`}
            alt={exercise.name}
            className="w-24 h-24 rounded-lg object-cover border-2 border-primary/20 shadow-md"
          />
          <div className="flex-1">
            <h4 className="text-lg font-bold text-primary mb-1">{exercise.name}</h4>
            <p className="text-sm capitalize font-medium text-secondary">{exercise.muscle_group.replace("_", " ")}</p>
          </div>
        </div>
        <p className="text-muted-foreground text-sm mb-4 min-h-[40px]">{exercise.description}</p>
        <div className="flex items-center justify-between">
          <div className="flex gap-2 text-sm">
            <Badge variant="outline" className="border-primary/50 text-primary font-semibold">
              {planExercise.sets} SETS
            </Badge>
            <Badge variant="outline" className="border-secondary/50 text-secondary font-semibold">
              {planExercise.reps} REPS
            </Badge>
          </div>
          {exercise.video_url && (
            <a
              href={exercise.video_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
            >
              <Video className="w-4 h-4" /> Watch Demo
            </a>
          )}
        </div>
      </div>
    </motion.div>
  );
};


// 4. ⭐ Component Refactor: The Modal Itself
const WorkoutPlanModal = ({ plan, onClose, isOpen, planCache, setPlanCache }: {
  plan: WorkoutPlan | null;
  onClose: () => void;
  isOpen: boolean;
  planCache: Record<string, PlanExercise[]>;
  setPlanCache: React.Dispatch<React.SetStateAction<Record<string, PlanExercise[]>>>;
}) => {
  const [planExercises, setPlanExercises] = useState<PlanExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState<number>(1);
  // muscle selection view state: 'model' placeholder or 'list' of muscle names
  const [selectedView, setSelectedView] = useState<'model' | 'list'>('model');
  const [muscleList] = useState<string[]>(() => [
    'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quadriceps', 'hamstrings', 'calves', 'glutes', 'forearms', 'abs'
  ]);
  const [selectedMuscle, setSelectedMuscle] = useState<string | null>(null);
  const [selectedMuscleLabel, setSelectedMuscleLabel] = useState<string | null>(null);
  const [muscleExercises, setMuscleExercises] = useState<Exercise[]>([]);
  const { linkedMuscles } = useMuscleData();
  const gender = useUserGender();

  const selectedMuscles = useMemo(() => {
    if (!selectedMuscle) return [];
    return linkedMuscles[selectedMuscle] ?? [selectedMuscle];
  }, [selectedMuscle, linkedMuscles]);

  const loadExercisesForMuscle = async (muscle: string) => {
    setSelectedMuscle(muscle);
    setMuscleExercises([]);
    try {
      const { data, error } = await supabase
        .from('exercises')
        .select('*')
        .ilike('muscle_group', `%${muscle}%`)
        .limit(100);
      if (error) throw error;
      setMuscleExercises((data || []) as Exercise[]);
    } catch (err) {
      console.error('Error loading exercises for muscle', muscle, err);
    }
  };

  const addExerciseToPlan = (ex: Exercise) => {
    if (!plan) return toast.error('No plan open to add exercises');
    const newEntry: PlanExercise = {
      id: `local-${Date.now()}`,
      workout_plan_id: plan.id,
      exercise_id: ex.id,
      sets: 3,
      reps: '8-12',
      day_number: activeDay,
      exercise: ex,
    };
    setPlanExercises(prev => [newEntry, ...prev]);
    toast.success(`${ex.name} added to Day ${activeDay}`);
  };

  // 5. ⭐ Performance: Fetch plan details only when the plan changes
  useEffect(() => {
    if (!plan) return;

    const fetchPlanDetails = async () => {
      setLoading(true);
      setActiveDay(1);
      try {
        const { data, error } = await supabase
          .from("workout_plan_exercises")
          .select("*, exercise:exercises(*)")
          .eq("workout_plan_id", plan.id)
          .order("day_number", { ascending: true });
        if (error) throw error;
        setPlanExercises(data || []);
      } catch (error) {
        console.error("Error fetching plan details:", error);
      }
      setLoading(false);
    };

    fetchPlanDetails();
  }, [plan]);

  // 6. ⭐ Performance: Memoize calculations to prevent re-renders
  const daysWithExercises = useMemo(() => {
    const daySet = new Set(planExercises.map(pe => pe.day_number));
    return Array.from(daySet).sort((a, b) => a - b);
  }, [planExercises]);

  const exercisesForActiveDay = useMemo(() => {
    return planExercises.filter(pe => pe.day_number === activeDay);
  }, [planExercises, activeDay]);

  const isRestDay = exercisesForActiveDay.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={true}>
      <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none p-0 overflow-hidden bg-background rounded-none md:rounded-2xl shadow-2xl border-0 custom-scrollbar">
        {plan && (
          <>
            <div className="px-10 py-8 flex items-start justify-between gap-6 border-b border-border/20 bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex-1">
                <h2 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">{plan.name}</h2>
                <div className="flex gap-3 flex-wrap mb-4">
                  <Badge className="bg-primary/15 text-primary border-primary/30 hover:bg-primary/25 px-4 py-2 text-sm font-semibold"><Zap className="w-4 h-4 mr-2" />{plan.days_per_week} Days/Week</Badge>
                  <Badge className="bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/25 capitalize px-4 py-2 text-sm font-semibold"><Target className="w-4 h-4 mr-2" />{plan.goal.replace("_", " ")}</Badge>
                </div>
                <p className="text-muted-foreground text-base max-w-3xl leading-relaxed">{plan.description}</p>
              </div>

            </div>

            {/* Scrollable content area for plan details */}
            <div className="px-10 pt-8 pb-10 overflow-y-auto custom-scrollbar" style={{ minHeight: '450px', maxHeight: 'calc(100vh - 220px)' }}>
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Muscle explorer */}
                <div className="lg:col-span-1 space-y-4">
                  <Card className="border-border/50 shadow-md bg-gradient-to-b from-muted/10 to-background">
                    <CardHeader className="pb-3 flex flex-row items-center justify-between">
                      <div>
                        <CardTitle className="text-lg">Target Muscles</CardTitle>
                        <CardDescription>Explore by model or quick list</CardDescription>
                      </div>
                      <div className="inline-flex gap-2">
                        <button onClick={() => setSelectedView('model')} className={`px-3 py-1 rounded-md text-sm font-medium ${selectedView === 'model' ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/30 text-foreground'}`}>Model</button>
                        <button onClick={() => setSelectedView('list')} className={`px-3 py-1 rounded-md text-sm font-medium ${selectedView === 'list' ? 'bg-primary text-primary-foreground shadow' : 'bg-muted/30 text-foreground'}`}>List</button>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {selectedView === 'model' ? (
                        <div className="rounded-xl border border-border/40 bg-background/80 p-3">
                          <div className="w-full h-[320px] rounded-lg overflow-hidden">
                            <ThreeScene
                              gender={gender}
                              selectedMuscles={selectedMuscles}
                              onMuscleSelect={(muscleKey: string, muscleLabel: string) => {
                                setSelectedMuscle(muscleKey);
                                setSelectedMuscleLabel(muscleLabel);
                                loadExercisesForMuscle(muscleKey);
                              }}
                              className="w-full h-full"
                            />
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {muscleList.map((m) => (
                            <button
                              key={m}
                              onClick={() => loadExercisesForMuscle(m)}
                              className={`px-3 py-2 rounded-lg text-sm text-left border transition ${selectedMuscle === m ? 'border-primary bg-primary/10 text-primary font-semibold' : 'border-border/40 hover:border-primary/50 bg-muted/20'}`}
                            >
                              {m.replace('_', ' ')}
                            </button>
                          ))}
                        </div>
                      )}

                      {selectedMuscle && (
                        <div className="space-y-2 pt-2">
                          <div className="flex items-center justify-between">
                            <h4 className="text-sm font-semibold">Exercises for {selectedMuscle.replace('_', ' ')}</h4>
                            <Badge variant="outline" className="text-xs">{muscleExercises.length} found</Badge>
                          </div>
                          <div className="space-y-2 max-h-56 overflow-auto custom-scrollbar pr-1">
                            {muscleExercises.length === 0 ? (
                              <div className="text-sm text-muted-foreground">No exercises yet</div>
                            ) : (
                              muscleExercises.map((ex) => (
                                <div key={ex.id} className="p-2 border rounded-lg flex items-center gap-3 bg-background/80 hover:border-primary/40 transition">
                                  <img src={ex.image_url || `https://via.placeholder.com/80/000000/FFFFFF?text=${ex.name.charAt(0)}`} className="w-12 h-12 rounded-md object-cover" />
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">{ex.name}</div>
                                    <div className="text-xs text-muted-foreground truncate">{ex.description?.slice(0, 80) || 'No description'}</div>
                                  </div>
                                  <Button size="sm" variant="outline" onClick={() => addExerciseToPlan(ex)} className="text-xs">Add</Button>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Day view and exercises */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border-border/50 shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <CardTitle className="text-2xl">Daily Breakdown</CardTitle>
                          <CardDescription>Select a day to see exercises</CardDescription>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {daysWithExercises.map((day) => (
                            <Button
                              key={day}
                              variant={activeDay === day ? "default" : "outline"}
                              className={`rounded-full px-4 py-2 text-sm font-semibold ${activeDay === day ? 'bg-primary text-primary-foreground shadow' : 'border-border/60'}`}
                              onClick={() => setActiveDay(day)}
                            >
                              Day {day}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <PlanDetailSkeleton />
                      ) : (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeDay}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                          >
                            {isRestDay ? (
                              <div className="flex flex-col items-center justify-center gap-4 w-full py-14 rounded-2xl bg-gradient-to-br from-secondary/10 via-muted/40 to-background text-center border border-dashed border-secondary/40 shadow-inner">
                                <Moon className="w-16 h-16 text-secondary" />
                                <h3 className="text-3xl font-extrabold text-secondary">Rest Day</h3>
                                <p className="text-muted-foreground max-w-xl text-base leading-relaxed">Recovery is crucial. Stretch, hydrate, and come back stronger tomorrow.</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                  <div>
                                    <h4 className="text-xl font-bold text-primary">Day {activeDay} Workout</h4>
                                    <p className="text-muted-foreground text-sm">{exercisesForActiveDay.length} Exercise{exercisesForActiveDay.length > 1 ? 's' : ''} • Focus on form and tempo</p>
                                  </div>
                                  <Badge variant="secondary" className="px-3 py-1 text-xs">Guided routine</Badge>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                  {exercisesForActiveDay.map((pe) => (
                                    <ExerciseCard key={pe.id} planExercise={pe} />
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

// 8. ⭐ Custom Plan Modal Component
const CustomPlanModal = ({ plan, onClose, isOpen }: { plan: CustomPlan | null; onClose: () => void; isOpen: boolean; }) => {
  const [planExercises, setPlanExercises] = useState<CustomPlanExercise[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeDay, setActiveDay] = useState<string>("monday");
  const navigate = useNavigate();

  const DAYS_OF_WEEK = [
    { value: "monday", label: "Monday", short: "Mon" },
    { value: "tuesday", label: "Tuesday", short: "Tue" },
    { value: "wednesday", label: "Wednesday", short: "Wed" },
    { value: "thursday", label: "Thursday", short: "Thu" },
    { value: "friday", label: "Friday", short: "Fri" },
    { value: "saturday", label: "Saturday", short: "Sat" },
    { value: "sunday", label: "Sunday", short: "Sun" },
  ];

  useEffect(() => {
    if (!plan) return;

    const fetchPlanDetails = async () => {
      setLoading(true);
      setActiveDay("monday");
      try {
        const { data, error } = await supabase
          .from("user_custom_plan_exercises")
          .select("*, exercise:exercises(*)")
          .eq("user_custom_plan_id", plan.id)
          .order("day_of_week", { ascending: true })
          .order("created_at", { ascending: true });
        if (error) throw error;
        setPlanExercises(data || []);
      } catch (error) {
        console.error("Error fetching custom plan details:", error);
      }
      setLoading(false);
    };

    fetchPlanDetails();
  }, [plan]);

  const daysWithExercises = useMemo(() => {
    const daySet = new Set(planExercises.map(pe => pe.day_of_week));
    return DAYS_OF_WEEK.filter(day => daySet.has(day.value));
  }, [planExercises]);

  const exercisesForActiveDay = useMemo(() => {
    return planExercises.filter(pe => pe.day_of_week === activeDay);
  }, [planExercises, activeDay]);

  const isRestDay = exercisesForActiveDay.length === 0;

  const handleEditPlan = () => {
    if (!plan) return;
    onClose();
    navigate(`/create-plan/${plan.id}`);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={true}>
      <DialogContent className="w-[100vw] h-[100vh] max-w-none max-h-none p-0 overflow-hidden bg-background rounded-none md:rounded-2xl shadow-2xl border-0 custom-scrollbar">
        {plan && (
          <>
            <div className="px-10 py-8 flex items-start justify-between gap-6 border-b border-border/20 bg-gradient-to-r from-primary/5 to-secondary/5">
              <div className="flex-1">
                <h2 className="text-3xl font-extrabold text-foreground mb-3 tracking-tight">{plan.name}</h2>
                <div className="flex gap-3 flex-wrap mb-4">
                  <Badge className="bg-accent/15 text-accent border-accent/30 hover:bg-accent/25 px-4 py-2 text-sm font-semibold">
                    <User className="w-4 h-4 mr-2" />
                    Custom Plan
                  </Badge>
                  <Badge className="bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/25 px-4 py-2 text-sm font-semibold">
                    <Calendar className="w-4 h-4 mr-2" />
                    {daysWithExercises.length} Days/Week
                  </Badge>
                </div>
                <p className="text-muted-foreground text-base max-w-3xl leading-relaxed">
                  {plan.description || "Your personalized workout plan"}
                </p>
                

              </div>
              <div className="flex flex-col items-end gap-3">
                <div className="flex flex-wrap justify-end gap-2">
                  {daysWithExercises.map((day) => (
                    <Button
                      key={day.value}
                      variant={activeDay === day.value ? "default" : "outline"}
                      className={`rounded-full px-6 py-3 font-bold transition-all duration-300 text-base whitespace-nowrap shadow-md ${activeDay === day.value ? "bg-primary text-primary-foreground shadow-primary/30 scale-105" : "border-border/60 bg-background hover:bg-muted/50 hover:border-primary/60"}`}
                      onClick={() => setActiveDay(day.value)}
                    >
                      {day.short}
                    </Button>
                  ))}
                </div>
                <Button variant="secondary" className="w-full sm:w-auto" onClick={handleEditPlan}>
                  Edit Plan
                </Button>
              </div>
              
            </div>



            <div className="px-10 pt-8 pb-10 overflow-y-auto custom-scrollbar" style={{ minHeight: '450px', maxHeight: 'calc(100vh - 220px)' }}>
              <div className="grid lg:grid-cols-3 gap-6">
                {/* Left: Plan insights */}
                <div className="lg:col-span-1 space-y-4">
                  <Card className="border-border/50 shadow-md bg-gradient-to-b from-muted/10 to-background">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-lg">Plan Overview</CardTitle>
                      <CardDescription>Quick stats for this custom plan</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div className="p-3 rounded-lg border border-border/40 bg-background/80">
                          <p className="text-muted-foreground text-xs">Total Days</p>
                          <p className="text-xl font-bold">{daysWithExercises.length || 0}</p>
                        </div>
                        <div className="p-3 rounded-lg border border-border/40 bg-background/80">
                          <p className="text-muted-foreground text-xs">Exercises</p>
                          <p className="text-xl font-bold">{planExercises.length || 0}</p>
                        </div>
                      </div>
                      <div className="p-3 rounded-lg border border-border/40 bg-background/80 text-sm leading-relaxed">
                        Customize sets, reps, and notes per exercise. Use the day chips above to switch schedules.
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Right: Day view */}
                <div className="lg:col-span-2 space-y-4">
                  <Card className="border-border/50 shadow-lg">
                    <CardHeader className="pb-4">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                        <div>
                          <CardTitle className="text-2xl">Daily Breakdown</CardTitle>
                          <CardDescription>See exercises, sets, reps, and notes</CardDescription>
                        </div>
                        <Badge variant="outline" className="text-xs px-3 py-1">{activeDay.toUpperCase()}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {loading ? (
                        <PlanDetailSkeleton />
                      ) : (
                        <AnimatePresence mode="wait">
                          <motion.div
                            key={activeDay}
                            initial={{ opacity: 0, y: 15 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -15 }}
                            transition={{ duration: 0.25 }}
                          >
                            {isRestDay ? (
                              <div className="flex flex-col items-center justify-center gap-4 w-full py-14 rounded-2xl bg-gradient-to-br from-secondary/10 via-muted/40 to-background text-center border border-dashed border-secondary/40 shadow-inner">
                                <Moon className="w-16 h-16 text-secondary" />
                                <h3 className="text-3xl font-extrabold text-secondary">Rest Day</h3>
                                <p className="text-muted-foreground max-w-xl text-base leading-relaxed">Recovery is crucial. Stretch, hydrate, and come back stronger tomorrow.</p>
                              </div>
                            ) : (
                              <div className="space-y-4">
                                <div className="flex items-center justify-between flex-wrap gap-3">
                                  <div>
                                    <h4 className="text-xl font-bold text-primary">{DAYS_OF_WEEK.find(d => d.value === activeDay)?.label} Workout</h4>
                                    <p className="text-muted-foreground text-sm">{exercisesForActiveDay.length} Exercise{exercisesForActiveDay.length > 1 ? 's' : ''} • Stay consistent</p>
                                  </div>
                                  <Badge variant="secondary" className="px-3 py-1 text-xs">Custom routine</Badge>
                                </div>
                                <div className="grid md:grid-cols-2 gap-4">
                                  {exercisesForActiveDay.map((pe) => (
                                    <motion.div
                                      key={pe.id}
                                      layout
                                      initial={{ opacity: 0, y: 20 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      exit={{ opacity: 0, y: -20 }}
                                      transition={{ duration: 0.25 }}
                                      className="border border-border/20 shadow-lg hover:shadow-primary/10 transition-shadow duration-300 rounded-2xl bg-background/60 overflow-hidden"
                                    >
                                      <div className="p-5">
                                        <div className="flex items-start gap-4 mb-4">
                                          <img
                                            src={pe.exercise.image_url || `https://via.placeholder.com/150/000000/FFFFFF?text=${pe.exercise.name.charAt(0)}`}
                                            alt={pe.exercise.name}
                                            className="w-20 h-20 rounded-lg object-cover border-2 border-primary/20 shadow-md"
                                          />
                                          <div className="flex-1">
                                            <h4 className="text-lg font-bold text-primary mb-1">{pe.exercise.name}</h4>
                                            <p className="text-sm capitalize font-medium text-secondary">{pe.exercise.muscle_group.replace("_", " ")}</p>
                                          </div>
                                        </div>
                                        <p className="text-muted-foreground text-sm mb-4 min-h-[40px]">{pe.exercise.description}</p>
                                        <div className="flex items-center justify-between">
                                          <div className="flex gap-2 text-sm">
                                            <Badge variant="outline" className="border-primary/50 text-primary font-semibold">
                                              {pe.sets} SETS
                                            </Badge>
                                            <Badge variant="outline" className="border-secondary/50 text-secondary font-semibold">
                                              {pe.reps} REPS
                                            </Badge>
                                          </div>
                                          {pe.exercise.video_url && (
                                            <a
                                              href={pe.exercise.video_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                                            >
                                              <Video className="w-4 h-4" /> Demo
                                            </a>
                                          )}
                                        </div>
                                        {pe.notes && (
                                          <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                                            <p className="text-xs text-muted-foreground italic">{pe.notes}</p>
                                          </div>
                                        )}
                                      </div>
                                    </motion.div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};


// Main Page Component
const WorkoutsPage = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [shareTargetPlan, setShareTargetPlan] = useState<CustomPlan | null>(null);
  const [shareGenerating, setShareGenerating] = useState<string | null>(null);
  const [preferredPlan, setPreferredPlanState] = useState<{ type: 'standard' | 'custom' | null; id: string | null }>({ type: null, id: null });
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [activeCustomPlan, setActiveCustomPlan] = useState<CustomPlan | null>(null);

  // 7. ⭐ Performance: Simple client-side cache for plan details
  const [planCache, setPlanCache] = useState<Record<string, PlanExercise[]>>({});
  const [settingPreferred, setSettingPreferred] = useState<string | null>(null);
  const [selectedMenuOpen, setSelectedMenuOpen] = useState(false);
  const clearTimerRef = useRef<any>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDeleteRef = useRef<{
    plan: CustomPlan;
    preferredSnapshot: { type: 'standard' | 'custom' | null; id: string | null };
  } | null>(null);

  useEffect(() => {
    return () => {
      if (clearTimerRef.current) {
        clearTimeout(clearTimerRef.current);
        clearTimerRef.current = null;
      }
    };
  }, []);

  const generateShareToken = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2)).replace(/-/g, "");

  const handleSharePlan = async (plan: CustomPlan) => {
    try {
      setShareGenerating(plan.id);
      setShareLink(null);
      setShareTargetPlan(null);

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to share plans");
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("user_custom_plan_exercises")
        .select("day_of_week, sets, reps, notes, exercise:exercises(id, name, muscle_group, image_url, description)")
        .eq("user_custom_plan_id", plan.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const snapshot = {
        name: plan.name,
        description: plan.description,
        exercises: (data || []).map((row: any) => ({
          day_of_week: row.day_of_week,
          sets: row.sets,
          reps: row.reps,
          notes: row.notes,
          exercise_id: row.exercise?.id,
          exercise_name: row.exercise?.name,
          muscle_group: row.exercise?.muscle_group,
          image_url: row.exercise?.image_url,
          exercise_description: row.exercise?.description,
        })),
      };

      const token = generateShareToken();
      const { data: inserted, error: insertError } = await supabase
        .from("shared_custom_plan_links")
        .insert({
          token,
          user_custom_plan_id: plan.id,
          created_by_user_id: user.id,
          plan_snapshot: snapshot,
        })
        .select("token")
        .single();

      if (insertError) throw insertError;

      const link = `${window.location.origin}/import-plan?token=${inserted.token}`;
      setShareLink(link);
      setShareTargetPlan(plan);
      try {
        await navigator.clipboard.writeText(link);
        toast.success("Share link generated and copied!");
      } catch {
        toast.success("Share link generated");
      }
    } catch (err: any) {
      console.error("Error sharing plan", err);
      toast.error(err?.message || "Could not create share link");
    } finally {
      setShareGenerating(null);
    }
  };

  const setPreferredPlan = async (type: 'standard' | 'custom', id: string) => {
    // optimistic UI update
    const prev = { ...preferredPlan };
    setPreferredPlanState({ type, id });
    setSettingPreferred(id);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Check if a profile already exists for this user
      const { data: existing, error: selectErr } = await supabase.from('profiles').select('id,gender').eq('user_id', user.id).maybeSingle();
      if (selectErr) throw selectErr;

      if (existing) {
        // Profile exists - update only the preferred fields
        const { error } = await supabase.from('profiles').update({ preferred_workout_plan_type: type, preferred_workout_plan_id: id } as any).eq('user_id', user.id);
        if (error) throw error;
      } else {
        // No profile exists. The `gender` column is NOT NULL in the schema, so we must supply a value.
        // Use a harmless placeholder and prompt user to update their profile if needed.
        const placeholderGender = 'male';
        const { error } = await supabase.from('profiles').insert({ user_id: user.id, gender: placeholderGender, preferred_workout_plan_type: type, preferred_workout_plan_id: id } as any);
        if (error) throw error;
      }

      toast.success('Preferred program saved');
    } catch (err: any) {
      console.error(err);
      // revert optimistic change
      setPreferredPlanState(prev);
      toast.error(err?.message || 'Failed to set preferred program');
    } finally {
      setSettingPreferred(null);
    }
  };

  const commitDeleteCustomPlan = async (planId: string) => {
    try {
      const { error: exercisesError } = await supabase
        .from("user_custom_plan_exercises")
        .delete()
        .eq("user_custom_plan_id", planId);
      if (exercisesError) throw exercisesError;

      const { error: planError } = await supabase
        .from("user_custom_plans")
        .delete()
        .eq("id", planId);
      if (planError) throw planError;

      toast.success("Custom plan deleted");
    } catch (error) {
      console.error("Error deleting custom plan:", error);
      toast.error("Failed to delete plan");
      // Restore on failure
      const snapshot = pendingDeleteRef.current;
      if (snapshot) {
        setCustomPlans((prev) => [snapshot.plan, ...prev]);
        setPreferredPlanState(snapshot.preferredSnapshot);
      }
    } finally {
      pendingDeleteRef.current = null;
      setPendingDeleteId(null);
      if (deleteTimerRef.current) {
        clearTimeout(deleteTimerRef.current);
        deleteTimerRef.current = null;
      }
    }
  };

  const undoPendingDelete = () => {
    const snapshot = pendingDeleteRef.current;
    if (!snapshot) return;
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }
    setCustomPlans((prev) => [snapshot.plan, ...prev]);
    setPreferredPlanState(snapshot.preferredSnapshot);
    setPendingDeleteId(null);
    pendingDeleteRef.current = null;
    toast.success("Delete undone");
  };

  const handleDeleteCustomPlan = (planId: string) => {
    const target = customPlans.find((p) => p.id === planId);
    if (!target) return;
    const confirmed = window.confirm("Delete this custom plan? This will be permanent after 5 seconds.");
    if (!confirmed) return;

    // Clear any pending delete first
    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current);
      deleteTimerRef.current = null;
    }

    const preferredSnapshot = { ...preferredPlan };
    pendingDeleteRef.current = { plan: target, preferredSnapshot };
    setPendingDeleteId(planId);

    // Optimistic UI update
    setCustomPlans((prev) => prev.filter((p) => p.id !== planId));
    if (activeCustomPlan?.id === planId) setActiveCustomPlan(null);
    if (preferredPlan.id === planId && preferredPlan.type === 'custom') {
      setPreferredPlanState({ type: null, id: null });
    }

    toast.success("Deleting custom plan in 5s", {
      action: {
        label: "Undo",
        onClick: undoPendingDelete,
      },
    });

    deleteTimerRef.current = setTimeout(() => {
      commitDeleteCustomPlan(planId);
    }, 5000);
  };

  useEffect(() => {
    const loadWorkoutPlans = async () => {
      try {
        const { data, error } = await supabase.from("workout_plans").select("*").order("days_per_week", { ascending: true });
        if (error) throw error;
        setWorkoutPlans(data || []);
      } catch (error) {
        console.error("Error loading workout plans:", error);
      }
    };
    loadWorkoutPlans();
  }, []);

  useEffect(() => {
    const loadPreferred = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: profile } = await supabase.from('profiles').select('preferred_workout_plan_type, preferred_workout_plan_id').eq('user_id', user.id).maybeSingle();
        const p: any = profile;
        if (p && p.preferred_workout_plan_id) {
          setPreferredPlanState({ type: p.preferred_workout_plan_type === 'custom' ? 'custom' : 'standard', id: p.preferred_workout_plan_id });
        }
      } catch (err) { console.error(err); }
    };
    loadPreferred();
  }, []);

  // Memoized find for the currently preferred plan object (if available)
  const preferredFound = useMemo(() => {
    if (!preferredPlan.id || !preferredPlan.type) return null;
    const list = preferredPlan.type === 'custom' ? customPlans : workoutPlans;
    return list.find(p => p.id === preferredPlan.id) || null;
  }, [preferredPlan, customPlans, workoutPlans]);

  // Schedule clear with undo: optimistic UI update, wait 5s for undo, then perform DB update
  const scheduleClearPreferred = (prev: { type: 'standard' | 'custom' | null; id: string | null }) => {
    // clear any existing timer
    if (clearTimerRef.current) {
      clearTimeout(clearTimerRef.current);
      clearTimerRef.current = null;
    }

    clearTimerRef.current = setTimeout(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error('Not authenticated');
        const { error } = await supabase.from('profiles').update({ preferred_workout_plan_type: null, preferred_workout_plan_id: null } as any).eq('user_id', user.id);
        if (error) throw error;
        toast.success('Preferred program cleared');
      } catch (err: any) {
        console.error(err);
        // revert UI
        setPreferredPlanState(prev);
        toast.error('Failed to clear preferred program');
      } finally {
        clearTimerRef.current = null;
      }
    }, 5000);

    toast.success('Preferred program will be cleared', {
      action: {
        label: 'Undo',
        onClick: () => {
          if (clearTimerRef.current) {
            clearTimeout(clearTimerRef.current);
            clearTimerRef.current = null;
            setPreferredPlanState(prev);
            toast.success('Clear cancelled');
          }
        }
      }
    });
  };

  useEffect(() => {
    if (isAuthenticated) {
      const loadCustomPlans = async () => {
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
          console.error("Error loading custom plans:", error);
        }
      };
      loadCustomPlans();
    }
  }, [isAuthenticated]);

  const filteredPlans = useMemo(() => {
    return workoutPlans.filter((plan) => {
      if (selectedGoal && plan.goal !== selectedGoal) return false;
      if (selectedDays && plan.days_per_week !== selectedDays) return false;
      return true;
    });
  }, [workoutPlans, selectedGoal, selectedDays]);

  const allPlans = useMemo(() => {
    const standardPlans = filteredPlans.map(plan => ({ ...plan, type: 'standard' as const }));
    const userCustomPlans = customPlans.map(plan => ({ ...plan, type: 'custom' as const }));
    return [...userCustomPlans, ...standardPlans];
  }, [filteredPlans, customPlans]);

  const goals = [
    { value: "aesthetic", label: "Aesthetic Physique", color: "bg-gradient-primary", icon: <Star className="w-4 h-4 mr-1" /> },
    { value: "powerlifting", label: "Power Lifting", color: "bg-gradient-secondary", icon: <Zap className="w-4 h-4 mr-1" /> },
    { value: "weight_gain", label: "Weight Gain", color: "bg-gradient-accent", icon: <Dumbbell className="w-4 h-4 mr-1" /> },
    { value: "fat_loss", label: "Fat Loss", color: "bg-gradient-primary", icon: <Moon className="w-4 h-4 mr-1" /> },
    { value: "healthy_life", label: "Healthy Life", color: "bg-gradient-secondary", icon: <Calendar className="w-4 h-4 mr-1" /> },
  ];
  const daysOptions = [3, 4, 5, 6];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <Tabs defaultValue="browse" className="w-full">
          {/* <TabsList className="grid w-full grid-cols-2 mb-8">
            <TabsTrigger value="browse" className="flex items-center gap-2">
              <Dumbbell className="w-4 h-4" />
              Browse Plans
            </TabsTrigger>
            <TabsTrigger value="progress" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Log Progress
            </TabsTrigger>
          </TabsList> */}

          <TabsContent value="browse">
            {/* Professional Header */}
            <div className="text-center mb-12">
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="flex justify-center mb-6"
              >
                <div className="p-6 bg-gradient-to-br from-primary/90 to-secondary/90 rounded-full shadow-glow-primary animate-pulse-slow">
                  <Dumbbell className="w-12 h-12 text-primary-foreground drop-shadow-lg" />
                </div>
              </motion.div>
              <motion.h1
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-6xl font-extrabold mb-4 bg-gradient-hero bg-clip-text text-transparent tracking-tight"
              >
                Workout Plans
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
                className="text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed"
              >
                Discover personalized workout plans designed by experts. Achieve your fitness goals with structured, effective routines tailored to your lifestyle.
              </motion.p>
            </div>

            {/* Create Custom Plan Button */}
            {isAuthenticated && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.5 }}
                className="flex justify-center mb-8"
              >
                <Button
                  onClick={() => navigate('/create-plan')}
                  className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-8 py-3 rounded-full font-semibold shadow-lg hover:shadow-xl transition-all duration-300"
                >
                  <Plus className="w-5 h-5 mr-2" />
                  Create Custom Plan
                </Button>
              </motion.div>
            )}

            {shareLink && shareTargetPlan && (
              <Card className="mb-8 border-primary/40 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <Share2 className="w-5 h-5" />
                    Share link ready for {shareTargetPlan.name}
                  </CardTitle>
                  <CardDescription>Anyone with this link can open and import your plan.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Input readOnly value={shareLink} className="flex-1" />
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(shareLink);
                          toast.success('Link copied');
                        } catch {
                          toast.error('Copy failed');
                        }
                      }} className="gap-2">
                        <Clipboard className="w-4 h-4" /> Copy
                      </Button>
                      <Button variant="secondary" onClick={() => window.open(shareLink, '_blank')} className="gap-2">
                        <Link2 className="w-4 h-4" /> Open
                      </Button>
                    </div>
                  </div>
                  <Button variant="ghost" className="px-0" onClick={() => { setShareLink(null); setShareTargetPlan(null); }}>
                    Dismiss
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* Preferred Program Preview (placed between Create and Filters) */}
            {preferredPlan.id && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }} className="mb-8">
                <div className="cursor-pointer" onClick={() => {
                  // open appropriate modal for preview
                  if (!preferredFound) return;
                  if (preferredPlan.type === 'custom') setActiveCustomPlan(preferredFound as CustomPlan);
                  else setActivePlan(preferredFound as WorkoutPlan);
                }}>
                  <Card className="border-2 border-primary/30 rounded-2xl shadow-2xl overflow-visible hover:shadow-2xl transition-shadow duration-200">
                    <div className="p-6 flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {preferredFound && (preferredFound as any).image_url ? (
                          <img src={(preferredFound as any).image_url} alt={(preferredFound as any).name} className="w-20 h-20 rounded-lg object-cover border-2 border-primary/20 shadow-md" />
                        ) : (
                          <div className="w-20 h-20 rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10 flex items-center justify-center text-primary text-3xl font-extrabold">{preferredFound ? (preferredFound.name.charAt(0)) : '?'}</div>
                        )}
                        <div>
                          <div className="text-sm text-muted-foreground">Preferred Program</div>
                          <div className="text-2xl font-extrabold">{preferredFound ? preferredFound.name : 'Selected Program'}</div>
                          <div className="text-sm text-muted-foreground mt-1">Tap to preview. Use the menu to clear or manage.</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <button onClick={(e) => { e.stopPropagation(); setSelectedMenuOpen(v => !v); }} className="px-3 py-2 rounded-md bg-primary/10 text-primary font-semibold">Selected ▾</button>
                          {selectedMenuOpen && (
                            <div className="absolute right-0 mt-2 w-44 bg-background border border-border rounded-lg shadow-lg z-50">
                              <button className="w-full text-left px-4 py-3 hover:bg-muted/20" onClick={(e) => { e.stopPropagation(); setSelectedMenuOpen(false); if (preferredFound) { if (preferredPlan.type === 'custom') setActiveCustomPlan(preferredFound as CustomPlan); else setActivePlan(preferredFound as WorkoutPlan); } }}>Preview</button>
                              <button className="w-full text-left px-4 py-3 hover:bg-muted/20" onClick={async (e) => { e.stopPropagation(); setSelectedMenuOpen(false); const prev = { ...preferredPlan }; setPreferredPlanState({ type: null, id: null }); scheduleClearPreferred(prev); }}>Clear</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                </div>
              </motion.div>
            )}

            {/* Filters Section - Professional Cards */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="flex flex-col md:flex-row gap-8 mb-12"
            >
              <Card className="flex-1 border-border/40 shadow-lg hover:shadow-primary/10 transition-shadow duration-300 bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-full">
                      <Target className="w-6 h-6 text-primary" />
                    </div>
                    <CardTitle className="text-xl font-bold">Select Your Goal</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {goals.map((goal) => (
                      <Button
                        key={goal.value}
                        variant={selectedGoal === goal.value ? "default" : "outline"}
                        className={
                          `flex items-center gap-2 px-5 py-3 rounded-full font-semibold transition-all duration-300 border-2 ` +
                          (selectedGoal === goal.value ? `${goal.color} shadow-glow-primary scale-105 text-primary-foreground` : "border-border/50 hover:border-primary/50 hover:bg-primary/5")
                        }
                        onClick={() => setSelectedGoal(selectedGoal === goal.value ? null : goal.value)}
                      >
                        {goal.icon} {goal.label}
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
              <Card className="flex-1 border-border/40 shadow-lg hover:shadow-secondary/10 transition-shadow duration-300 bg-gradient-to-br from-background to-muted/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-secondary/10 rounded-full">
                      <Calendar className="w-6 h-6 text-secondary" />
                    </div>
                    <CardTitle className="text-xl font-bold">Training Frequency</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4">
                    {daysOptions.map((days) => (
                      <Button
                        key={days}
                        variant={selectedDays === days ? "default" : "outline"}
                        className={
                          `px-6 py-3 rounded-full font-semibold transition-all duration-300 border-2 ` +
                          (selectedDays === days ? "bg-gradient-secondary shadow-glow-secondary scale-105 text-secondary-foreground" : "border-border/50 hover:border-secondary/50 hover:bg-secondary/5")
                        }
                        onClick={() => setSelectedDays(selectedDays === days ? null : days)}
                      >
                        {days} Days/Week
                      </Button>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Workout Plan Cards - Professional Layout & Animation */}
            <AnimatePresence mode="popLayout">
              <motion.div
                layout
                initial={{ opacity: 0, y: 40 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -40 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 xl:gap-10"
              >

                {/* Custom Plans First */}
                {customPlans.map((plan, index) => (
                  <motion.div
                    key={`custom-${plan.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{ duration: 0.4, delay: index * 0.1 }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  >
                    <Card className="flex flex-col border border-yellow-500/20 shadow-xl hover:shadow-amber-400/30 transition-all duration-300 rounded-3xl bg-gradient-to-br from-amber-50 via-background to-amber-100/60 dark:from-amber-950/15 dark:via-background dark:to-amber-900/20 overflow-hidden group ring-1 ring-transparent hover:ring-amber-300/50">
                      <CardHeader className="pb-4 bg-gradient-to-r from-yellow-500/10 to-orange-500/10">
                        <div className="flex items-center gap-2 mb-2">
                          <Star className="w-5 h-5 text-yellow-500" />
                          <Badge className="bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30">Custom Plan</Badge>
                        </div>
                        <CardTitle className="text-2xl font-bold mb-2 text-primary/90 group-hover:text-primary transition-colors">{plan.name}</CardTitle>
                        <CardDescription className="text-base text-muted-foreground leading-relaxed">{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow flex flex-col justify-end gap-4 p-6">
                        <div className="flex gap-3 flex-wrap">
                          <Badge className="bg-gradient-primary text-sm px-4 py-2 rounded-full shadow-md font-semibold">Personalized</Badge>
                        </div>
                        <div className="flex flex-col gap-3">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white transition-all duration-200 font-bold py-3 rounded-2xl shadow-lg hover:shadow-xl group-hover:scale-105" onClick={() => setActiveCustomPlan(plan)}>
                              <Eye className="w-5 h-5 mr-3" /> View Plan
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full border-amber-300/60 hover:border-amber-400/90 rounded-2xl"
                              onClick={() => navigate(`/create-plan/${plan.id}`)}
                            >
                              Edit Plan
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full border-amber-300/60 hover:border-amber-400/90 rounded-2xl"
                              onClick={() => handleSharePlan(plan)}
                              disabled={shareGenerating === plan.id}
                            >
                              {shareGenerating === plan.id ? 'Creating...' : <span className="inline-flex items-center gap-2"><Share2 className="w-4 h-4" /> Share</span>}
                            </Button>
                            <Button
                              variant="outline"
                              className="w-full border-amber-300/60 hover:border-amber-400/90 rounded-2xl col-span-2 sm:col-span-1"
                              onClick={() => handleDeleteCustomPlan(plan.id)}
                              disabled={pendingDeleteId === plan.id}
                            >
                              {pendingDeleteId === plan.id ? "Deleting..." : <span className="inline-flex items-center gap-2"><Trash2 className="w-4 h-4" /> Delete</span>}
                            </Button>
                          </div>
                          {preferredPlan.id === plan.id && preferredPlan.type === 'custom' ? (
                            <div className="w-full inline-flex items-center justify-center py-3 rounded-2xl bg-primary/10 text-primary font-semibold">Selected</div>
                          ) : (
                            <Button variant="outline" className="w-full rounded-2xl" onClick={() => setPreferredPlan('custom', plan.id)} disabled={settingPreferred === plan.id || pendingDeleteId === plan.id}>
                              {settingPreferred === plan.id ? 'Setting...' : 'Set as Preferred Program'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {/* Standard Plans */}
                {filteredPlans.map((plan, index) => (
                  <motion.div
                    key={`standard-${plan.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: -20 }}
                    transition={{ duration: 0.4, delay: (customPlans.length + index) * 0.1 }}
                    whileHover={{ y: -5, transition: { duration: 0.2 } }}
                  >
                    <Card className="flex flex-col border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl bg-gradient-to-br from-background via-muted/30 to-background/90 overflow-hidden group">
                      <CardHeader className="pb-4 bg-gradient-to-r from-primary/5 to-secondary/5">
                        <CardTitle className="text-2xl font-bold mb-2 text-primary/90 group-hover:text-primary transition-colors">{plan.name}</CardTitle>
                        <CardDescription className="text-base text-muted-foreground leading-relaxed">{plan.description}</CardDescription>
                      </CardHeader>
                      <CardContent className="flex-grow flex flex-col justify-end gap-4 p-6">
                        <div className="flex gap-3 flex-wrap">
                          <Badge className="bg-gradient-primary text-sm px-4 py-2 rounded-full shadow-md font-semibold">{plan.days_per_week} Days/Week</Badge>
                          <Badge className="bg-gradient-secondary capitalize text-sm px-4 py-2 rounded-full shadow-md font-semibold">{plan.goal.replace("_", " ")}</Badge>
                        </div>
                        <div className="flex flex-col gap-3">
                          <Button className="w-full bg-gradient-accent hover:opacity-90 transition-all duration-200 font-bold py-3 rounded-full shadow-lg hover:shadow-xl group-hover:scale-105" onClick={() => setActivePlan(plan)}>
                            <Dumbbell className="w-5 h-5 mr-3" /> View Plan Details
                          </Button>
                          {preferredPlan.id === plan.id && preferredPlan.type === 'standard' ? (
                            <div className="w-full inline-flex items-center justify-center py-3 rounded-full bg-primary/10 text-primary font-semibold">Selected</div>
                          ) : (
                            <Button variant="outline" className="w-full" onClick={() => setPreferredPlan('standard', plan.id)} disabled={settingPreferred === plan.id}>
                              {settingPreferred === plan.id ? 'Setting...' : 'Set as Preferred Program'}
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}

                {/* Empty State */}
                {allPlans.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="col-span-full text-center py-20"
                  >
                    <div className="p-8 bg-muted/30 rounded-2xl border border-dashed border-border/50">
                      <Dumbbell className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground text-2xl font-semibold mb-2">No workout plans found matching your criteria.</p>
                      <p className="text-muted-foreground mt-2">Try adjusting your filters or create a custom plan</p>
                      {isAuthenticated && (
                        <Button
                          onClick={() => navigate('/create-plan')}
                          className="mt-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white px-6 py-2 rounded-full font-medium"
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Create Your First Plan
                        </Button>
                      )}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            </AnimatePresence>
          </TabsContent>

          <TabsContent value="progress">
            <ProgressLogger />
          </TabsContent>
        </Tabs>
      </div>

      {/* Modals */}
      <WorkoutPlanModal
        plan={activePlan}
        isOpen={!!activePlan}
        onClose={() => setActivePlan(null)}
        planCache={planCache}
        setPlanCache={setPlanCache}
      />

      <CustomPlanModal
        plan={activeCustomPlan}
        isOpen={!!activeCustomPlan}
        onClose={() => setActiveCustomPlan(null)}
      />
    </Layout>
  );
};

export default WorkoutsPage;