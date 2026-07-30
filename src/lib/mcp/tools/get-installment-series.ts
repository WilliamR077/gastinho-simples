import { defineTool } from "@lovable.dev/mcp-js";
import {
  getInstallmentSeries,
  installmentSeriesOutputSchema,
} from "../shared/installment-series-read";
import { z } from "zod";

export default defineTool({
  name: "get_installment_series",
  title: "Consultar série parcelada",
  description:
    "Lê, sob RLS, todas as linhas acessíveis de uma série parcelada de despesa ou receita, por installment_group_id ou transaction_id. Retorna IDs, datas, valores, versões individuais e diagnóstico factual de integridade; não altera transações.",
  inputSchema: {
    transaction_type: z.enum(["expense", "income"]),
    installment_group_id: z.string().uuid().optional(),
    transaction_id: z.string().uuid().optional(),
  },
  outputSchema: installmentSeriesOutputSchema.shape,
  annotations: {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  },
  handler: getInstallmentSeries,
});
