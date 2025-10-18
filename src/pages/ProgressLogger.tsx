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
import { Calendar, Target, TrendingUp, Save, CheckCircle, Dumbbell, Clock, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from 'framer-motion';
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { format } from "date-fns";

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
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'log' | 'history'>('log');
  const [sessions, setSessions] = useState<any[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  useEffect(() => {
    const loadPlans = async () => {
      setLoading(true);
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
      setLoading(false);
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
        if (exerciseIds.length) { const { data: ex } = await supabase.from('exercises').select('id,name').in('id', exerciseIds); (ex||[]).forEach((x:any)=>exerciseMap[x.id]=x.name); }

        const mapped = sessionsData.map((s:any)=>({
          ...s,
          plan_name: planMap[s.plan_id] || (s.plan_type === 'custom' ? 'Custom Plan' : 'Standard Plan'),
          workout_progress_entries: (s.workout_progress_entries||[]).map((e:any)=>({ ...e, exercise_name: exerciseMap[e.exercise_id] || null }))
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
    const loadExercises = async () => {
      if (!selectedPlan || !selectedDay) return setPlanExercises([]);
      setLoading(true);
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

        // init progress entries
        const initial: Record<string, ProgressEntry> = {};
        (data||[]).forEach((ex:any)=>{
          initial[ex.exercise_id] = { exercise_id: ex.exercise_id, planned_sets: ex.sets, planned_reps: ex.reps, set_details: Array.from({length: ex.sets}, ()=>({ reps: null, weight: null })), notes: '' };
        });
        setProgressEntries(initial);
        // set default active exercise tab to first exercise
        if ((data||[]).length > 0) setActiveExerciseTab(data[0].exercise_id);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadExercises();
  }, [selectedPlan, selectedDay, selectedPlanType]);

  // detect overflow for chevrons
  useEffect(()=>{
    const el = tabListRef.current;
    if (!el) return;
    const check = ()=>{
      const overflowing = el.scrollWidth > el.clientWidth + 2;
      setHasOverflow(overflowing);
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
    };
    check();
    const onScroll = ()=>{
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
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
        // default day
        setSelectedDay('monday');
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

  const handlePlanSelect = (type: 'standard'|'custom', plan: any) => { setSelectedPlanType(type); setSelectedPlan(plan); setSelectedDay(''); setPlanExercises([]); setProgressEntries({}); };

  const updateSetDetail = (exerciseId: string, idx: number, delta: { reps?: number | null; weight?: number | null }) => {
    setProgressEntries(prev=>{
      const cur = prev[exerciseId]; if (!cur) return prev; const details = [...(cur.set_details||[])]; details[idx] = { ...details[idx], ...delta }; return { ...prev, [exerciseId]: { ...cur, set_details: details } };
    });
  };

  const addSetToExercise = (exerciseId: string) => {
    setProgressEntries(prev=>{ const cur = prev[exerciseId]; if (!cur) return prev; const details=[...(cur.set_details||[])]; details.push({ reps: null, weight: null }); return { ...prev, [exerciseId]: { ...cur, set_details: details } }; });
  };

  const handleSaveProgress = async () => {
    if (!selectedPlan || !selectedDay || !selectedPlanType) { toast.error('Select plan/day'); return; }
    const has = Object.values(progressEntries).some(p=> (p.set_details||[]).some(s=> s.reps !== null || s.weight !== null));
    if (!has) { toast.error('Please log at least one set'); return; }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser(); if (!user) throw new Error('Not authed');

      // 1) Try to find an existing session for this user/plan/day/date
      const { data: existingSessions, error: findErr } = await supabase
        .from('workout_progress_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('plan_type', selectedPlanType)
        .eq('plan_id', selectedPlan.id)
        .eq('day_identifier', selectedDay)
        .eq('workout_date', workoutDate)
        .limit(1);

      if (findErr) throw findErr;

      let sessionId: string;

      if (existingSessions && existingSessions.length > 0) {
        // reuse the existing session
        sessionId = existingSessions[0].id;
        // Optionally update session notes/updated_at if you want:
        // await supabase.from('workout_progress_sessions').update({ notes: sessionNotes || null }).eq('id', sessionId);
      } else {
        // create a new session
        const { data: insertedSession, error: sessionError } = await supabase
          .from('workout_progress_sessions')
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
        sessionId = insertedSession.id;
      }

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
      setProgressEntries({}); setSessionNotes(''); setSelectedPlan(null); setSelectedPlanType(null); setSelectedDay(''); setPlanExercises([]);
    } catch (err:any) { console.error(err); toast.error(err?.message || 'Save failed'); }
    setSaving(false);
  };

  if (!isAuthenticated) return (<Layout><div className="container mx-auto px-4 py-8 text-center"><h1 className="text-2xl font-bold">Progress Logging</h1><p className="text-muted-foreground">Please log in</p></div></Layout>);

  return (
    <Layout>

      {/* ARIA live region for announcing active exercise changes to screen readers */}
      <div aria-live="polite" className="sr-only" role="status">{announce}</div>

      <div className="text-center mb-8">
          <div className="flex justify-center mb-4"><div className="p-4 bg-gradient-accent rounded-full"><TrendingUp className="w-8 h-8"/></div></div>
          <h1 className="text-4xl font-bold mb-2">Log Your Progress</h1>
          <p className="text-muted-foreground">Track your workout progress and see your gains over time</p>
        </div>

      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-center mb-8">
          <div className="inline-flex rounded-full bg-muted/20 p-1">
            <button className={`px-6 py-2 rounded-full font-semibold ${activeTab==='log'?'bg-background text-primary shadow':'text-muted-foreground'}`} onClick={()=>setActiveTab('log')}>Log Progress</button>
            <button className={`px-6 py-2 rounded-full font-semibold ${activeTab==='history'?'bg-background text-primary shadow':'text-muted-foreground'}`} onClick={()=>setActiveTab('history')}>Progress</button>
          </div>
        </div>

        {activeTab==='history' ? (
          <Card className="mb-8 border-border/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Clock className="w-5 h-5"/> Progress</CardTitle>
              <CardDescription>Review past sessions</CardDescription>
            </CardHeader>
            <CardContent>
              {loadingSessions? <div className="text-center py-8">Loading...</div> : sessions.length===0 ? <div className="text-center py-8">No sessions</div> : (
                <div className="space-y-4">{sessions.map(s=> (
                  <Card key={s.id}><CardContent>
                    <div className="flex justify-between"><div><h4 className="font-semibold">{s.plan_name}</h4><p className="text-sm text-muted-foreground">{s.day_identifier} • {s.workout_date}</p></div><div className="text-right"><p className="text-sm">{s.workout_date}</p></div></div>
                    <div className="mt-4 space-y-2">{(s.workout_progress_entries||[]).map((e:any)=> (
                      <div key={e.id} className="p-3 border rounded bg-muted/10">
                        <div className="flex justify-between"><div><p className="font-semibold">{e.exercise_name || e.exercise_id}</p><p className="text-sm text-muted-foreground">Planned: {e.planned_sets} × {e.planned_reps}</p></div><div className="text-right"><p className="font-semibold">{e.actual_sets} sets</p><p className="text-sm text-muted-foreground">{e.weight_used ? `${e.weight_used} ${e.weight_unit}` : 'No weight'}</p></div></div>
                        {e.set_details ? (()=>{ try { const sd = typeof e.set_details === 'string' ? JSON.parse(e.set_details) : e.set_details; return <div className="mt-2 space-y-1">{sd.map((it:any, i:number)=>(<div key={i} className="text-sm">Set {i+1}: {it.weight ?? '—'} kg • reps: {it.reps ?? '—'}</div>))}</div> } catch(err){ return null } })() : (e.reps_completed && <p className="text-sm mt-2">Reps: {JSON.parse(e.reps_completed).join(', ')}</p>)}
                      </div>
                    ))}</div>
                  </CardContent></Card>
                ))}</div>
              )}
            </CardContent>
          </Card>
        ) : null}

        {activeTab === 'log' ? (

        <>
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
                  <CardContent className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">Logging into</div>
                      <div className="text-lg font-extrabold">{(preferredPlan.type === 'custom' ? customPlans.find(p=>p.id===preferredPlan.id)?.name : workoutPlans.find(p=>p.id===preferredPlan.id)?.name) || 'Preferred Program'}</div>
                      <div className="text-sm text-muted-foreground">You can change this below</div>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="outline" onClick={()=>setShowPreferredModal(true)}>Change</Button>
                      <Button variant="ghost" onClick={()=>navigate('/workouts')}>Browse plans</Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <div className="flex items-center justify-between p-3 border border-dashed rounded">
                  <div>
                    <div className="text-sm text-muted-foreground">No preferred program</div>
                    <div className="text-lg font-extrabold">Select a preferred program to log into by default</div>
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={()=>setShowPreferredModal(true)} className="bg-gradient-to-r from-purple-600 to-pink-600">Choose Preferred</Button>
                    <Button variant="ghost" onClick={()=>navigate('/workouts')}>Browse all</Button>
                  </div>
                </div>
              )}
            </div>

          </CardContent>
        </Card>

        {selectedPlan && (
          <Card className="mb-8 border-border/40 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Calendar className="w-5 h-5"/>{(selectedPlan as any).name} - Log Progress</CardTitle>
              <CardDescription>Select the day you worked out and log your performance</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
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
                  {loading ? <div className="text-center py-8">Loading exercises...</div> : planExercises.length>0 ? (
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

                        <style>{`
                          /* thin professional scrollbar for tab list */
                          .prog-tab-scroll::-webkit-scrollbar { height: 8px; }
                          .prog-tab-scroll::-webkit-scrollbar-track { background: transparent; }
                          .prog-tab-scroll::-webkit-scrollbar-thumb { background: rgba(100,100,100,0.25); border-radius: 9999px; }
                          .prog-tab-scroll::-webkit-scrollbar-thumb:hover { background: rgba(100,100,100,0.4); }
                          /* firefox */
                          .prog-tab-scroll { scrollbar-width: thin; scrollbar-color: rgba(100,100,100,0.25) transparent; }
                        `}</style>

                        <div className="hidden md:flex items-center gap-2 group">
                          {hasOverflow ? (
                            <button aria-hidden onClick={()=>scrollTabsBy(-240)} className={`p-2 rounded-md ${canScrollLeft ? 'hover:bg-muted text-foreground' : 'opacity-40 cursor-not-allowed'}`} disabled={!canScrollLeft}><ChevronLeft className="w-5 h-5"/></button>
                          ) : <div className="w-9" />}
                          <div ref={tabListRef} onKeyDown={handleTabsKeyDown} role="tablist" aria-label="Exercises" className="flex-1 overflow-x-auto prog-tab-scroll">
                            <div className="sticky top-0 bg-background/60 backdrop-blur-sm z-10 flex gap-2 pb-2 -mx-6 px-6" style={{ display: 'flex' }}>
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
                                  <Card><CardContent className="p-6">
                                    <div className="flex items-start gap-4 mb-4"><img src={(exercise as any).exercise.image_url || `https://via.placeholder.com/80/000000/FFFFFF?text=${(exercise as any).exercise.name?.charAt(0)||''}`} alt={(exercise as any).exercise.name} className="w-20 h-20 rounded-lg object-cover border"/><div className="flex-1"><h4 className="text-lg font-semibold">{(exercise as any).exercise.name}</h4><p className="text-sm text-muted-foreground capitalize">{((exercise as any).exercise.muscle_group||'').replace('_',' ')}</p><div className="flex gap-2 mt-2"><Badge variant="outline">Planned: {(exercise as any).sets} sets × {(exercise as any).reps} reps</Badge></div></div></div>

                                    <div className="space-y-3">{(progress.set_details||[]).map((s, idx)=> (
                                      <div key={idx} className="grid grid-cols-12 gap-3 items-end">
                                        <div className="col-span-2"><Label>Set {idx+1}</Label></div>
                                        <div className="col-span-4"><Label htmlFor={`weight-${exercise.exercise_id}-${idx}`}>Weight</Label><Input id={`weight-${exercise.exercise_id}-${idx}`} type="number" step="0.5" value={s.weight ?? ''} onChange={(e)=> updateSetDetail(exercise.exercise_id, idx, { weight: e.target.value ? parseFloat(e.target.value) : null })} className="mt-1"/></div>
                                        <div className="col-span-4"><Label htmlFor={`reps-${exercise.exercise_id}-${idx}`}>Reps</Label><Input id={`reps-${exercise.exercise_id}-${idx}`} type="number" min={0} value={s.reps ?? ''} onChange={(e)=> updateSetDetail(exercise.exercise_id, idx, { reps: e.target.value ? parseInt(e.target.value) : null })} className="mt-1"/></div>
                                        <div className="col-span-2">{idx===(progress.set_details||[]).length-1 && <Button size="sm" onClick={()=>addSetToExercise(exercise.exercise_id)} className="mt-1">Add Set</Button>}</div>
                                      </div>
                                    ))}</div>

                                    <div className="mt-4"><Label htmlFor={`notes-${exercise.exercise_id}`}>Exercise Notes (Optional)</Label><Textarea id={`notes-${exercise.exercise_id}`} value={progress.notes} onChange={(e)=> setProgressEntries(prev=>({ ...prev, [exercise.exercise_id]: { ...prev[exercise.exercise_id], notes: e.target.value } }))} rows={2} className="mt-1"/></div>

                                  </CardContent></Card>
                                </motion.div>
                              );
                            })}
                          </AnimatePresence>
                        </div>
                      </div>

                      <div><Label htmlFor="session-notes">Session Notes (Optional)</Label><Textarea id="session-notes" value={sessionNotes} onChange={(e)=>setSessionNotes(e.target.value)} placeholder="Overall thoughts..." rows={3} className="mt-1"/></div>

                      <div className="flex justify-end"><Button onClick={handleSaveProgress} disabled={saving} className="bg-gradient-to-r from-green-600 to-green-700">{saving? 'Saving...' : <><Save className="w-4 h-4 mr-2"/> Save Progress</>}</Button></div>
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