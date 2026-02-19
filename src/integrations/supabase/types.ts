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
      budget_goal_alerts: {
        Row: {
          alert_date: string
          alert_level: number
          created_at: string
          goal_id: string
          id: string
          user_id: string
        }
        Insert: {
          alert_date?: string
          alert_level: number
          created_at?: string
          goal_id: string
          id?: string
          user_id: string
        }
        Update: {
          alert_date?: string
          alert_level?: number
          created_at?: string
          goal_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_goal_alerts_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "budget_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      budget_goals: {
        Row: {
          category: Database["public"]["Enums"]["expense_category"] | null
          created_at: string
          id: string
          limit_amount: number
          shared_group_id: string | null
          type: Database["public"]["Enums"]["budget_goal_type"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string
          id?: string
          limit_amount: number
          shared_group_id?: string | null
          type: Database["public"]["Enums"]["budget_goal_type"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: Database["public"]["Enums"]["expense_category"] | null
          created_at?: string
          id?: string
          limit_amount?: number
          shared_group_id?: string | null
          type?: Database["public"]["Enums"]["budget_goal_type"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "budget_goals_shared_group_id_fkey"
            columns: ["shared_group_id"]
            isOneToOne: false
            referencedRelation: "shared_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      cards: {
        Row: {
          card_limit: number | null
          card_type: string
          closing_day: number | null
          color: string
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
          color?: string
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
          color?: string
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
          card_name: string | null
          category: Database["public"]["Enums"]["expense_category"]
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          created_at: string
          description: string
          expense_date: string
          id: string
          installment_group_id: string | null
          installment_number: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          shared_group_id: string | null
          total_installments: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          card_name?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          category_icon?: string | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          description: string
          expense_date?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          payment_method: Database["public"]["Enums"]["payment_method"]
          shared_group_id?: string | null
          total_installments?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          card_name?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          category_icon?: string | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          description?: string
          expense_date?: string
          id?: string
          installment_group_id?: string | null
          installment_number?: number | null
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shared_group_id?: string | null
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
          {
            foreignKeyName: "expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_shared_group_id_fkey"
            columns: ["shared_group_id"]
            isOneToOne: false
            referencedRelation: "shared_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      incomes: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["income_category"]
          created_at: string
          description: string
          id: string
          income_date: string
          shared_group_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["income_category"]
          created_at?: string
          description: string
          id?: string
          income_date?: string
          shared_group_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["income_category"]
          created_at?: string
          description?: string
          id?: string
          income_date?: string
          shared_group_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "incomes_shared_group_id_fkey"
            columns: ["shared_group_id"]
            isOneToOne: false
            referencedRelation: "shared_groups"
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
          card_name: string | null
          category: Database["public"]["Enums"]["expense_category"]
          category_icon: string | null
          category_id: string | null
          category_name: string | null
          created_at: string
          day_of_month: number
          description: string
          end_date: string | null
          id: string
          is_active: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          shared_group_id: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          card_id?: string | null
          card_name?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          category_icon?: string | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          day_of_month: number
          description: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          payment_method: Database["public"]["Enums"]["payment_method"]
          shared_group_id?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          card_id?: string | null
          card_name?: string | null
          category?: Database["public"]["Enums"]["expense_category"]
          category_icon?: string | null
          category_id?: string | null
          category_name?: string | null
          created_at?: string
          day_of_month?: number
          description?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          payment_method?: Database["public"]["Enums"]["payment_method"]
          shared_group_id?: string | null
          start_date?: string | null
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
          {
            foreignKeyName: "recurring_expenses_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "user_categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_expenses_shared_group_id_fkey"
            columns: ["shared_group_id"]
            isOneToOne: false
            referencedRelation: "shared_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_incomes: {
        Row: {
          amount: number
          category: Database["public"]["Enums"]["income_category"]
          created_at: string
          day_of_month: number
          description: string
          end_date: string | null
          id: string
          is_active: boolean
          shared_group_id: string | null
          start_date: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          category?: Database["public"]["Enums"]["income_category"]
          created_at?: string
          day_of_month: number
          description: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          shared_group_id?: string | null
          start_date?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: Database["public"]["Enums"]["income_category"]
          created_at?: string
          day_of_month?: number
          description?: string
          end_date?: string | null
          id?: string
          is_active?: boolean
          shared_group_id?: string | null
          start_date?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_incomes_shared_group_id_fkey"
            columns: ["shared_group_id"]
            isOneToOne: false
            referencedRelation: "shared_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_group_members: {
        Row: {
          group_id: string
          id: string
          joined_at: string | null
          role: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          id?: string
          joined_at?: string | null
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shared_group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "shared_groups"
            referencedColumns: ["id"]
          },
        ]
      }
      shared_groups: {
        Row: {
          color: string | null
          created_at: string | null
          created_by: string
          description: string | null
          id: string
          invite_code: string
          is_active: boolean | null
          max_members: number | null
          name: string
          updated_at: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          created_by: string
          description?: string | null
          id?: string
          invite_code: string
          is_active?: boolean | null
          max_members?: number | null
          name: string
          updated_at?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string | null
          created_by?: string
          description?: string | null
          id?: string
          invite_code?: string
          is_active?: boolean | null
          max_members?: number | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          is_active: boolean
          platform: string | null
          product_id: string | null
          purchase_token: string | null
          started_at: string
          tier: Database["public"]["Enums"]["subscription_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          platform?: string | null
          product_id?: string | null
          purchase_token?: string | null
          started_at?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          platform?: string | null
          product_id?: string | null
          purchase_token?: string | null
          started_at?: string
          tier?: Database["public"]["Enums"]["subscription_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_categories: {
        Row: {
          color: string | null
          created_at: string | null
          display_order: number | null
          icon: string
          id: string
          is_active: boolean | null
          is_default: boolean | null
          name: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          display_order?: number | null
          icon?: string
          id?: string
          is_active?: boolean | null
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_fcm_tokens: {
        Row: {
          created_at: string
          device_info: Json | null
          fcm_token: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          fcm_token: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          fcm_token?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      can_create_group: { Args: { user_id_param: string }; Returns: boolean }
      delete_group_and_data: {
        Args: { action_param: string; group_id_param: string }
        Returns: undefined
      }
      find_group_by_invite_code: {
        Args: { invite_code_param: string }
        Returns: {
          color: string
          description: string
          id: string
          is_active: boolean
          max_members: number
          name: string
        }[]
      }
      generate_invite_code: { Args: never; Returns: string }
      get_group_members_with_email: {
        Args: { group_id_param: string }
        Returns: {
          group_id: string
          id: string
          joined_at: string
          role: string
          user_email: string
          user_id: string
        }[]
      }
      get_group_role: {
        Args: { group_id_param: string; user_id_param: string }
        Returns: Database["public"]["Enums"]["group_member_role"]
      }
      get_user_subscription_tier: {
        Args: { user_id_param: string }
        Returns: Database["public"]["Enums"]["subscription_tier"]
      }
      initialize_user_categories: {
        Args: { user_id_param: string }
        Returns: undefined
      }
      is_group_member: {
        Args: { group_id_param: string; user_id_param: string }
        Returns: boolean
      }
      migrate_credit_card_config: { Args: never; Returns: undefined }
      migrate_expense_categories: {
        Args: { user_id_param: string }
        Returns: undefined
      }
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
      group_member_role: "owner" | "admin" | "member"
      income_category:
        | "salario"
        | "freelance"
        | "investimentos"
        | "vendas"
        | "bonus"
        | "presente"
        | "reembolso"
        | "aluguel"
        | "outros"
      payment_method: "pix" | "credit" | "debit"
      subscription_tier: "free" | "no_ads" | "premium" | "premium_plus"
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
      group_member_role: ["owner", "admin", "member"],
      income_category: [
        "salario",
        "freelance",
        "investimentos",
        "vendas",
        "bonus",
        "presente",
        "reembolso",
        "aluguel",
        "outros",
      ],
      payment_method: ["pix", "credit", "debit"],
      subscription_tier: ["free", "no_ads", "premium", "premium_plus"],
    },
  },
} as const
