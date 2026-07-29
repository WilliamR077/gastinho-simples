import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  allocationStatusSchema,
  expenseSplitDetailsExpenseSchema,
  expenseSplitParticipantSchema,
  getExpenseSplitDetails,
  groupSplitWarningSchema,
} from "../shared/group-split-analysis";

export default defineTool({
  name: "get_expense_split_details",
  title: "Detalhar rateio de despesa",
  description:
    "Consulta o rateio persistido de uma despesa compartilhada acessível, resolve identidades públicas reduzidas e valida os totais em centavos. Não altera a despesa nem o rateio.",
  inputSchema: {
    expense_id: z.string().uuid(),
  },
  outputSchema: {
    resource_type: z.literal("expense_split_details"),
    expense: expenseSplitDetailsExpenseSchema,
    participants: z.array(expenseSplitParticipantSchema),
    participant_count: z.number().int().nonnegative(),
    allocated_amount_total: z.number(),
    unallocated_amount: z.number().nonnegative(),
    allocation_difference: z.number(),
    allocation_status: allocationStatusSchema,
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
  handler: getExpenseSplitDetails,
});
