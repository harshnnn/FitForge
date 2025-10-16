import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  isGuest: boolean;
  isAuthenticated: boolean;
  loading: boolean;
  continueAsGuest: () => void;
  signIn: () => void;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [isGuest, setIsGuest] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session);
      setLoading(false);
      if (session) {
        setIsGuest(false);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("isGuest", "false");
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsAuthenticated(!!session);
      if (session) {
        setIsGuest(false);
        localStorage.setItem("isAuthenticated", "true");
        localStorage.setItem("isGuest", "false");
      } else {
        setIsAuthenticated(false);
        localStorage.setItem("isAuthenticated", "false");
      }
    });

    const guest = localStorage.getItem("isGuest");
    if (guest === "true") setIsGuest(true);

    return () => subscription.unsubscribe();
  }, []);

  const continueAsGuest = () => {
    setIsGuest(true);
    setIsAuthenticated(false);
    localStorage.setItem("isGuest", "true");
    localStorage.setItem("isAuthenticated", "false");
  };

  const signIn = () => {
    setIsGuest(false);
    setIsAuthenticated(true);
    localStorage.setItem("isGuest", "false");
    localStorage.setItem("isAuthenticated", "true");
  };

  const signOut = () => {
    setIsGuest(false);
    setIsAuthenticated(false);
    localStorage.setItem("isGuest", "false");
    localStorage.setItem("isAuthenticated", "false");
    supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ isGuest, isAuthenticated, loading, continueAsGuest, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
};
