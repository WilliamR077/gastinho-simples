import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  getGroupMemberSummary,
  groupAnalysisGroupSchema,
  groupAnalysisPeriodSchema,
  groupMemberSummaryItemSchema,
  groupSplitWarningSchema,
} from "../shared/group-split-analysis";

export default defineTool({
  name: "get_group_member_summary",
  title: "Resumir rateios por membro",
  description:
    "Calcula valores pagos, atribuídos e saldos líquidos dos membros de um grupo acessível em um período civil. Usa os rateios persistidos e não altera dados.",
  inputSchema: {
    group_id: z.string().uuid(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  },
  outputSchema: {
    resource_type: z.literal("group_member_summary"),
    group: groupAnalysisGroupSchema,
    period: groupAnalysisPeriodSchema,
    total_group_expenses: z.number(),
    total_allocated: z.number(),
    total_unallocated: z.number().nonnegative(),
    member_paid_total: z.number(),
    member_allocated_total: z.number(),
    net_balance_sum: z.number(),
    expense_count: z.number().int().nonnegative(),
    split_expense_count: z.number().int().nonnegative(),
    incomplete_expense_count: z.number().int().nonnegative(),
    members: z.array(groupMemberSummaryItemSchema),
    warnings: z.array(groupSplitWarningSchema),
    data_complete: z.boolean(),
    generated_at: z.string().datetime(),
  },
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: getGroupMemberSummary,
});
