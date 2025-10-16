import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session } from "@supabase/supabase-js";
import { AuthProvider, useAuth } from "@/hooks/useAuth";

import Dashboard from "./pages/Dashboard";
import Auth from "./pages/Auth";
import Profile from "./pages/Profile";
import MuscleSelector from "./pages/MuscleSelector";
import Workouts from "./pages/Workouts";
import CustomPlanCreator from "./pages/CustomPlanCreator";
import Supplements from "./pages/Supplements";
import Community from "./pages/Community";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const GuestAwareRoute = ({ children }: { children: React.ReactNode }) => {
  const { isGuest, isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  // Allow guests and authenticated users
  if (isGuest || isAuthenticated) return <>{children}</>;
  return <Navigate to="/auth" replace />;
};

const AuthOnlyRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <>{children}</>;
  // Show sign-in/upgrade prompt for guests
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background">
      <div className="bg-card p-8 rounded-xl shadow-lg text-center">
        <div className="text-2xl font-bold mb-2">Sign in required</div>
        <div className="mb-4 text-muted-foreground">This feature is only available for registered users.</div>
        <a href="/auth">
          <button className="px-6 py-2 rounded bg-primary text-white font-semibold shadow hover:bg-primary/90 transition">Sign In / Upgrade</button>
        </a>
      </div>
    </div>
  );
};

const App = () => (
  <AuthProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<Auth />} />
            <Route
              path="/"
              element={
                <GuestAwareRoute>
                  <Dashboard />
                </GuestAwareRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <AuthOnlyRoute>
                  <Profile />
                </AuthOnlyRoute>
              }
            />
            <Route
              path="/muscles"
              element={
                <GuestAwareRoute>
                  <MuscleSelector />
                </GuestAwareRoute>
              }
            />
            <Route
              path="/workouts"
              element={
                <GuestAwareRoute>
                  <Workouts />
                </GuestAwareRoute>
              }
            />
            <Route
              path="/create-plan"
              element={
                <AuthOnlyRoute>
                  <CustomPlanCreator />
                </AuthOnlyRoute>
              }
            />
            <Route
              path="/supplements"
              element={
                <GuestAwareRoute>
                  <Supplements />
                </GuestAwareRoute>
              }
            />
            <Route
              path="/community"
              element={
                <AuthOnlyRoute>
                  <Community />
                </AuthOnlyRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </AuthProvider>
);

export default App;
