import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Activity, Target, TrendingUp, Zap } from "lucide-react";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const navigate = useNavigate();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      setProfile(data);
    } catch (error) {
      console.error("Error loading profile:", error);
    }
  };

  const stats = [
    {
      title: "Current Weight",
      value: profile?.current_weight ? `${profile.current_weight} kg` : "Not set",
      icon: Activity,
      gradient: "bg-gradient-primary",
      shadowClass: "shadow-glow-primary",
    },
    {
      title: "Goal Weight",
      value: profile?.goal_weight ? `${profile.goal_weight} kg` : "Not set",
      icon: Target,
      gradient: "bg-gradient-secondary",
      shadowClass: "shadow-glow-secondary",
    },
    {
      title: "Progress",
      value: profile?.current_weight && profile?.goal_weight
        ? `${Math.abs(profile.current_weight - profile.goal_weight).toFixed(1)} kg to go`
        : "Set your goals",
      icon: TrendingUp,
      gradient: "bg-gradient-accent",
      shadowClass: "shadow-glow-accent",
    },
  ];

  const quickActions = [
    {
      title: "Complete Profile",
      description: "Add your body metrics and goals",
      action: () => navigate("/profile"),
      gradient: "bg-gradient-primary",
      icon: Activity,
      show: !profile?.gender,
    },
    {
      title: "Explore Muscles",
      description: "Use 3D model to find exercises",
      action: () => navigate("/muscles"),
      gradient: "bg-gradient-secondary",
      icon: Zap,
      show: true,
    },
    {
      title: "Browse Workouts",
      description: "Find the perfect training plan",
      action: () => navigate("/workouts"),
      gradient: "bg-gradient-accent",
      icon: Target,
      show: true,
    },
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 bg-gradient-hero bg-clip-text text-transparent">
            Welcome to Replfy.Fit
          </h1>
          <p className="text-muted-foreground">
            Your complete fitness companion
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.title} className={`border-border/50 ${stat.shadowClass}`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{stat.title}</CardTitle>
                    <div className={`p-2 ${stat.gradient} rounded-lg ${stat.shadowClass}`}>
                      <Icon className="w-5 h-5 text-foreground" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="mb-8">
          <h2 className="text-2xl font-bold mb-4">Quick Actions</h2>
          <div className="grid md:grid-cols-3 gap-6">
            {quickActions.filter(action => action.show).map((action) => {
              const Icon = action.icon;
              return (
                <Card
                  key={action.title}
                  className="border-border/50 hover:border-primary/50 transition-all cursor-pointer group"
                  onClick={action.action}
                >
                  <CardHeader>
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`p-2 ${action.gradient} rounded-lg group-hover:scale-110 transition-transform`}>
                        <Icon className="w-5 h-5 text-foreground" />
                      </div>
                      <CardTitle className="text-lg">{action.title}</CardTitle>
                    </div>
                    <CardDescription>{action.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button className={`w-full ${action.gradient} hover:opacity-90 transition-opacity`}>
                      Get Started
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Dashboard;