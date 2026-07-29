import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { todayIso } from "../shared/dates";
import { mcpError } from "../shared/errors";
import {
  amountSchema,
  civilDateSchema,
  descriptionSchema,
  recurringContent,
  recurringDaySchema,
  recurringIncomeView,
  recurringIncomeViewSchema,
  recurringWarningSchema,
  recurringWarnings,
  validateRecurringRange,
  type RecurringIncomeWriteRow,
  type RecurringWriteWarning,
} from "../shared/recurring-write";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,description,amount,day_of_month,start_date,end_date,is_active,income_category_id,category_name,category_icon,shared_group_id,created_at,updated_at";

const inputProperties = {
  description: descriptionSchema,
  amount: amountSchema,
  day_of_month: recurringDaySchema,
  start_date: civilDateSchema.optional(),
  end_date: civilDateSchema.nullable().optional(),
  income_category_id: z.string().uuid().nullable().optional(),
  is_active: z.boolean().optional(),
  shared_group_id: z.string().uuid().optional(),
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "create_recurring_income",
  title: "Criar template mensal de receita",
  description:
    "Cria somente um template mensal de receita para a conta autenticada. Não cria nem materializa uma receita real.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("recurring_income"),
    id: z.string().uuid(),
    created: z.literal(true),
    template: recurringIncomeViewSchema,
    warnings: z.array(recurringWarningSchema),
    data_complete: z.literal(true),
  },
  annotations: {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: false,
  },
  handler: async (rawInput, ctx) => {
    const userId = ctx.getUserId();
    if (!ctx.isAuthenticated() || !userId) return mcpError("UNAUTHENTICATED");
    const parsed = inputValidator.safeParse(rawInput);
    if (!parsed.success) return mcpError("INVALID_INPUT");
    const input = parsed.data;
    const startDate = input.start_date ?? todayIso();
    if (!validateRecurringRange(startDate, input.end_date)) {
      return mcpError("INVALID_DATE_RANGE");
    }
    const supabase = supabaseForUser(ctx);

    if (input.shared_group_id) {
      const group = await supabase
        .from("shared_groups")
        .select("id")
        .eq("id", input.shared_group_id)
        .maybeSingle();
      if (group.error) return mcpError("INTERNAL_ERROR");
      if (!group.data) return mcpError("RESOURCE_NOT_FOUND");
    }

    let categorySnapshot: { name: string; icon: string | null } | null = null;
    if (input.income_category_id) {
      const category = await supabase
        .from("user_income_categories")
        .select("name,icon,is_active")
        .eq("id", input.income_category_id)
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      if (category.error) return mcpError("INTERNAL_ERROR");
      if (!category.data) return mcpError("CATEGORY_NOT_FOUND");
      categorySnapshot = category.data;
    }

    const insertResult = await supabase
      .from("recurring_incomes")
      .insert({
        user_id: userId,
        description: input.description,
        amount: input.amount,
        day_of_month: input.day_of_month,
        start_date: startDate,
        end_date: input.end_date ?? null,
        is_active: input.is_active ?? true,
        category: input.income_category_id ? "outros" : "salario",
        income_category_id: input.income_category_id ?? null,
        category_name: categorySnapshot?.name ?? null,
        category_icon: categorySnapshot?.icon ?? null,
        shared_group_id: input.shared_group_id ?? null,
      })
      .select(COLUMNS)
      .single();
    if (insertResult.error || !insertResult.data) return mcpError("WRITE_FAILED");
    const template = recurringIncomeView(
      insertResult.data as RecurringIncomeWriteRow,
    );
    if (!template || !recurringIncomeViewSchema.safeParse(template).success) {
      return mcpError("INVALID_DATA");
    }
    const warnings = recurringWarnings(
      template.day_of_month,
      template.start_date,
    );
    if (input.income_category_id) warnings.push("CATEGORY_SNAPSHOT_UPDATED");
    if (template.is_shared) warnings.push("SHARED_TEMPLATE_CREATED");
    const result = {
      resource_type: "recurring_income" as const,
      id: template.id,
      created: true as const,
      template,
      warnings: warnings as RecurringWriteWarning[],
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: recurringContent(result) }],
      structuredContent: result,
    };
  },
});
