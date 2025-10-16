import { Database } from "@/integrations/supabase/types";

export type BudgetGoal = Database["public"]["Tables"]["budget_goals"]["Row"];
export type BudgetGoalInsert = Database["public"]["Tables"]["budget_goals"]["Insert"];
export type BudgetGoalType = Database["public"]["Enums"]["budget_goal_type"];
