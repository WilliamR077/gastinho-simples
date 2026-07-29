import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  getGroupSettlement,
  groupAnalysisGroupSchema,
  groupAnalysisPeriodSchema,
  groupMemberSummaryItemSchema,
  groupSplitWarningSchema,
  settlementStatusSchema,
  settlementTransferSchema,
} from "../shared/group-split-analysis";

export default defineTool({
  name: "get_group_settlement",
  title: "Sugerir acerto do grupo",
  description:
    "Calcula saldos e sugestões simplificadas de acerto em centavos para um grupo acessível. Não executa transferência, não confirma pagamento e não cria transação.",
  inputSchema: {
    group_id: z.string().uuid(),
    date_from: z.string().optional(),
    date_to: z.string().optional(),
  },
  outputSchema: {
    resource_type: z.literal("group_settlement"),
    group: groupAnalysisGroupSchema,
    period: groupAnalysisPeriodSchema,
    member_balances: z.array(groupMemberSummaryItemSchema),
    transfers: z.array(settlementTransferSchema),
    transfer_count: z.number().int().nonnegative(),
    total_to_transfer: z.number().nonnegative(),
    total_credit: z.number().nonnegative(),
    total_debit: z.number().nonnegative(),
    residual_amount: z.number().nonnegative(),
    settlement_status: settlementStatusSchema,
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
  handler: getGroupSettlement,
});
