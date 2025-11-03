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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string
          details: Json | null
          id: string
          ip_address: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json | null
          id?: string
          ip_address?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      budget_goals: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"] | null
          created_at: string
          id: string
          limit_amount: number
          type: Database["public"]["Enums"]["budget_goal_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string
          id?: string
          limit_amount: number
          type: Database["public"]["Enums"]["budget_goal_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string
          id?: string
          limit_amount?: number
          type?: Database["public"]["Enums"]["budget_goal_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cards: {
        Row: {
          card_limit: number | null
          card_type: string
          closing_day: number | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          opening_day: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          card_limit?: number | null
          card_type: string
          closing_day?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          opening_day?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          card_limit?: number | null
          card_type?: string
          closing_day?: number | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          opening_day?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      credit_card_configs: {
        Row: {
          closing_day: number
          created_at: string
          id: string
          opening_day: number
          updated_at: string
          user_id: string
        }
        Insert: {
          closing_day: number
          created_at?: string
          id?: string
          opening_day: number
          updated_at?: string
          user_id: string
        }
        Update: {
          closing_day?: number
          created_at?: string
          id?: string
          opening_day?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          card_id: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          description: string
          expense_date: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          total_installments: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          total_installments?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          total_installments?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_settings: {
        Row: {
          created_at: string
          id: string
          is_enabled: boolean
          notify_1_day_before: boolean
          notify_3_days_before: boolean
          notify_on_day: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          notify_1_day_before?: boolean
          notify_3_days_before?: boolean
          notify_on_day?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_enabled?: boolean
          notify_1_day_before?: boolean
          notify_3_days_before?: boolean
          notify_on_day?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      recurring_expenses: {
        Row: {
          amount: number
          card_id: string | null
          category: Database["public"]["Enums"]["expense_category"]
          created_at: string
          day_of_month: number
          description: string
          id: string
          is_active: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          day_of_month: number
          description: string
          id?: string
          is_active?: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          created_at?: string
          day_of_month?: number
          description?: string
          id?: string
          is_active?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_expenses_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "cards"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      migrate_credit_card_config: { Args: never; Returns: undefined }
    }
    Enums: {
      budget_goal_type: "monthly_total" | "category"
      expense_category:
        | "alimentacao"
        | "transporte"
        | "lazer"
        | "saude"
        | "educacao"
        | "moradia"
        | "vestuario"
        | "servicos"
        | "outros"
      payment_method: "pix" | "credit" | "debit"
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
      budget_goal_type: ["monthly_total", "category"],
      expense_category: [
        "alimentacao",
        "transporte",
        "lazer",
        "saude",
        "educacao",
        "moradia",
        "vestuario",
        "servicos",
        "outros",
      ],
      payment_method: ["pix", "credit", "debit"],
    },
  },
} as const
