import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { User } from "lucide-react";

const Profile = () => {
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState({
    gender: "",
    current_weight: "",
    goal_weight: "",
    height: "",
    age: "",
    preferred_plan_type: "",
    preferred_plan_id: "",
  });

  const [workoutPlans, setWorkoutPlans] = useState<{id:string,name:string}[]>([]);
  const [customPlans, setCustomPlans] = useState<{id:string,name:string,created_at?:string}[]>([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (error) throw error;
        if (data) {
        const d: any = data;
        setProfile({
          gender: d.gender || "",
          current_weight: d.current_weight?.toString() || "",
          goal_weight: d.goal_weight?.toString() || "",
          height: d.height?.toString() || "",
          age: d.age?.toString() || "",
          preferred_plan_type: d.preferred_workout_plan_type || "",
          preferred_plan_id: d.preferred_workout_plan_id || "",
        });
      }
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  useEffect(()=>{
    const loadPlans = async ()=>{
      try{
        const { data: std } = await supabase.from('workout_plans').select('id,name').order('name');
        setWorkoutPlans(std || []);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          const { data: cust } = await supabase.from('user_custom_plans').select('id,name,created_at').eq('user_id', user.id).order('created_at', { ascending: false });
          setCustomPlans(cust || []);
          // if no preferred selected, default to latest custom plan
          if ((!profile.preferred_plan_id || profile.preferred_plan_id === '') && (cust||[]).length>0) {
            setProfile(prev=>({ ...prev, preferred_plan_type: 'custom', preferred_plan_id: cust[0].id }));
          }
        }
      }catch(err){ console.error(err); }
    };
    loadPlans();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error } = await supabase
        .from("profiles")
        .upsert({
          user_id: user.id,
          gender: profile.gender as "male" | "female",
          current_weight: parseFloat(profile.current_weight),
          goal_weight: parseFloat(profile.goal_weight),
          height: parseFloat(profile.height),
          age: parseInt(profile.age),
          preferred_workout_plan_type: profile.preferred_plan_type || null,
          preferred_workout_plan_id: profile.preferred_plan_id || null,
        }, {
          onConflict: "user_id"
        });

      if (error) throw error;
      toast.success("Profile updated successfully!");
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <Card className="border-border/50 shadow-glow-secondary">
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-secondary rounded-full shadow-glow-secondary">
                <User className="w-6 h-6 text-secondary-foreground" />
              </div>
              <div>
                <CardTitle className="text-2xl">Your Profile</CardTitle>
                <CardDescription>Update your body metrics and goals</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="gender">Gender</Label>
              <Select
                value={profile.gender}
                onValueChange={(value) => setProfile({ ...profile, gender: value })}
              >
                <SelectTrigger id="gender" className="bg-muted">
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="male">Male</SelectItem>
                  <SelectItem value="female">Female</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="current_weight">Current Weight (kg)</Label>
                <Input
                  id="current_weight"
                  type="number"
                  step="0.1"
                  value={profile.current_weight}
                  onChange={(e) => setProfile({ ...profile, current_weight: e.target.value })}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal_weight">Goal Weight (kg)</Label>
                <Input
                  id="goal_weight"
                  type="number"
                  step="0.1"
                  value={profile.goal_weight}
                  onChange={(e) => setProfile({ ...profile, goal_weight: e.target.value })}
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="height">Height (cm)</Label>
                <Input
                  id="height"
                  type="number"
                  step="0.1"
                  value={profile.height}
                  onChange={(e) => setProfile({ ...profile, height: e.target.value })}
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="age">Age</Label>
                <Input
                  id="age"
                  type="number"
                  value={profile.age}
                  onChange={(e) => setProfile({ ...profile, age: e.target.value })}
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="preferred_plan">Preferred Workout Program</Label>
              {(() => {
                const selectedValue = profile.preferred_plan_type ? `${profile.preferred_plan_type}:${profile.preferred_plan_id}` : (profile.preferred_plan_id || "");
                return (
                  <Select
                    value={selectedValue}
                    onValueChange={(value) => {
                  // value format: "standard:ID" or "custom:ID" or just ID (legacy). 'none' clears selection
                  if (!value || value === 'none') { setProfile(prev=>({ ...prev, preferred_plan_id: '', preferred_plan_type: '' })); return; }
                  if (value.includes(':')){
                    const [t,id] = value.split(':'); setProfile(prev=>({ ...prev, preferred_plan_id: id, preferred_plan_type: t }));
                  } else {
                    // try to detect from lists
                    const std = workoutPlans.find(p=>p.id===value);
                    if (std) return setProfile(prev=>({ ...prev, preferred_plan_id: value, preferred_plan_type: 'standard' }));
                    const cust = customPlans.find(p=>p.id===value);
                    if (cust) return setProfile(prev=>({ ...prev, preferred_plan_id: value, preferred_plan_type: 'custom' }));
                    setProfile(prev=>({ ...prev, preferred_plan_id: value }));
                  }
                }}
              >
                <SelectTrigger id="preferred_plan" className="bg-muted">
                  <SelectValue placeholder="Select a preferred program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {customPlans.map(p=> <SelectItem key={`custom:${p.id}`} value={`custom:${p.id}`}>{`Custom: ${p.name}`}</SelectItem>)}
                  {workoutPlans.map(p=> <SelectItem key={`standard:${p.id}`} value={`standard:${p.id}`}>{`Standard: ${p.name}`}</SelectItem>)}
                </SelectContent>
              </Select>
                );
              })()}
            </div>

            <Button
              onClick={handleSave}
              disabled={loading}
              className="w-full bg-gradient-secondary hover:opacity-90 transition-opacity shadow-glow-secondary"
            >
              {loading ? "Saving..." : "Save Profile"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Profile;