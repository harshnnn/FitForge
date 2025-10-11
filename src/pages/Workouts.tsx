import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dumbbell, Calendar, Target } from "lucide-react";

const Workouts = () => {
  const [workoutPlans, setWorkoutPlans] = useState<any[]>([]);
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [selectedDays, setSelectedDays] = useState<number | null>(null);

  useEffect(() => {
    loadWorkoutPlans();
  }, []);

  const loadWorkoutPlans = async () => {
    try {
      const { data, error } = await supabase
        .from("workout_plans")
        .select("*")
        .order("days_per_week", { ascending: true });

      if (error) throw error;
      setWorkoutPlans(data || []);
    } catch (error) {
      console.error("Error loading workout plans:", error);
    }
  };

  const goals = [
    { value: "aesthetic", label: "Aesthetic Physique", color: "bg-gradient-primary" },
    { value: "powerlifting", label: "Power Lifting", color: "bg-gradient-secondary" },
    { value: "weight_gain", label: "Weight Gain", color: "bg-gradient-accent" },
    { value: "fat_loss", label: "Fat Loss", color: "bg-gradient-primary" },
    { value: "healthy_life", label: "Healthy Life", color: "bg-gradient-secondary" },
  ];

  const daysOptions = [3, 4, 5, 6];

  const filteredPlans = workoutPlans.filter((plan) => {
    if (selectedGoal && plan.goal !== selectedGoal) return false;
    if (selectedDays && plan.days_per_week !== selectedDays) return false;
    return true;
  });

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 bg-gradient-primary rounded-full shadow-glow-primary">
              <Dumbbell className="w-8 h-8 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Workout Plans
          </h1>
          <p className="text-muted-foreground">
            Choose the perfect plan for your fitness goals
          </p>
        </div>

        <div className="space-y-6 mb-8">
          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Target className="w-5 h-5 text-primary" />
                <CardTitle>Select Your Goal</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {goals.map((goal) => (
                  <Button
                    key={goal.value}
                    variant={selectedGoal === goal.value ? "default" : "outline"}
                    className={selectedGoal === goal.value ? goal.color : ""}
                    onClick={() => setSelectedGoal(selectedGoal === goal.value ? null : goal.value)}
                  >
                    {goal.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-secondary" />
                <CardTitle>Training Frequency</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {daysOptions.map((days) => (
                  <Button
                    key={days}
                    variant={selectedDays === days ? "default" : "outline"}
                    className={selectedDays === days ? "bg-gradient-secondary shadow-glow-secondary" : ""}
                    onClick={() => setSelectedDays(selectedDays === days ? null : days)}
                  >
                    {days} Days/Week
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPlans.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-muted-foreground text-lg">
                No workout plans found matching your criteria.
              </p>
            </div>
          ) : (
            filteredPlans.map((plan) => (
              <Card key={plan.id} className="border-border/50 hover:border-primary/50 transition-all hover:shadow-glow-primary">
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2 flex-wrap">
                    <Badge className="bg-gradient-primary">
                      {plan.days_per_week} Days/Week
                    </Badge>
                    <Badge className="bg-gradient-secondary capitalize">
                      {plan.goal.replace("_", " ")}
                    </Badge>
                  </div>
                  <Button className="w-full bg-gradient-accent hover:opacity-90 transition-opacity">
                    View Plan
                  </Button>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </Layout>
  );
};

export default Workouts;