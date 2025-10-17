export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      community_likes: {
        Row: {
          created_at: string | null
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "community_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "community_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      community_posts: {
        Row: {
          content: string
          created_at: string | null
          id: string
          likes_count: number | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          likes_count?: number | null
          user_id?: string
        }
        Relationships: []
      }
      exercises: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          muscle_group: string
          name: string
          video_url: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          muscle_group: string
          name: string
          video_url?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          muscle_group?: string
          name?: string
          video_url?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          created_at: string | null
          current_weight: number | null
          gender: Database["public"]["Enums"]["gender_type"]
          goal_weight: number | null
          height: number | null
          id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          age?: number | null
          created_at?: string | null
          current_weight?: number | null
          gender: Database["public"]["Enums"]["gender_type"]
          goal_weight?: number | null
          height?: number | null
          id?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          age?: number | null
          created_at?: string | null
          current_weight?: number | null
          gender?: Database["public"]["Enums"]["gender_type"]
          goal_weight?: number | null
          height?: number | null
          id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      supplements: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          image_url: string | null
          in_stock: boolean | null
          name: string
          price: number
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name: string
          price: number
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          image_url?: string | null
          in_stock?: boolean | null
          name?: string
          price?: number
        }
        Relationships: []
      }
      user_custom_plans: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_custom_plan_exercises: {
        Row: {
          created_at: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          exercise_id: string
          id: string
          notes: string | null
          reps: string
          sets: number
          user_custom_plan_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          exercise_id: string
          id?: string
          notes?: string | null
          reps: string
          sets: number
          user_custom_plan_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          exercise_id?: string
          id?: string
          notes?: string | null
          reps?: string
          sets?: number
          user_custom_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_custom_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_custom_plan_exercises_user_custom_plan_id_fkey"
            columns: ["user_custom_plan_id"]
            isOneToOne: false
            referencedRelation: "user_custom_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plan_exercises: {
        Row: {
          day_number: number
          exercise_id: string
          id: string
          reps: string
          sets: number
          workout_plan_id: string
        }
        Insert: {
          day_number: number
          exercise_id: string
          id?: string
          reps: string
          sets: number
          workout_plan_id: string
        }
        Update: {
          day_number?: number
          exercise_id?: string
          id?: string
          reps?: string
          sets?: number
          workout_plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plan_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_plan_exercises_workout_plan_id_fkey"
            columns: ["workout_plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string | null
          days_per_week: number
          description: string | null
          goal: Database["public"]["Enums"]["workout_goal"]
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          days_per_week: number
          description?: string | null
          goal: Database["public"]["Enums"]["workout_goal"]
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          days_per_week?: number
          description?: string | null
          goal?: Database["public"]["Enums"]["workout_goal"]
          id?: string
          name?: string
        }
        Relationships: []
      }
      workout_progress_entries: {
        Row: {
          actual_sets: number | null
          created_at: string | null
          exercise_id: string
          id: string
          notes: string | null
          planned_reps: string
          planned_sets: number
          reps_completed: string | null
          session_id: string
          updated_at: string | null
          weight_unit: string | null
          weight_used: number | null
        }
        Insert: {
          actual_sets?: number | null
          created_at?: string | null
          exercise_id: string
          id?: string
          notes?: string | null
          planned_reps: string
          planned_sets: number
          reps_completed?: string | null
          session_id: string
          updated_at?: string | null
          weight_unit?: string | null
          weight_used?: number | null
        }
        Update: {
          actual_sets?: number | null
          created_at?: string | null
          exercise_id?: string
          id?: string
          notes?: string | null
          planned_reps?: string
          planned_sets?: number
          reps_completed?: string | null
          session_id?: string
          updated_at?: string | null
          weight_unit?: string | null
          weight_used?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_progress_entries_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_progress_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_progress_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_progress_sessions: {
        Row: {
          created_at: string | null
          day_identifier: string
          id: string
          notes: string | null
          plan_id: string
          plan_type: string
          updated_at: string | null
          user_id: string
          workout_date: string
        }
        Insert: {
          created_at?: string | null
          day_identifier: string
          id?: string
          notes?: string | null
          plan_id: string
          plan_type: string
          updated_at?: string | null
          user_id: string
          workout_date?: string
        }
        Update: {
          created_at?: string | null
          day_identifier?: string
          id?: string
          notes?: string | null
          plan_id?: string
          plan_type?: string
          updated_at?: string | null
          user_id?: string
          workout_date?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      decrement_likes: {
        Args: { post_id: string }
        Returns: undefined
      }
      increment_likes: {
        Args: { post_id: string }
        Returns: undefined
      }
    }
    Enums: {
      day_of_week: "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"
      gender_type: "male" | "female"
      workout_goal:
        | "aesthetic"
        | "powerlifting"
        | "weight_gain"
        | "fat_loss"
        | "healthy_life"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      day_of_week: [
        "monday",
        "tuesday",
        "wednesday",
        "thursday",
        "friday",
        "saturday",
        "sunday",
      ],
      gender_type: ["male", "female"],
      workout_goal: [
        "aesthetic",
        "powerlifting",
        "weight_gain",
        "fat_loss",
        "healthy_life",
      ],
    },
  },
} as const
