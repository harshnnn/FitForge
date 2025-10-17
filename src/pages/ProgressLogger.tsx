import React, { useEffect, useMemo, useState } from "react";
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
  const [selectedPlanType, setSelectedPlanType] = useState<'standard' | 'custom' | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | CustomPlan | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>("");
  const [planExercises, setPlanExercises] = useState<(PlanExercise | CustomPlanExercise)[]>([]);
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
        }
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadPlans();
  }, [isAuthenticated]);

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
          const res = await supabase.from('user_custom_plan_exercises').select('*, exercise:exercises(*)').eq('user_custom_plan_id', selectedPlan.id).eq('day_of_week', selectedDay).order('id');
          data = res.data || [];
        }
        setPlanExercises(data);

        // init progress entries
        const initial: Record<string, ProgressEntry> = {};
        (data||[]).forEach((ex:any)=>{
          initial[ex.exercise_id] = { exercise_id: ex.exercise_id, planned_sets: ex.sets, planned_reps: ex.reps, set_details: Array.from({length: ex.sets}, ()=>({ reps: null, weight: null })), notes: '' };
        });
        setProgressEntries(initial);
      } catch (err) {
        console.error(err);
      }
      setLoading(false);
    };
    loadExercises();
  }, [selectedPlan, selectedDay, selectedPlanType]);

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
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold mb-4">Standard Plans</h3>
                <div className="space-y-3">{workoutPlans.map(p=> <Card key={p.id} className={`cursor-pointer ${selectedPlan?.id===p.id && selectedPlanType==='standard' ? 'ring-2 ring-primary' : ''}`} onClick={()=>handlePlanSelect('standard', p)}><CardContent><div className="flex justify-between"><div><h4 className="font-semibold">{p.name}</h4><p className="text-sm text-muted-foreground">{p.days_per_week} days/week</p></div>{selectedPlan?.id===p.id && selectedPlanType==='standard' && <CheckCircle className="w-5 h-5 text-primary"/>}</div></CardContent></Card>)}</div>
              </div>
              <div>
                <h3 className="text-lg font-semibold mb-4">Your Custom Plans</h3>
                <div className="space-y-3">{customPlans.length ? customPlans.map(p=> <Card key={p.id} className={`cursor-pointer ${selectedPlan?.id===p.id && selectedPlanType==='custom' ? 'ring-2 ring-primary' : ''}`} onClick={()=>handlePlanSelect('custom', p)}><CardContent><div className="flex justify-between"><div><h4 className="font-semibold">{p.name}</h4><p className="text-sm text-muted-foreground">{p.description || 'Custom workout plan'}</p></div>{selectedPlan?.id===p.id && selectedPlanType==='custom' && <CheckCircle className="w-5 h-5 text-primary"/>}</div></CardContent></Card>) : <p className="text-muted-foreground text-center py-8">No custom plans yet.</p>}</div>
              </div>
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
                  <Input id="workout-date" type="date" value={workoutDate} onChange={(e)=>setWorkoutDate(e.target.value)} className="mt-1" />
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
                      <div className="space-y-4">{planExercises.map((exercise)=>{
                        const progress = progressEntries[exercise.exercise_id]; if (!progress) return null;
                        return (
                          <Card key={exercise.id}><CardContent className="p-6">
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
                        );
                      })}</div>

                      <div><Label htmlFor="session-notes">Session Notes (Optional)</Label><Textarea id="session-notes" value={sessionNotes} onChange={(e)=>setSessionNotes(e.target.value)} placeholder="Overall thoughts..." rows={3} className="mt-1"/></div>

                      <div className="flex justify-end"><Button onClick={handleSaveProgress} disabled={saving} className="bg-gradient-to-r from-green-600 to-green-700">{saving? 'Saving...' : <><Save className="w-4 h-4 mr-2"/> Save Progress</>}</Button></div>
                    </>
                  ) : <div className="text-center py-8"><Dumbbell className="w-12 h-12 text-muted-foreground mx-auto mb-4"/><p className="text-muted-foreground">No exercises found for this day.</p></div>}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        </>

        ) : null}
      </div>
    </Layout>
  );
}