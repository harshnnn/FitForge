import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { toast } from "sonner";
import { Calendar, Clipboard, Download, Link2, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface SharedPlanExercise {
  day_of_week: Tables<"user_custom_plan_exercises">["Row"]["day_of_week"];
  sets: number;
  reps: string;
  notes?: string | null;
  exercise_id?: string | null;
  exercise_name?: string | null;
  muscle_group?: string | null;
  image_url?: string | null;
  exercise_description?: string | null;
}

interface SharedPlanSnapshot {
  name: string;
  description?: string | null;
  exercises: SharedPlanExercise[];
}

const ImportPlan = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();
  const [tokenInput, setTokenInput] = useState(() => searchParams.get("token") || "");
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [snapshot, setSnapshot] = useState<SharedPlanSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);

  const exercisesByDay = useMemo(() => {
    if (!snapshot) return {} as Record<string, SharedPlanExercise[]>;
    return snapshot.exercises.reduce<Record<string, SharedPlanExercise[]>>((acc, ex) => {
      if (!acc[ex.day_of_week]) acc[ex.day_of_week] = [];
      acc[ex.day_of_week].push(ex);
      return acc;
    }, {});
  }, [snapshot]);

  const loadSharedPlan = async (token: string) => {
    if (!token.trim()) {
      setError("Enter a share code to continue");
      setSnapshot(null);
      return;
    }
    setLoading(true);
    setError(null);
    setSnapshot(null);
    try {
      const { data, error: fetchError } = await supabase
        .from("shared_custom_plan_links")
        .select("plan_snapshot, expires_at")
        .eq("token", token.trim())
        .maybeSingle();

      if (fetchError) throw fetchError;
      if (!data) {
        setError("Link not found. Ask the owner for a fresh share link.");
        return;
      }

      if (data.expires_at && new Date(data.expires_at) < new Date()) {
        setError("This share link has expired.");
        return;
      }

      const parsed = data.plan_snapshot as SharedPlanSnapshot;
      if (!parsed?.name || !Array.isArray(parsed.exercises)) {
        setError("Invalid share payload.");
        return;
      }

      setSnapshot(parsed);
    } catch (err: any) {
      console.error("Error loading shared plan", err);
      setError(err?.message || "Unable to load shared plan");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (tokenInput) {
      loadSharedPlan(tokenInput);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleImport = async () => {
    if (!snapshot) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Sign in to import this plan");
        navigate("/auth");
        return;
      }

      setImporting(true);
      const { data: newPlan, error: planError } = await supabase
        .from("user_custom_plans")
        .insert({
          name: snapshot.name,
          description: snapshot.description || null,
          user_id: user.id,
        })
        .select()
        .single();

      if (planError) throw planError;
      const exercises = (snapshot.exercises || []).filter((ex) => !!ex.exercise_id);
      if (exercises.length) {
        const baseTime = Date.now();
        const payload = exercises.map((ex, idx) => ({
          user_custom_plan_id: newPlan.id,
          exercise_id: ex.exercise_id as string,
          day_of_week: ex.day_of_week,
          sets: Number(ex.sets) || 1,
          reps: ex.reps || "8-12",
          notes: ex.notes || null,
          created_at: new Date(baseTime + idx).toISOString(),
        }));

        const { error: insertError } = await supabase
          .from("user_custom_plan_exercises")
          .insert(payload);
        if (insertError) throw insertError;
      }

      toast.success("Plan imported to your account");
      navigate("/workouts");
    } catch (err: any) {
      console.error("Error importing plan", err);
      toast.error(err?.message || "Import failed");
    } finally {
      setImporting(false);
    }
  };

  const copyToken = async () => {
    if (!tokenInput) return;
    try {
      await navigator.clipboard.writeText(tokenInput);
      toast.success("Share code copied");
    } catch (err) {
      console.error("Clipboard error", err);
      toast.error("Could not copy code");
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-5xl space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-muted/40 border border-border/60 text-xs font-semibold">
            <Link2 className="w-4 h-4" />
            Import Shared Plan
          </div>
          <h1 className="text-3xl font-bold bg-gradient-hero bg-clip-text text-transparent">Use a friend’s custom plan</h1>
          <p className="text-muted-foreground text-sm sm:text-base max-w-2xl mx-auto">Paste the share code or open a shared link to load the plan, preview the days, and import it into your account.</p>
        </div>

        <Card className="border-border/50 shadow-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="w-5 h-5" /> Share Code
            </CardTitle>
            <CardDescription>Only people with the code can view this plan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                placeholder="Paste share code"
                className="flex-1"
              />
              <div className="flex gap-2">
                <Button variant="outline" onClick={copyToken} disabled={!tokenInput} className="gap-2">
                  <Clipboard className="w-4 h-4" /> Copy
                </Button>
                <Button onClick={() => loadSharedPlan(tokenInput)} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                  Load plan
                </Button>
              </div>
            </div>
            {error && <div className="text-sm text-destructive">{error}</div>}
          </CardContent>
        </Card>

        {snapshot && (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="secondary" className="text-xs">Shared Plan</Badge>
                <Badge variant="outline" className="text-xs flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> {Object.keys(exercisesByDay).length || 0} days
                </Badge>
              </div>
              <CardTitle className="text-2xl">{snapshot.name}</CardTitle>
              <CardDescription>{snapshot.description || "No description provided."}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {Object.entries(exercisesByDay).map(([day, items]) => (
                <div key={day} className="border rounded-lg p-4 bg-muted/10">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <Calendar className="w-4 h-4 text-primary" />
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </div>
                    <Badge variant="outline" className="text-xs">{items.length} exercise{items.length !== 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="space-y-3">
                    {items.map((ex, idx) => (
                      <div key={`${ex.exercise_id || idx}-${idx}`} className="p-3 rounded-lg border bg-background/70 flex flex-col gap-1">
                        <div className="font-semibold text-sm">{ex.exercise_name || "Exercise"}</div>
                        <div className="text-xs text-muted-foreground capitalize">{ex.muscle_group || "Muscle group"}</div>
                        <div className="text-xs flex gap-2">
                          <Badge variant="outline" className="text-[11px]">{ex.sets} sets</Badge>
                          <Badge variant="outline" className="text-[11px]">{ex.reps} reps</Badge>
                        </div>
                        {ex.notes && <div className="text-xs text-muted-foreground italic">{ex.notes}</div>}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {isAuthenticated ? (
                <Button onClick={handleImport} disabled={importing} className="w-full sm:w-auto gap-2">
                  {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  Import to my plans
                </Button>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Sign in to import this plan. <Button variant="link" className="px-1" onClick={() => navigate("/auth")}>Go to sign in</Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
};

export default ImportPlan;
