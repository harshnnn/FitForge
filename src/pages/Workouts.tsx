// src/pages/Workouts.tsx (or your file path)
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, Target, X, Star, Video, Zap, Moon, Plus, User, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import "../styles/custom-scrollbar.css";

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
      <DialogContent className="max-w-5xl h-full w-full p-0 overflow-hidden bg-background rounded-3xl shadow-2xl border-0 custom-scrollbar">
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
              <div className="z-20 bg-background/95 backdrop-blur-sm p-6 m-6 flex gap-3 overflow-x-auto border-b border-border/30" style={{ marginLeft: '2rem', marginRight: '2rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
                {daysWithExercises.map((day) => (
                  <Button
                    key={day}
                    variant={activeDay === day ? "default" : "outline"}
                    className={`rounded-full px-6 py-3 font-bold transition-all duration-300 text-base whitespace-nowrap shadow-md ${activeDay === day ? "bg-primary text-primary-foreground shadow-primary/30 scale-105" : "border-border/60 bg-background hover:bg-muted/50 hover:border-primary/60"}`}
                    onClick={() => setActiveDay(day)}
                  >
                    Day {day}
                  </Button>
                ))}
              </div>
            </div>
            
            {/* Scrollable content area for plan details */}
            
            <div className="px-10 pt-8 pb-10 max-h-[75vh] overflow-y-auto flex flex-col justify-start custom-scrollbar" style={{ minHeight: '450px' }}>
              


              {loading ? (
                <PlanDetailSkeleton />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDay}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center"
                    style={{ minHeight: '350px' }}
                  >
                    {isRestDay ? (
                      <div className="flex flex-col items-center justify-center gap-4 w-full h-full py-20 rounded-2xl bg-gradient-to-br from-secondary/10 via-muted/50 to-background/90 text-center border-2 border-dashed border-secondary/50 shadow-inner">
                        <Moon className="w-20 h-20 text-secondary mb-4 animate-bounce-slow" />
                        <h3 className="text-4xl font-extrabold text-secondary mb-3 tracking-tight">Rest Day</h3>
                        <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">Recovery is crucial. Let your muscles rebuild and come back even stronger tomorrow.<br />Enjoy some light stretching, walking, or meditation.</p>
                      </div>
                    ) : (
                      <div className="w-full mt-80">
                        <div className="mb-6 text-center">
                          <h4 className="text-2xl font-bold text-primary mb-2">Day {activeDay} Workout</h4>
                          <p className="text-muted-foreground">{exercisesForActiveDay.length} Exercise{exercisesForActiveDay.length > 1 ? "s" : ""} • Focus on proper form and controlled movements</p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                          {exercisesForActiveDay.map((pe) => (
                            <ExerciseCard key={pe.id} planExercise={pe} />
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              )}
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
          .order("day_of_week", { ascending: true });
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

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()} modal={true}>
      <DialogContent className="max-w-5xl w-full p-0 overflow-hidden bg-background rounded-3xl shadow-2xl border-0 custom-scrollbar">
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
            </div>

            <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm pb-6 mb-6 flex gap-3 overflow-x-auto custom-scrollbar border-b border-border/30" style={{ marginLeft: '-2rem', marginRight: '-2rem', paddingLeft: '2rem', paddingRight: '2rem' }}>
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

            <div className="px-10 pt-8 pb-10 max-h-[75vh] overflow-y-auto flex flex-col justify-start custom-scrollbar" style={{ minHeight: '450px' }}>
              {loading ? (
                <PlanDetailSkeleton />
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeDay}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -15 }}
                    transition={{ duration: 0.3 }}
                    className="flex items-center justify-center"
                    style={{ minHeight: '350px' }}
                  >
                    {isRestDay ? (
                      <div className="flex flex-col items-center justify-center gap-4 w-full h-full py-20 rounded-2xl bg-gradient-to-br from-secondary/10 via-muted/50 to-background/90 text-center border-2 border-dashed border-secondary/50 shadow-inner">
                        <Moon className="w-20 h-20 text-secondary mb-4 animate-bounce-slow" />
                        <h3 className="text-4xl font-extrabold text-secondary mb-3 tracking-tight">Rest Day</h3>
                        <p className="text-muted-foreground max-w-lg text-lg leading-relaxed">Recovery is crucial. Let your muscles rebuild and come back even stronger tomorrow.<br />Enjoy some light stretching, walking, or meditation.</p>
                      </div>
                    ) : (
                      <div className="w-full">
                        <div className="mb-6 text-center">
                          <h4 className="text-2xl font-bold text-primary mb-2">
                            {DAYS_OF_WEEK.find(d => d.value === activeDay)?.label} Workout
                          </h4>
                          <p className="text-muted-foreground">
                            {exercisesForActiveDay.length} Exercise{exercisesForActiveDay.length > 1 ? "s" : ""} • Focus on proper form and controlled movements
                          </p>
                        </div>
                        <div className="grid md:grid-cols-2 gap-6">
                          {exercisesForActiveDay.map((pe) => (
                            <motion.div
                              key={pe.id}
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
                                    src={pe.exercise.image_url || `https://via.placeholder.com/150/000000/FFFFFF?text=${pe.exercise.name.charAt(0)}`}
                                    alt={pe.exercise.name}
                                    className="w-24 h-24 rounded-lg object-cover border-2 border-primary/20 shadow-md"
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
                                      <Video className="w-4 h-4" /> Watch Demo
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
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);
  const [activePlan, setActivePlan] = useState<WorkoutPlan | null>(null);
  const [activeCustomPlan, setActiveCustomPlan] = useState<CustomPlan | null>(null);

  // 7. ⭐ Performance: Simple client-side cache for plan details
  const [planCache, setPlanCache] = useState<Record<string, PlanExercise[]>>({});

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
            className="grid md:grid-cols-2 lg:grid-cols-3 gap-10"
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
                <Card className="flex flex-col border-0 shadow-xl hover:shadow-2xl transition-all duration-300 rounded-3xl bg-gradient-to-br from-yellow-50 via-background to-yellow-50/50 dark:from-yellow-950/20 dark:via-background dark:to-yellow-950/20 overflow-hidden group">
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
                    <Button className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white transition-all duration-200 font-bold py-3 rounded-full shadow-lg hover:shadow-xl group-hover:scale-105" onClick={() => setActiveCustomPlan(plan)}>
                      <Eye className="w-5 h-5 mr-3" /> View Plan
                    </Button>
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
                    <Button className="w-full bg-gradient-accent hover:opacity-90 transition-all duration-200 font-bold py-3 rounded-full shadow-lg hover:shadow-xl group-hover:scale-105" onClick={() => setActivePlan(plan)}>
                      <Dumbbell className="w-5 h-5 mr-3" /> View Plan Details
                    </Button>
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