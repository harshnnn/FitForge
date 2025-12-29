import React, { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogClose } from "@/components/ui/dialog";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover';
import { DayPicker } from 'react-day-picker';
import 'react-day-picker/dist/style.css';
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Target, TrendingUp, Save, CheckCircle, Dumbbell, Clock, ChevronLeft, ChevronRight, Trash, Trophy, PartyPopper } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, XAxis, YAxis } from "recharts";
import ThreeScene from "@/components/ThreeScene";
import { useMuscleData } from "@/hooks/useMuscleData";
import { Skeleton } from "@/components/ui/skeleton";

// Minimal types used in this file
interface WorkoutPlan { id: string; name: string; days_per_week: number; description?: string }
interface CustomPlan { id: string; name: string; description?: string }
interface Exercise { id: string; name: string; image_url?: string; muscle_group?: string }
interface PlanExercise { id: string; exercise_id: string; sets: number; reps: string; exercise: Exercise }
interface CustomPlanExercise { id: string; exercise_id: string; sets: number; reps: string; exercise: Exercise }

interface ProgressEntry { exercise_id: string; planned_sets: number; planned_reps: string; set_details: { reps: number | null; weight: number | null }[]; notes: string }

const DAYS_OF_WEEK = [
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

const dayFromDate = (dateStr: string) => format(new Date(dateStr), 'eeee').toLowerCase();

export default function ProgressLogger() {
  const { isAuthenticated } = useAuth();
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [customPlans, setCustomPlans] = useState<CustomPlan[]>([]);
  const [preferredPlan, setPreferredPlan] = useState<{ type: 'standard'|'custom'|null; id: string | null }>({ type: null, id: null });
  const [showPreferredModal, setShowPreferredModal] = useState(false);
  const [settingPreferred, setSettingPreferred] = useState<string | null>(null);
  const [selectedPlanType, setSelectedPlanType] = useState<'standard' | 'custom' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | CustomPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [planExercises, setPlanExercises] = useState<(PlanExercise | CustomPlanExercise)[]>([]);
  const [activeExerciseTab, setActiveExerciseTab] = useState<string | null>(null);
  const tabListRef = React.useRef<HTMLDivElement | null>(null);
  const tabTriggerRefs = React.useRef<Record<string, HTMLButtonElement | null>>({});
  const [announce, setAnnounce] = useState('');
  const [prevActiveTab, setPrevActiveTab] = useState<string | null>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const lastActiveRef = React.useRef<string | null>(null);
  const [progressEntries, setProgressEntries] = useState<Record<string, ProgressEntry>>({});
  const [sessionNotes, setSessionNotes] = useState("");
  const [workoutDate, setWorkoutDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [loadingPlans, setLoadingPlans] = useState(false);
  const [loadingExercises, setLoadingExercises] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingExerciseId, setSavingExerciseId] = useState<string | null>(null);
  const [savedExercises, setSavedExercises] = useState<Record<string, boolean>>({});
  const [bestSetsByExercise, setBestSetsByExercise] = useState<Record<string, { weight: number | null; reps: number | null }[]>>({});
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const { prettify } = useMuscleData();
  const [activeMuscle, setActiveMuscle] = useState<string | null>(null);
  const [celebration, setCelebration] = useState<{ title: string; detail?: string } | null>(null);

  const celebratePersonalBest = (exerciseName: string) => {
    setCelebration({ title: 'New Personal Best!', detail: `${exerciseName} just surpassed your previous high.` });
  };

  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(() => setCelebration(null), 3200);
    return () => clearTimeout(t);
  }, [celebration]);

  const HistoryOverviewSkeleton = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="p-4 rounded-2xl border border-border/40 bg-muted/20 space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-3 w-28" />
        </div>
      ))}
    </div>
  );

  const HistoryTimelineSkeleton = () => (
    <div className="space-y-4">
      {Array.from({ length: 2 }).map((_, idx) => (
        <div key={idx} className="p-4 rounded-xl border border-border/40 bg-muted/10 space-y-3">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-32" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="p-3 rounded-lg border border-border/30 bg-background/60 space-y-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-10" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );

  const PlanSelectionSkeleton = () => (
    <Card className="mb-8 border-border/40 shadow-lg">
      <CardHeader>
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-64" />
      </CardHeader>
      <CardContent className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-2/3" />
      </CardContent>
    </Card>
  );

  const ExerciseLoadingSkeleton = () => (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, i) => (
          <Card key={i} className="border-border/40 shadow-sm">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );

  const progressData = useMemo(() => {
    const empty = {
      sessionRows: [] as any[],
      totals: { sessions: 0, volume: 0, sets: 0, reps: 0 },
      weeklyTrend: [] as any[],
      muscleStats: [] as any[],
      exerciseStats: [] as any[],
    };
    if (!sessions.length) return empty;

    const parseSetDetails = (raw: any) => {
      if (!raw) return [] as any[];
      if (typeof raw === 'string') {
        try { return JSON.parse(raw); } catch { return []; }
      }
      return Array.isArray(raw) ? raw : [];
    };

    const normalizeMuscle = (m?: string | null) => {
      const key = (m || 'other').toLowerCase();
      const alias: Record<string, string> = {
        quadriceps: 'quads', quadricep: 'quads', quads: 'quads', adductors: 'quads',
        calves: 'calves', calf: 'calves', hamstring: 'hamstrings',
        glute: 'glutes', gluteus: 'glutes',
        shoulders: 'side_delts', delts: 'side_delts',
        traps: 'upper_traps', trap: 'upper_traps',
        chest: 'chest_upper_left', upper_chest: 'chest_upper_left', lower_chest: 'chest_lower',
        lats: 'lats', back: 'lats', lower_back: 'lower_back',
        core: 'abs', abs: 'abs', obliques: 'obliques',
        triceps: 'triceps', biceps: 'biceps', forearms: 'forearms', shin: 'shin', serratus_anterior: 'serratus_anterior',
      };
      return alias[key] || key;
    };

    const sessionRows = sessions.map((s: any) => {
      const entries = (s.workout_progress_entries || []).map((e: any) => {
        const setDetails = parseSetDetails(e.set_details);
        const repsCompleted = typeof e.reps_completed === 'string'
          ? (() => { try { return JSON.parse(e.reps_completed); } catch { return []; } })()
          : (Array.isArray(e.reps_completed) ? e.reps_completed : []);
        const totalRepsFromSets = setDetails.reduce((acc: number, sd: any) => acc + (sd?.reps || 0), 0);
        const totalReps = totalRepsFromSets || (Array.isArray(repsCompleted) ? repsCompleted.reduce((a: number, b: number | null) => a + (b || 0), 0) : 0);
        const firstWeight = setDetails.find((sd: any) => sd?.weight !== null && sd?.weight !== undefined)?.weight ?? e.weight_used ?? 0;
        let volume = 0;
        setDetails.forEach((sd: any) => {
          const reps = sd?.reps ?? 0;
          const wt = sd?.weight ?? firstWeight ?? 0;
          volume += (reps || 0) * (wt || 0);
        });
        if (!volume && firstWeight && totalReps) volume = firstWeight * totalReps;

        return {
          ...e,
          setDetails,
          repsCompleted,
          totalReps,
          estimatedWeight: firstWeight || 0,
          volume,
          muscleKey: normalizeMuscle(e.exercise_muscle),
        };
      });

      const sessionVolume = entries.reduce((acc: number, curr: any) => acc + curr.volume, 0);
      const sessionSets = entries.reduce((acc: number, curr: any) => acc + (curr.actual_sets || curr.setDetails.length || 0), 0);
      const sessionReps = entries.reduce((acc: number, curr: any) => acc + curr.totalReps, 0);

      return { ...s, entries, sessionVolume, sessionSets, sessionReps };
    });

    const totals = sessionRows.reduce((acc: any, curr: any) => {
      acc.sessions += 1;
      acc.volume += curr.sessionVolume || 0;
      acc.sets += curr.sessionSets || 0;
      acc.reps += curr.sessionReps || 0;
      return acc;
    }, { sessions: 0, volume: 0, sets: 0, reps: 0 });

    const weeklyMap: Record<string, any> = {};
    sessionRows.forEach((sr: any) => {
      const date = new Date(sr.workout_date);
      const weekKey = format(date, 'yyyy-ww');
      if (!weeklyMap[weekKey]) {
        weeklyMap[weekKey] = { week: weekKey, label: format(date, 'MMM d'), volume: 0, sessions: 0, sets: 0 };
      }
      weeklyMap[weekKey].volume += sr.sessionVolume;
      weeklyMap[weekKey].sessions += 1;
      weeklyMap[weekKey].sets += sr.sessionSets;
    });
    const weeklyTrend = Object.values(weeklyMap).sort((a: any, b: any) => a.week.localeCompare(b.week));

    const muscleMap: Record<string, any> = {};
    sessionRows.forEach((sr: any) => {
      (sr.entries || []).forEach((en: any) => {
        const mk = en.muscleKey || 'other';
        if (!muscleMap[mk]) {
          muscleMap[mk] = { muscleKey: mk, label: prettify(mk), volume: 0, sets: 0, sessions: 0, bestWeight: 0 };
        }
        muscleMap[mk].volume += en.volume || 0;
        muscleMap[mk].sets += en.actual_sets || en.setDetails?.length || 0;
        muscleMap[mk].sessions += 1;
        muscleMap[mk].bestWeight = Math.max(muscleMap[mk].bestWeight, en.estimatedWeight || 0);
      });
    });
    const muscleStats = Object.values(muscleMap).sort((a: any, b: any) => b.volume - a.volume);

    const exerciseMap: Record<string, any> = {};
    sessionRows.forEach((sr: any) => {
      (sr.entries || []).forEach((en: any) => {
        const id = en.exercise_id;
        if (!exerciseMap[id]) {
          exerciseMap[id] = { exercise_id: id, name: en.exercise_name || id, volume: 0, sessions: 0, bestWeight: 0 };
        }
        exerciseMap[id].volume += en.volume || 0;
        exerciseMap[id].sessions += 1;
        exerciseMap[id].bestWeight = Math.max(exerciseMap[id].bestWeight, en.estimatedWeight || 0);
      });
    });
    const exerciseStats = Object.values(exerciseMap).sort((a: any, b: any) => b.volume - a.volume);

    return { sessionRows, totals, weeklyTrend, muscleStats, exerciseStats };
  }, [sessions, prettify]);

  useEffect(() => {
    const loadPlans = async () => {
      setLoadingPlans(true);
      try {
        const { data: plans } = await supabase.from('workout_plans').select('*').order('name');
        setWorkoutPlans(plans || []);

        if (isAuthenticated) {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: c } = await supabase.from('user_custom_plans').select('*').eq('user_id', user.id).order('name');
            setCustomPlans(c || []);
          }
          // load preferred plan from profile
          try {
            const { data: { user: u } } = await supabase.auth.getUser();
            if (u) {
              const { data: profile } = await supabase.from('profiles').select('preferred_workout_plan_type, preferred_workout_plan_id').eq('user_id', u.id).maybeSingle();
              const p: any = profile;
              if (p && p.preferred_workout_plan_id) {
                setPreferredPlan({ type: p.preferred_workout_plan_type === 'custom' ? 'custom' : 'standard', id: p.preferred_workout_plan_id });
              }
            }
          } catch (err) { /* noop */ }
        }
      } catch (err) {
        console.error(err);
      }
      setLoadingPlans(false);
    };
    loadPlans();
  }, [isAuthenticated]);

  const navigate = useNavigate();

  useEffect(() => {
    const loadSessions = async () => {
      if (!isAuthenticated || activeTab !== 'history') return;
      setLoadingSessions(true);
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return setSessions([]);

        const { data } = await supabase.from('workout_progress_sessions').select('*, workout_progress_entries(*)').eq('user_id', user.id).order('workout_date', { ascending: false });
        const sessionsData = data || [];

        const planIdsStd = Array.from(new Set(sessionsData.filter((s: any) => s.plan_type === 'standard').map((s: any) => s.plan_id)));
        const planIdsCust = Array.from(new Set(sessionsData.filter((s: any) => s.plan_type === 'custom').map((s: any) => s.plan_id)));
        const planMap: Record<string,string> = {};
        if (planIdsStd.length) { const { data: p } = await supabase.from('workout_plans').select('id,name').in('id', planIdsStd); (p||[]).forEach((x:any)=>planMap[x.id]=x.name); }
        if (planIdsCust.length) { const { data: p } = await supabase.from('user_custom_plans').select('id,name').in('id', planIdsCust); (p||[]).forEach((x:any)=>planMap[x.id]=x.name); }

        const exerciseIds = Array.from(new Set(sessionsData.flatMap((s:any) => (s.workout_progress_entries||[]).map((e:any)=>e.exercise_id))));
        const exerciseMap: Record<string,string> = {};
        if (exerciseIds.length) {
          const { data: ex } = await supabase.from('exercises').select('id,name,muscle_group').in('id', exerciseIds);
          (ex||[]).forEach((x:any)=>{ exerciseMap[x.id]=x.name; exerciseMap[`${x.id}__muscle`]=x.muscle_group; });
        }

        const mapped = sessionsData.map((s:any)=>({
          ...s,
          plan_name: planMap[s.plan_id] || (s.plan_type === 'custom' ? 'Custom Plan' : 'Standard Plan'),
          workout_progress_entries: (s.workout_progress_entries||[]).map((e:any)=>({ ...e, exercise_name: exerciseMap[e.exercise_id] || null, exercise_muscle: exerciseMap[`${e.exercise_id}__muscle`] || null }))
        }));

        setSessions(mapped);
      } catch (err) {
        console.error(err);
      }
      setLoadingSessions(false);
    };
    loadSessions();
  }, [isAuthenticated, activeTab]);

  useEffect(() => {
    if (!activeMuscle && progressData.muscleStats.length) {
      setActiveMuscle(progressData.muscleStats[0].muscleKey);
    }
  }, [activeMuscle, progressData.muscleStats]);

  useEffect(() => {
    const loadExercises = async () => {
      if (!selectedPlan || !selectedDay) { setPlanExercises([]); setBestSetsByExercise({}); setLoadingExercises(false); return; }
      setLoadingExercises(true);
      try {
        let data: any = [];
        if (selectedPlanType === 'standard') {
          const dayNumber = parseInt(selectedDay.replace('day_',''));
          const res = await supabase.from('workout_plan_exercises').select('*, exercise:exercises(*)').eq('workout_plan_id', selectedPlan.id).eq('day_number', dayNumber).order('id');
          data = res.data || [];
        } else if (selectedPlanType === 'custom') {
          const res = await supabase.from('user_custom_plan_exercises').select('*, exercise:exercises(*)').eq('user_custom_plan_id', selectedPlan.id).eq('day_of_week', selectedDay as any).order('id');
          data = res.data || [];
        }
        setPlanExercises(data);

        // init with plan defaults
        const initial: Record<string, ProgressEntry> = {};
        (data||[]).forEach((ex:any)=>{
          initial[ex.exercise_id] = { exercise_id: ex.exercise_id, planned_sets: ex.sets, planned_reps: ex.reps, set_details: Array.from({length: ex.sets}, ()=>({ reps: null, weight: null })), notes: '' };
        });

        let hydratedEntries: Record<string, ProgressEntry> = { ...initial };
        const hydratedSaved: Record<string, boolean> = {};

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const { data: session } = await supabase
              .from('workout_progress_sessions')
              .select('id, notes')
              .eq('user_id', user.id)
              .eq('plan_type', selectedPlanType)
              .eq('plan_id', (selectedPlan as any)?.id)
              .eq('day_identifier', selectedDay)
              .eq('workout_date', workoutDate)
              .maybeSingle();

            if (session?.id) {
              const { data: existingEntries } = await supabase
                .from('workout_progress_entries')
                .select('*')
                .eq('session_id', session.id);

              (existingEntries||[]).forEach((e:any)=>{
                const planEx = (data||[]).find((px:any)=>px.exercise_id===e.exercise_id);
                const plannedSets = planEx?.sets ?? e.planned_sets ?? 0;
                const plannedReps = planEx?.reps ?? e.planned_reps ?? '';
                let parsedDetails: any = e.set_details;
                if (typeof parsedDetails === 'string') {
                  try { parsedDetails = JSON.parse(parsedDetails); } catch { parsedDetails = []; }
                }
                if (!Array.isArray(parsedDetails)) parsedDetails = [];
                if (parsedDetails.length === 0 && plannedSets > 0) {
                  parsedDetails = Array.from({ length: plannedSets }, ()=>({ reps: null, weight: null }));
                }
                const hasAny = parsedDetails.some((s:any)=> (s?.reps !== null && s?.reps !== undefined) || (s?.weight !== null && s?.weight !== undefined));
                hydratedEntries[e.exercise_id] = {
                  exercise_id: e.exercise_id,
                  planned_sets: plannedSets,
                  planned_reps: plannedReps,
                  set_details: parsedDetails,
                  notes: e.notes || '',
                };
                if (hasAny) hydratedSaved[e.exercise_id] = true;
              });

              if (session.notes) setSessionNotes(session.notes);
            }

            // compute best-per-set across all prior sessions for current exercises
            const exerciseIds = (data||[]).map((ex:any)=>ex.exercise_id);
            const { data: userSessions } = await supabase
              .from('workout_progress_sessions')
              .select('id')
              .eq('user_id', user.id);

            const sessionIds = (userSessions||[]).map((s:any)=>s.id);
            if (exerciseIds.length && sessionIds.length) {
              const { data: priorEntries } = await supabase
                .from('workout_progress_entries')
                .select('exercise_id,set_details')
                .in('session_id', sessionIds)
                .in('exercise_id', exerciseIds);

              const bestMap: Record<string, { weight: number | null; reps: number | null }[]> = {};
              (priorEntries||[]).forEach((e:any)=>{
                let details = e.set_details;
                if (typeof details === 'string') {
                  try { details = JSON.parse(details); } catch { details = []; }
                }
                if (!Array.isArray(details)) details = [];
                details.forEach((sd:any, idx:number)=>{
                  const weight = sd?.weight ?? null;
                  const reps = sd?.reps ?? null;
                  const score = (weight || 0) * (reps || 0);
                  if (!bestMap[e.exercise_id]) bestMap[e.exercise_id] = [];
                  const current = bestMap[e.exercise_id][idx];
                  const currentScore = current ? ((current.weight || 0) * (current.reps || 0)) : -1;
                  if (score > currentScore) {
                    bestMap[e.exercise_id][idx] = { weight, reps };
                  }
                });
              });
              setBestSetsByExercise(bestMap);
            } else {
              setBestSetsByExercise({});
            }
          }
        } catch (hydrationErr) {
          console.error(hydrationErr);
        }

        setProgressEntries(hydratedEntries);
        setSavedExercises(hydratedSaved);

        // set default active exercise tab to first exercise
        if ((data||[]).length > 0) setActiveExerciseTab(data[0].exercise_id);
      } catch (err) {
        console.error(err);
      }
      setLoadingExercises(false);
    };
    loadExercises();
  }, [selectedPlan, selectedDay, selectedPlanType]);

  // keep custom plan day in sync with selected date, while allowing manual override
  useEffect(()=>{
    if (!selectedPlan || selectedPlanType !== 'custom') return;
    const derivedDay = dayFromDate(workoutDate);
    if (DAYS_OF_WEEK.find(d=>d.value===derivedDay) && derivedDay !== selectedDay) {
      setSelectedDay(derivedDay);
    }
  }, [workoutDate, selectedPlan, selectedPlanType]);

  // detect overflow for chevrons
  useEffect(()=>{
    const el = tabListRef.current;
    if (!el) return;
    const computeInnerWidth = (container: HTMLElement) => {
      const inner = container.querySelector(':scope > div') as HTMLElement | null;
      let innerWidth = container.scrollWidth;
      if (inner) {
        try {
          const cs = getComputedStyle(inner);
          const ml = parseFloat(cs.marginLeft || '0') || 0;
          const mr = parseFloat(cs.marginRight || '0') || 0;
          innerWidth = Math.max(0, inner.scrollWidth - Math.abs(ml) - Math.abs(mr));
        } catch (e) {
          innerWidth = container.scrollWidth;
        }
      }
      return innerWidth;
    };

    const check = ()=>{
      // measure inner content width excluding outer negative margins (sticky inner row uses -mx-6)
      const innerWidth = computeInnerWidth(el);
      const diff = innerWidth - el.clientWidth;
      const overflowing = diff > 8; // treat as overflow only if inner content exceeds container by >8px
      setHasOverflow(overflowing);
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft + el.clientWidth < innerWidth - 6);
    };
    check();
    const onScroll = ()=>{
      const innerW = computeInnerWidth(el);
      setCanScrollLeft(el.scrollLeft > 6);
      setCanScrollRight(el.scrollLeft + el.clientWidth < innerW - 6);
    };
    window.addEventListener('resize', check);
    el.addEventListener('scroll', onScroll);
    return ()=>{ window.removeEventListener('resize', check); el.removeEventListener('scroll', onScroll); };
  }, [planExercises, activeExerciseTab]);

  // announce active tab change for accessibility & track prev for animation direction
  useEffect(()=>{
    if (!activeExerciseTab) return;
    const name = planExercises.find(p=>p.exercise_id===activeExerciseTab)?.exercise?.name || '';
    setAnnounce(`${name} selected`);
    // update previous active ref (used to derive animation direction)
    setPrevActiveTab(lastActiveRef.current);
    lastActiveRef.current = activeExerciseTab;
    // focus corresponding trigger when programmatically changed
    const ref = tabTriggerRefs.current[activeExerciseTab];
    if (ref) ref.focus();
  }, [activeExerciseTab, planExercises]);

  const scrollTabsBy = (amount: number) => {
    const el = tabListRef.current; if (!el) return; el.scrollBy({ left: amount, behavior: 'smooth' });
  };

  const scrollToStart = () => { const el = tabListRef.current; if (!el) return; el.scrollTo({ left: 0, behavior: 'smooth' }); };
  const scrollToEnd = () => { const el = tabListRef.current; if (!el) return; el.scrollTo({ left: el.scrollWidth, behavior: 'smooth' }); };

  const handleTabsKeyDown = (e: React.KeyboardEvent) => {
    const keys = ['ArrowRight','ArrowLeft','Home','End'];
    if (!keys.includes(e.key)) return;
    e.preventDefault();
    const ids = planExercises.map(p=>p.exercise_id);
    const active = activeExerciseTab || ids[0];
    const idx = Math.max(0, ids.indexOf(active));
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = Math.min(ids.length-1, idx+1);
    if (e.key === 'ArrowLeft') nextIdx = Math.max(0, idx-1);
    if (e.key === 'Home') nextIdx = 0;
    if (e.key === 'End') nextIdx = ids.length-1;
    const nextId = ids[nextIdx];
    if (nextId) setActiveExerciseTab(nextId);
  };

  // auto-select preferred plan when available and user is on Log tab
  useEffect(()=>{
    if (activeTab !== 'log') return;
    if (!preferredPlan.id || !preferredPlan.type) return;
    // try to find preferred in loaded lists
    if (preferredPlan.type === 'custom') {
      const found = customPlans.find(p=>p.id===preferredPlan.id);
      if (found) {
        setSelectedPlanType('custom'); setSelectedPlan(found);
        const derivedDay = dayFromDate(workoutDate);
        setSelectedDay(DAYS_OF_WEEK.find(d=>d.value===derivedDay)?.value || 'monday');
      }
    } else {
      const found = workoutPlans.find(p=>p.id===preferredPlan.id);
      if (found) {
        setSelectedPlanType('standard'); setSelectedPlan(found);
        setSelectedDay('day_1');
      }
    }
  }, [preferredPlan, workoutPlans, customPlans, activeTab]);

  const setPreferredPlanHandler = async (type: 'standard'|'custom', id: string) => {
    setSettingPreferred(id);
    const prev = { ...preferredPlan };
    setPreferredPlan({ type, id });
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authenticated');
      const { data: existing, error: selectErr } = await supabase.from('profiles').select('id,gender').eq('user_id', user.id).maybeSingle();
      if (selectErr) throw selectErr;
      if (existing) {
        const { error } = await supabase.from('profiles').update({ preferred_workout_plan_type: type, preferred_workout_plan_id: id } as any).eq('user_id', user.id);
        if (error) throw error;
      } else {
        const placeholderGender = 'male';
        const { error } = await supabase.from('profiles').insert({ user_id: user.id, gender: placeholderGender, preferred_workout_plan_type: type, preferred_workout_plan_id: id } as any);
        if (error) throw error;
      }
      toast.success('Preferred program saved');
      // apply selection into logger
      if (type === 'custom') {
        const found = customPlans.find(p=>p.id===id);
        if (found) { setSelectedPlanType('custom'); setSelectedPlan(found); setSelectedDay('monday'); }
      } else {
        const found = workoutPlans.find(p=>p.id===id);
        if (found) { setSelectedPlanType('standard'); setSelectedPlan(found); setSelectedDay('day_1'); }
      }
    } catch (err:any) {
      console.error(err);
      setPreferredPlan(prev);
      toast.error(err?.message || 'Failed to set preferred program');
    } finally {
      setSettingPreferred(null);
      setShowPreferredModal(false);
    }
  };

  const availableDays = useMemo(()=>{
    if (!selectedPlan) return [] as {value:string,label:string}[];
    if (selectedPlanType === 'standard') return Array.from({length: (selectedPlan as WorkoutPlan).days_per_week}, (_,i)=>({ value: `day_${i+1}`, label: `Day ${i+1}` }));
    return DAYS_OF_WEEK;
  }, [selectedPlan, selectedPlanType]);

  const handlePlanSelect = (type: 'standard'|'custom', plan: any) => {
    setSelectedPlanType(type);
    setSelectedPlan(plan);
    if (type === 'custom') {
      const derivedDay = dayFromDate(workoutDate);
      setSelectedDay(DAYS_OF_WEEK.find(d=>d.value===derivedDay)?.value || '');
    } else {
      setSelectedDay('');
    }
    setPlanExercises([]);
    setProgressEntries({});
    setSavedExercises({});
    setBestSetsByExercise({});
  };

  const updateSetDetail = (exerciseId: string, idx: number, delta: { reps?: number | null; weight?: number | null }) => {
    setProgressEntries(prev=>{
      const cur = prev[exerciseId]; if (!cur) return prev; const details = [...(cur.set_details||[])]; details[idx] = { ...details[idx], ...delta }; return { ...prev, [exerciseId]: { ...cur, set_details: details } };
    });
    setSavedExercises(prev => { const next = { ...prev }; delete next[exerciseId]; return next; });
  };

  const addSetToExercise = (exerciseId: string) => {
    setProgressEntries(prev=>{ const cur = prev[exerciseId]; if (!cur) return prev; const details=[...(cur.set_details||[])]; details.push({ reps: null, weight: null }); return { ...prev, [exerciseId]: { ...cur, set_details: details } }; });
    setSavedExercises(prev => { const next = { ...prev }; delete next[exerciseId]; return next; });
  };

  const findOrCreateSession = async (userId: string) => {
    const { data: existingSessions, error: findErr } = await supabase
      .from('workout_progress_sessions')
      .select('*')
      .eq('user_id', userId)
      .eq('plan_type', selectedPlanType)
      .eq('plan_id', (selectedPlan as any)?.id)
      .eq('day_identifier', selectedDay)
      .eq('workout_date', workoutDate)
      .limit(1);

    if (findErr) throw findErr;
    if (existingSessions && existingSessions.length > 0) {
      return existingSessions[0].id as string;
    }

    const { data: insertedSession, error: sessionError } = await supabase
      .from('workout_progress_sessions')
      .insert({
        user_id: userId,
        plan_type: selectedPlanType,
        plan_id: (selectedPlan as any)?.id,
        day_identifier: selectedDay,
        workout_date: workoutDate,
        notes: sessionNotes.trim() || null,
      })
      .select()
      .single();

    if (sessionError) throw sessionError;
    return insertedSession.id as string;
  };

  const handleSaveExercise = async (exerciseId: string) => {
    if (!selectedPlan || !selectedDay || !selectedPlanType) { toast.error('Select plan/day'); return; }
    const entry = progressEntries[exerciseId];
    if (!entry) { toast.error('Exercise not found in plan'); return; }
    const setDetails = entry.set_details || [];
    const hasAny = setDetails.some(s=> (s.reps !== null && s.reps !== undefined) || (s.weight !== null && s.weight !== undefined));
    if (!hasAny) { toast.error('Log at least one set for this exercise'); return; }

    const bestForExercise = bestSetsByExercise[exerciseId] || [];
    const hasNewBest = setDetails.some((sd, idx) => {
      const score = (sd.weight || 0) * (sd.reps || 0);
      const prev = (bestForExercise[idx]?.weight || 0) * (bestForExercise[idx]?.reps || 0);
      return score > prev && score > 0;
    });

    setSavingExerciseId(exerciseId);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authed');
      const sessionId = await findOrCreateSession(user.id);

      await supabase.from('workout_progress_entries').delete().eq('session_id', sessionId).eq('exercise_id', exerciseId);

      const repsArray = setDetails.map(s => s.reps === null ? null : s.reps);
      const lastWeight = setDetails.slice().reverse().find(s => s.weight !== null && s.weight !== undefined)?.weight ?? null;

      const payload = {
        session_id: sessionId,
        exercise_id: entry.exercise_id,
        planned_sets: entry.planned_sets,
        planned_reps: entry.planned_reps,
        actual_sets: setDetails.filter(s => s.reps !== null && s.reps !== undefined).length,
        weight_used: lastWeight,
        weight_unit: 'kg',
        reps_completed: JSON.stringify(repsArray),
        set_details: JSON.stringify(setDetails),
        notes: entry.notes?.trim() || null,
      };

      const { error: insertErr } = await supabase.from('workout_progress_entries').insert(payload);
      if (insertErr) throw insertErr;

      if (hasNewBest) {
        setBestSetsByExercise(prev => {
          const next = { ...prev } as Record<string, { weight: number | null; reps: number | null }[]>;
          const current = next[exerciseId] ? [...next[exerciseId]] : [];
          setDetails.forEach((sd, idx) => {
            const score = (sd.weight || 0) * (sd.reps || 0);
            const prevScore = ((current[idx]?.weight || 0) * (current[idx]?.reps || 0));
            if (score > prevScore) {
              current[idx] = { weight: sd.weight ?? null, reps: sd.reps ?? null };
            }
          });
          next[exerciseId] = current;
          return next;
        });
        const exerciseName = planExercises.find(ex => ex.exercise_id === exerciseId)?.exercise?.name || 'Exercise';
        celebratePersonalBest(exerciseName);
      }

      setSavedExercises(prev => ({ ...prev, [exerciseId]: true }));
      toast.success('Exercise saved');
    } catch (err:any) {
      console.error(err);
      toast.error(err?.message || 'Failed to save exercise');
    }
    setSavingExerciseId(null);
  };

  const handleDeleteSession = async (sessionId: string) => {
    const confirmed = window.confirm('Clear this logged session? This removes all sets for that day.');
    if (!confirmed) return;
    setDeletingSessionId(sessionId);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authed');

      const { error: entriesErr } = await supabase.from('workout_progress_entries').delete().eq('session_id', sessionId);
      if (entriesErr) throw entriesErr;

      const { error: sessionErr } = await supabase.from('workout_progress_sessions').delete().eq('id', sessionId).eq('user_id', user.id);
      if (sessionErr) throw sessionErr;

      setSessions(prev => prev.filter(s => s.id !== sessionId));
      toast.success('Session cleared');
    } catch (err:any) {
      console.error(err);
      toast.error(err?.message || 'Failed to clear session');
    }
    setDeletingSessionId(null);
  };

  const handleSaveProgress = async () => {
    if (!selectedPlan || !selectedDay || !selectedPlanType) { toast.error('Select plan/day'); return; }
    const has = Object.values(progressEntries).some(p=> (p.set_details||[]).some(s=> s.reps !== null || s.weight !== null));
    if (!has) { toast.error('Please log at least one set'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authed');
      const sessionId = await findOrCreateSession(user.id);

      // 2) Remove any existing entries for that session (so we replace them)
      const { error: deleteErr } = await supabase
        .from('workout_progress_entries')
        .delete()
        .eq('session_id', sessionId);

      if (deleteErr) throw deleteErr;

      // 3) Insert the new entries mapped from progressEntries (ensure set_details is JSON)
      const entriesToInsert = Object.values(progressEntries)
        .map(entry => {
          const setDetails = entry.set_details || [];
          const repsArray = setDetails.map(s => s.reps === null ? null : s.reps);
          const lastWeight = setDetails.slice().reverse().find(s => s.weight !== null && s.weight !== undefined)?.weight ?? null;
          const hasAny = setDetails.some(s => (s.reps !== null && s.reps !== undefined) || (s.weight !== null && s.weight !== undefined));
          return {
            session_id: sessionId,
            exercise_id: entry.exercise_id,
            planned_sets: entry.planned_sets,
            planned_reps: entry.planned_reps,
            actual_sets: setDetails.filter(s => s.reps !== null && s.reps !== undefined).length,
            weight_used: lastWeight,
            weight_unit: 'kg',
            reps_completed: JSON.stringify(repsArray),
            set_details: JSON.stringify(setDetails), // stored in JSONB column
            notes: entry.notes?.trim() || null,
            __shouldInsert: hasAny,
          };
        })
        .filter((e: any) => e.__shouldInsert)
        .map((e: any) => {
          const copy = { ...e };
          delete copy.__shouldInsert;
          return copy;
        });

      if (entriesToInsert.length > 0) {
        const { error: entriesError } = await supabase
          .from('workout_progress_entries')
          .insert(entriesToInsert);

        if (entriesError) throw entriesError;
      }

      toast.success('Progress saved');
      setProgressEntries({}); setSessionNotes(''); setSelectedPlan(null); setSelectedPlanType(null); setSelectedDay(''); setPlanExercises([]); setSavedExercises({});
    } catch (err:any) { console.error(err); toast.error(err?.message || 'Save failed'); }
    setSaving(false);
  };

  if (!isAuthenticated) return (<Layout><div className="container mx-auto px-4 py-8 text-center"><h1 className="text-2xl font-bold">Progress Logging</h1><p className="text-muted-foreground">Please log in</p></div></Layout>);

  return (
    <Layout>

      <AnimatePresence>
        {celebration && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="pointer-events-none fixed top-6 left-0 right-0 z-50 flex justify-center px-4"
          >
            <div className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-primary/30 bg-background/95 shadow-2xl ring-1 ring-primary/20 backdrop-blur-md">
              <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.18),transparent_35%)]" aria-hidden />
              <div className="flex items-center gap-3 px-4 py-3">
                <div className="p-2 rounded-full bg-primary/20 border border-primary/30 text-primary">
                  <PartyPopper className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold text-primary">{celebration.title}</div>
                  {celebration.detail && <div className="text-sm text-muted-foreground">{celebration.detail}</div>}
                </div>
                <Badge variant="secondary" className="bg-primary text-primary-foreground shadow-sm border-primary/60">Personal Best</Badge>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ARIA live region for announcing active exercise changes to screen readers */}
      <div aria-live="polite" className="sr-only" role="status">{announce}</div>

      <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-accent rounded-full"><TrendingUp className="w-8 h-8"/></div></div>
          <h1 className="text-4xl font-bold mb-2">Log Your Progress</h1>
          <p className="text-muted-foreground">Track your workout progress and see your gains over time</p>
        </div>

      <div className="container mx-auto max-w-6xl px-4 py-8">
        <div className="flex justify-center mb-8 px-2">
          <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-full bg-muted/20 p-1 w-full sm:w-auto">
            <button className={`px-6 py-2 rounded-full font-semibold flex-1 sm:flex-none ${activeTab==='log'?'bg-background text-primary shadow':'text-muted-foreground'}`} onClick={()=>setActiveTab('log')}>Log Progress</button>
            <button className={`px-6 py-2 rounded-full font-semibold flex-1 sm:flex-none ${activeTab==='history'?'bg-background text-primary shadow':'text-muted-foreground'}`} onClick={()=>setActiveTab('history')}>Progress</button>
          </div>
        </div>

        {activeTab==='history' ? (
          <div className="space-y-8">
            <Card className="border-border/40 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5"/> Progress Overview</CardTitle>
                <CardDescription>High-level stats from your logged sessions</CardDescription>
              </CardHeader>
              <CardContent>
                {loadingSessions ? (
                  <HistoryOverviewSkeleton />
                ) : progressData.sessionRows.length === 0 ? (
                  <div className="text-center py-8">No sessions yet. Log a workout to see insights.</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
                      <div className="text-xs uppercase text-primary font-semibold mb-1">Sessions</div>
                      <div className="text-3xl font-bold">{progressData.totals.sessions}</div>
                      <p className="text-xs text-muted-foreground mt-1">Logged workouts</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-secondary/10 to-secondary/5 border border-secondary/20">
                      <div className="text-xs uppercase text-secondary font-semibold mb-1">Volume (kg·reps)</div>
                      <div className="text-3xl font-bold">{Math.round(progressData.totals.volume)}</div>
                      <p className="text-xs text-muted-foreground mt-1">Total mechanical work</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-amber-100/20 to-amber-50/10 border border-amber-200/60 dark:from-amber-900/20 dark:to-amber-800/10">
                      <div className="text-xs uppercase text-amber-600 font-semibold mb-1">Sets</div>
                      <div className="text-3xl font-bold">{progressData.totals.sets}</div>
                      <p className="text-xs text-muted-foreground mt-1">Across all exercises</p>
                    </div>
                    <div className="p-4 rounded-2xl bg-gradient-to-br from-emerald-100/20 to-emerald-50/10 border border-emerald-200/60 dark:from-emerald-900/20 dark:to-emerald-800/10">
                      <div className="text-xs uppercase text-emerald-600 font-semibold mb-1">Reps</div>
                      <div className="text-3xl font-bold">{progressData.totals.reps}</div>
                      <p className="text-xs text-muted-foreground mt-1">Tracked total repetitions</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {loadingSessions ? (
              <Card className="border-border/40 shadow-lg lg:col-span-3">
                <CardContent className="py-8 space-y-4">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-[260px] w-full" />
                </CardContent>
              </Card>
            ) : progressData.sessionRows.length > 0 && (
              <div className="grid lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 border-border/40 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><TrendingUp className="w-5 h-5"/> Weekly Volume</CardTitle>
                    <CardDescription>Volume and set count grouped by training week</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="-mx-2 px-2 overflow-x-auto">
                      <ChartContainer
                        config={{
                          volume: { label: "Volume", color: "hsl(var(--primary))" },
                          sets: { label: "Sets", color: "hsl(var(--secondary))" },
                        }}
                        className="h-[260px] sm:h-[300px] md:h-[320px] min-w-[320px] sm:min-w-[420px] md:min-w-[520px] w-full"
                      >
                        <AreaChart data={progressData.weeklyTrend}>
                          <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                          <XAxis dataKey="label" tickLine={false} axisLine={false} />
                          <YAxis tickLine={false} axisLine={false} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Area type="monotone" dataKey="volume" stroke="var(--color-volume)" fill="var(--color-volume)" fillOpacity={0.2} />
                          <Line type="monotone" dataKey="sets" stroke="var(--color-sets)" strokeWidth={2} dot={false} />
                        </AreaChart>
                      </ChartContainer>
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-border/40 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Dumbbell className="w-5 h-5"/> Top Exercises</CardTitle>
                    <CardDescription>Ranked by total volume moved</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3 overflow-x-auto -mx-1 px-1 min-w-0 w-full">
                    {progressData.exerciseStats.slice(0,6).map((ex:any, idx:number)=> (
                      <div key={ex.exercise_id} className="p-3 rounded-xl border border-border/50 bg-muted/20">
                        <div className="flex items-center justify-between gap-2">
                          <div>
                            <div className="text-sm font-semibold">{idx+1}. {ex.name}</div>
                            <div className="text-xs text-muted-foreground">{ex.sessions} sessions • Best {ex.bestWeight || 0} kg</div>
                          </div>
                          <div className="text-right font-mono text-sm">{Math.round(ex.volume)} vol</div>
                        </div>
                        <div className="mt-2 h-2 rounded-full bg-muted">
                          <div className="h-2 rounded-full bg-gradient-to-r from-primary to-secondary" style={{ width: `${Math.min(100, (ex.volume / (progressData.exerciseStats[0]?.volume || 1)) * 100)}%` }} />
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </div>
            )}

            {loadingSessions ? (
              <Card className="border-border/40 shadow-lg">
                <CardContent className="space-y-4 py-6">
                  <Skeleton className="h-6 w-40" />
                  <Skeleton className="h-[340px] w-full" />
                  <div className="space-y-2">
                    {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
                  </div>
                </CardContent>
              </Card>
            ) : progressData.muscleStats.length > 0 && (
              <Card className="border-border/40 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5"/> Muscle Focus</CardTitle>
                  <CardDescription>See where your training volume is concentrated</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid lg:grid-cols-2 gap-6 items-start">
                    <div className="border border-border/50 rounded-2xl overflow-hidden bg-muted/20">
                      <div className="h-[340px]">
                        <ThreeScene
                          gender="male"
                          selectedMuscles={activeMuscle ? [activeMuscle] : []}
                          onMuscleSelect={(key) => setActiveMuscle(key)}
                          className="w-full h-full"
                        />
                      </div>
                      {activeMuscle && (
                        <div className="p-4 border-t border-border/60 bg-background/70">
                          <div className="text-sm text-muted-foreground">Focused Muscle</div>
                          <div className="text-xl font-semibold">{prettify(activeMuscle)}</div>
                          <div className="flex gap-4 text-sm mt-2">
                            <span>Volume: {Math.round((progressData.muscleStats.find((m:any)=>m.muscleKey===activeMuscle)?.volume) || 0)}</span>
                            <span>Best: {progressData.muscleStats.find((m:any)=>m.muscleKey===activeMuscle)?.bestWeight || 0} kg</span>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-3">
                      {progressData.muscleStats.map((m:any)=> (
                        <button key={m.muscleKey} onClick={()=>setActiveMuscle(m.muscleKey)} className={`w-full text-left p-3 rounded-xl border transition ${activeMuscle===m.muscleKey ? 'border-primary ring-1 ring-primary/40 bg-primary/5' : 'border-border/50 hover:border-primary/40'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-semibold">{m.label}</div>
                              <div className="text-xs text-muted-foreground">{m.sessions} sessions • {m.sets} sets</div>
                            </div>
                            <div className="text-sm font-mono">{Math.round(m.volume)} vol</div>
                          </div>
                          <div className="mt-2 h-2 rounded-full bg-muted">
                            <div className="h-2 rounded-full bg-gradient-to-r from-secondary to-primary" style={{ width: `${Math.min(100, (m.volume / (progressData.muscleStats[0]?.volume || 1)) * 100)}%` }} />
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {loadingSessions ? (
              <Card className="border-border/40 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Session Timeline</CardTitle>
                  <CardDescription>Detailed log of your latest sessions</CardDescription>
                </CardHeader>
                <CardContent>
                  <HistoryTimelineSkeleton />
                </CardContent>
              </Card>
            ) : progressData.sessionRows.length > 0 && (
              <Card className="border-border/40 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/> Session Timeline</CardTitle>
                  <CardDescription>Detailed log of your latest sessions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 overflow-x-auto -mx-2 px-2">
                  {progressData.sessionRows.map((s:any)=> (
                    <div key={s.id} className="p-4 rounded-xl border border-border/50 bg-muted/10">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold">{s.plan_name}</div>
                          <div className="text-xs text-muted-foreground">{s.day_identifier} • {s.workout_date}</div>
                        </div>
                        <div className="flex items-center gap-3 text-sm w-full sm:w-auto sm:justify-end flex-wrap">
                          <span className="font-mono">{Math.round(s.sessionVolume)} vol</span>
                          <span className="text-muted-foreground">{s.sessionSets} sets</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 w-full sm:w-auto justify-center"
                            onClick={()=>handleDeleteSession(s.id)}
                            disabled={deletingSessionId===s.id}
                          >
                            {deletingSessionId===s.id ? 'Clearing...' : <><Trash className="w-4 h-4 mr-1"/>Clear</>}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2">
                        {(s.entries||[]).map((e:any)=> (
                          <div key={e.id} className="p-3 rounded-lg border border-border/50 bg-background/80">
                            <div className="flex justify-between text-sm font-semibold">
                              <span>{e.exercise_name || e.exercise_id}</span>
                              <span className="font-mono">{e.volume ? Math.round(e.volume) : 0} vol</span>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">Sets: {e.actual_sets || e.setDetails?.length || 0} • Best {e.estimatedWeight || 0} kg</div>
                            {e.setDetails?.length ? (
                              <div className="mt-2 text-xs space-y-1">
                                {e.setDetails.map((sd:any, idx:number)=>(
                                  <div key={idx} className="flex justify-between"><span>Set {idx+1}</span><span className="font-mono">{sd.weight ?? '—'} kg × {sd.reps ?? '—'}</span></div>
                                ))}
                              </div>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        ) : null}

        {activeTab === 'log' ? (

        <>
        {loadingPlans ? (
          <PlanSelectionSkeleton />
        ) : (
          <Card className="mb-8 border-border/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Target className="w-5 h-5"/> Select Workout Plan</CardTitle>
              <CardDescription>Choose the plan you followed today</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 mb-4">
                {/* Preferred plan preview / CTA */}
                {preferredPlan.id ? (
                  <Card className="p-3 border-primary/20 ring-1 ring-primary/10">
                    <CardContent className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div>
                        <div className="text-sm text-muted-foreground">Logging into</div>
                        <div className="text-lg font-extrabold">{(preferredPlan.type === 'custom' ? customPlans.find(p=>p.id===preferredPlan.id)?.name : workoutPlans.find(p=>p.id===preferredPlan.id)?.name) || 'Preferred Program'}</div>
                        <div className="text-sm text-muted-foreground">You can change this below</div>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                        <Button variant="outline" onClick={()=>setShowPreferredModal(true)} className="w-full sm:w-auto">Change</Button>
                        <Button variant="ghost" onClick={()=>navigate('/workouts')} className="w-full sm:w-auto">Browse plans</Button>
                      </div>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border border-dashed rounded">
                    <div>
                      <div className="text-sm text-muted-foreground">No preferred program</div>
                      <div className="text-lg font-extrabold">Select a preferred program to log into by default</div>
                    </div>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                      <Button onClick={()=>setShowPreferredModal(true)} className="bg-gradient-to-r from-purple-600 to-pink-600 w-full sm:w-auto">Choose Preferred</Button>
                      <Button variant="ghost" onClick={()=>navigate('/workouts')} className="w-full sm:w-auto">Browse all</Button>
                    </div>
                  </div>
                )}
              </div>

            </CardContent>
          </Card>
        )}

        {selectedPlan && (
          <Card className="mb-8 border-border/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/>{(selectedPlan as any).name} - Log Progress</CardTitle>
              <CardDescription>Select the day you worked out and log your performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="workout-date">Workout Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button id="workout-date" className="mt-1 flex items-center w-full rounded-md border px-3 py-2 text-left hover:border-primary focus:outline-none focus:ring-2 focus:ring-primary">
                        <div className="flex-1">
                          <div className="text-sm">{format(new Date(workoutDate), 'PPP')}</div>
                        </div>
                        <Calendar className="w-5 h-5 text-muted-foreground ml-2" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent side="bottom" align="start" className="w-auto p-0">
                      <div className="p-4">
                        <DayPicker
                          mode="single"
                          selected={new Date(workoutDate)}
                          onSelect={(d)=>{ if (d) { setWorkoutDate(format(d,'yyyy-MM-dd')); } }}
                        />
                        <div className="flex justify-between mt-2">
                          <button type="button" className="text-sm text-muted-foreground px-2 py-1 rounded hover:bg-muted" onClick={()=>{ const t=new Date(); setWorkoutDate(format(t,'yyyy-MM-dd')); }}>
                            Today
                          </button>
                          <div className="flex gap-2">
                            <button type="button" className="text-sm text-muted-foreground px-2 py-1 rounded hover:bg-muted" onClick={()=>{ setWorkoutDate(format(new Date(),'yyyy-MM-dd')); }}>
                              Apply
                            </button>
                            <button type="button" className="text-sm text-red-600 px-2 py-1 rounded hover:bg-red-50" onClick={()=>{ setWorkoutDate(format(new Date(),'yyyy-MM-dd')); }}>
                              Close
                            </button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label htmlFor="day-select">Day of Plan</Label>
                  <Select value={selectedDay} onValueChange={setSelectedDay}><SelectTrigger className="mt-1"><SelectValue placeholder="Select day..."/></SelectTrigger><SelectContent>{availableDays.map(d=> <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}</SelectContent></Select>
                </div>
              </div>

              {selectedDay && (
                <div className="space-y-6">
                  {loadingExercises ? <ExerciseLoadingSkeleton /> : planExercises.length>0 ? (
                    <>
                      <h3 className="text-xl font-semibold">Exercises Completed</h3>
                      <div>
                        {/* Mobile fallback: Select for small screens */}
                        <div className="md:hidden mb-4">
                          <Select value={activeExerciseTab || undefined} onValueChange={(v)=>setActiveExerciseTab(v || null)}>
                            <SelectTrigger className="w-full"><SelectValue placeholder="Select exercise..."/></SelectTrigger>
                            <SelectContent>
                              {planExercises.map(ex=> <SelectItem key={ex.exercise_id} value={ex.exercise_id}>{(ex as any).exercise.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>

                        {/* scrollbar styles live in src/styles/custom-scrollbar.css; show scrollbar only when overflowing */}

                        <div className="hidden md:flex items-center gap-2 group">
                          {hasOverflow ? (
                            <button aria-hidden onClick={()=>scrollTabsBy(-240)} className={`p-2 rounded-md ${canScrollLeft ? 'hover:bg-muted text-foreground' : 'opacity-40 cursor-not-allowed'}`} disabled={!canScrollLeft}><ChevronLeft className="w-5 h-5"/></button>
                          ) : <div className="w-9" />}
                          <div ref={tabListRef} onKeyDown={handleTabsKeyDown} role="tablist" aria-label="Exercises" className={`flex-1 ${hasOverflow ? 'overflow-x-auto prog-tab-scroll' : 'overflow-x-hidden'}`}>
                            <div className="sticky top-0 bg-background/60 backdrop-blur-sm z-10 flex gap-2 p-4 rounded-md items-center overflow-auto" style={{ display: 'flex' }}>
                              {planExercises.map((exercise)=> {
                                const prog = progressEntries[exercise.exercise_id];
                                const loggedSets = prog ? (prog.set_details || []).filter((s:any)=> s.reps !== null || s.weight !== null).length : 0;
                                const plannedSets = (exercise as any).sets || 0;
                                const completed = loggedSets >= plannedSets && plannedSets > 0;
                                return (
                                  <button
                                    key={exercise.exercise_id}
                                    ref={el=> tabTriggerRefs.current[exercise.exercise_id]=el}
                                    role="tab"
                                    aria-selected={activeExerciseTab===exercise.exercise_id}
                                    aria-controls={`panel-${exercise.exercise_id}`}
                                    onClick={()=>setActiveExerciseTab(exercise.exercise_id)}
                                    className={`min-w-[11rem] px-3 py-2 rounded-md hover:bg-muted/40 dark:hover:bg-muted/30 flex items-center gap-3 ${activeExerciseTab===exercise.exercise_id ? 'ring-2 ring-primary' : ''}`}
                                  >
                                    <img src={(exercise as any).exercise.image_url || `https://via.placeholder.com/48/111827/FFFFFF?text=${encodeURIComponent(((exercise as any).exercise.name||'').charAt(0) || '')}`} alt={(exercise as any).exercise.name} className="w-10 h-10 rounded-md object-cover border" />
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium text-sm truncate">{(exercise as any).exercise.name}</div>
                                      <div className="text-xs text-muted-foreground flex items-center justify-between">
                                        <span>Planned: {(exercise as any).sets}×{(exercise as any).reps}</span>
                                        <div className="flex items-center gap-2">
                                          <span className="ml-2 text-xs font-medium text-primary">{loggedSets}/{plannedSets}</span>
                                          {completed && <span className="text-green-600" aria-hidden><CheckCircle className="w-4 h-4"/></span>}
                                        </div>
                                      </div>
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                          {hasOverflow ? (
                            <button aria-hidden onClick={()=>scrollTabsBy(240)} className={`p-2 rounded-md ${canScrollRight ? 'hover:bg-muted text-foreground' : 'opacity-40 cursor-not-allowed'}`} disabled={!canScrollRight}><ChevronRight className="w-5 h-5"/></button>
                          ) : <div className="w-9" />}
                        </div>

                        <div className="mt-4">
                          <AnimatePresence initial={false} mode="wait">
                            {planExercises.map((exercise)=>{
                              const progress = progressEntries[exercise.exercise_id]; if (!progress) return null;
                              const isActive = activeExerciseTab === exercise.exercise_id;
                              if (!isActive) return null;
                              // determine direction using index
                              const ids = planExercises.map(p=>p.exercise_id);
                              const dir = prevActiveTab && ids.indexOf(activeExerciseTab || '') < ids.indexOf(prevActiveTab) ? -1 : 1;
                              return (
                                <motion.div key={exercise.exercise_id} id={`panel-${exercise.exercise_id}`} role="tabpanel" aria-labelledby={exercise.exercise_id}
                                  initial={{ opacity: 0, x: 20 * dir }}
                                  animate={{ opacity: 1, x: 0 }}
                                  exit={{ opacity: 0, x: -20 * dir }}
                                  transition={{ duration: 0.22 }}
                                >
                                  <Card><CardContent className="p-4 sm:p-6">
                                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-4">
                                      <div className="flex items-start gap-4 flex-1">
                                        <img src={(exercise as any).exercise.image_url || `https://via.placeholder.com/80/000000/FFFFFF?text=${(exercise as any).exercise.name?.charAt(0)||''}`} alt={(exercise as any).exercise.name} className="w-20 h-20 rounded-lg object-cover border"/>
                                        <div className="flex-1">
                                          <h4 className="text-lg font-semibold">{(exercise as any).exercise.name}</h4>
                                          <p className="text-sm text-muted-foreground capitalize">{((exercise as any).exercise.muscle_group||'').replace('_',' ')}</p>
                                          <div className="flex gap-2 mt-2"><Badge variant="outline">Planned: {(exercise as any).sets} sets × {(exercise as any).reps} reps</Badge></div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 sm:self-start">
                                        {savedExercises[exercise.exercise_id] && (
                                          <Badge variant="secondary" className="border-emerald-200 text-emerald-700 bg-emerald-50">Saved</Badge>
                                        )}
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={()=>handleSaveExercise(exercise.exercise_id)}
                                          disabled={savingExerciseId===exercise.exercise_id || saving}
                                        >
                                          {savingExerciseId===exercise.exercise_id ? 'Saving...' : (<><Save className="w-4 h-4 mr-2"/>Save exercise</>)}
                                        </Button>
                                      </div>
                                    </div>

                                    <div className="space-y-3">{(progress.set_details||[]).map((s, idx)=> {
                                      const best = bestSetsByExercise[exercise.exercise_id]?.[idx];
                                      const bestWeight = typeof best?.weight === 'number' ? best.weight : null;
                                      const bestReps = typeof best?.reps === 'number' ? best.reps : null;
                                      const bestScore = (bestWeight || 0) * (bestReps || 0);
                                      const currentScore = (s.weight || 0) * (s.reps || 0);
                                      const ahead = bestScore > 0 && currentScore > bestScore;
                                      const toBeat = Math.max(0, bestScore - currentScore);

                                      return (
                                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                                          <div className="sm:col-span-2"><Label>Set {idx+1}</Label></div>
                                          <div className="sm:col-span-3"><Label htmlFor={`weight-${exercise.exercise_id}-${idx}`}>Weight</Label><Input id={`weight-${exercise.exercise_id}-${idx}`} inputMode="decimal" type="number" step="0.5" value={s.weight ?? ''} onChange={(e)=> updateSetDetail(exercise.exercise_id, idx, { weight: e.target.value ? parseFloat(e.target.value) : null })} className="mt-1"/></div>
                                          <div className="sm:col-span-3"><Label htmlFor={`reps-${exercise.exercise_id}-${idx}`}>Reps</Label><Input id={`reps-${exercise.exercise_id}-${idx}`} inputMode="numeric" type="number" min={0} value={s.reps ?? ''} onChange={(e)=> updateSetDetail(exercise.exercise_id, idx, { reps: e.target.value ? parseInt(e.target.value) : null })} className="mt-1"/></div>
                                          <div className="sm:col-span-3">
                                            <div className="h-full rounded-md border border-primary/25 bg-primary/5 dark:bg-primary/10 px-3 py-2 flex flex-col gap-1">
                                              <div className="flex items-center gap-1 text-[11px] font-semibold text-primary uppercase tracking-wide">
                                                <Trophy className="w-4 h-4"/>Personal best
                                              </div>
                                              <div className="text-sm font-mono text-foreground font-semibold">
                                                {bestWeight ?? '—'} kg × {bestReps ?? '—'}
                                              </div>
                                              {bestScore === 0 && <div className="text-[11px] text-muted-foreground">Log this set to set your first benchmark.</div>}
                                            </div>
                                          </div>
                                          <div className="sm:col-span-1 flex sm:justify-end">{idx===(progress.set_details||[]).length-1 && <Button size="sm" onClick={()=>addSetToExercise(exercise.exercise_id)} className="mt-1 w-full sm:w-auto">Add Set</Button>}</div>
                                        </div>
                                      );
                                    })}</div>

                                    <div className="mt-4"><Label htmlFor={`notes-${exercise.exercise_id}`}>Exercise Notes (Optional)</Label><Textarea id={`notes-${exercise.exercise_id}`} value={progress.notes} onChange={(e)=> { setProgressEntries(prev=>({ ...prev, [exercise.exercise_id]: { ...prev[exercise.exercise_id], notes: e.target.value } })); setSavedExercises(prev => { const next = { ...prev }; delete next[exercise.exercise_id]; return next; }); }} rows={2} className="mt-1"/></div>

                                  </CardContent></Card>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div><Label htmlFor="session-notes">Session Notes (Optional)</Label><Textarea id="session-notes" value={sessionNotes} onChange={(e)=>setSessionNotes(e.target.value)} placeholder="Overall thoughts..." rows={3} className="mt-1"/></div>

                      <div className="flex justify-end md:justify-end sticky bottom-4 md:static z-20">
                        <div className="w-full md:w-auto bg-background/90 md:bg-transparent backdrop-blur supports-[backdrop-filter]:backdrop-blur rounded-xl border md:border-0 px-3 py-2 md:px-0 md:py-0 shadow-sm md:shadow-none">
                          <Button onClick={handleSaveProgress} disabled={saving} className="w-full md:w-auto bg-gradient-to-r from-green-600 to-green-700">{saving? 'Saving...' : <><Save className="w-4 h-4 mr-2"/> Save Progress</>}</Button>
                        </div>
                      </div>
                    </>
                  ) : <div className="text-center py-8"><Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4"/><p className="text-muted-foreground">No exercises found for this day.</p></div>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Preferred selection modal */}
        <Dialog open={showPreferredModal} onOpenChange={setShowPreferredModal}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto p-6">
              <h3 className="text-xl font-bold mb-4">Choose Preferred Program</h3>
              <div className="space-y-6">
                {/* Custom Plans Section (only show if any) */}
                {customPlans.length > 0 && (
                  <section>
                    <h4 className="text-lg font-semibold mb-3">Your Custom Plans</h4>
                    <div className="grid md:grid-cols-2 gap-4">
                      {customPlans.map(p => (
                        <Card key={p.id} className={`cursor-pointer ${preferredPlan.id===p.id && preferredPlan.type==='custom' ? 'ring-2 ring-primary' : ''}`} onClick={()=>setPreferredPlanHandler('custom', p.id)}>
                          <CardContent>
                            <div className="flex justify-between items-center"><div><h4 className="font-semibold">{p.name}</h4><p className="text-sm text-muted-foreground">Custom plan</p></div><div>{preferredPlan.id===p.id && preferredPlan.type==='custom' && <CheckCircle className="w-5 h-5 text-primary"/>}</div></div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </section>
                )}

                {/* Standard Plans Section */}
                <section>
                  <h4 className="text-lg font-semibold mb-3">Standard Plans</h4>
                  <div className="grid md:grid-cols-2 gap-4">
                    {workoutPlans.map(p => (
                      <Card key={p.id} className={`cursor-pointer ${preferredPlan.id===p.id && preferredPlan.type==='standard' ? 'ring-2 ring-primary' : ''}`} onClick={()=>setPreferredPlanHandler('standard', p.id)}>
                        <CardContent>
                          <div className="flex justify-between items-center"><div><h4 className="font-semibold">{p.name}</h4><p className="text-sm text-muted-foreground">{p.days_per_week} days/week</p></div><div>{preferredPlan.id===p.id && preferredPlan.type==='standard' && <CheckCircle className="w-5 h-5 text-primary"/>}</div></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>

                

                <div className="flex justify-end mt-2"><Button variant="ghost" onClick={()=>setShowPreferredModal(false)}>Close</Button></div>
              </div>
            </DialogContent>
        </Dialog>

        </>

        ) : null}
      </div>
    </Layout>
  );
}