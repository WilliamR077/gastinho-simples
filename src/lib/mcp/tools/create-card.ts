import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import {
  billingAdjustmentWarning,
  cardColorSchema,
  cardLimitSchema,
  cardNameSchema,
  cardTypeSchema,
  cardViewSchema,
  cardWriteView,
  cardWriteWarningSchema,
  createCardContent,
  daysBeforeDueSchema,
  deriveBillingDays,
  billingDaySchema,
  supportsCredit,
  type CardWriteRow,
  type CardWriteWarning,
} from "../shared/card-write";
import { mcpError } from "../shared/errors";
import { supabaseForUser } from "../shared/supabase-client";

const COLUMNS =
  "id,user_id,name,card_type,color,card_limit,opening_day,closing_day,due_day,days_before_due,is_active,created_at,updated_at";
const inputProperties = {
  name: cardNameSchema,
  card_type: cardTypeSchema,
  color: cardColorSchema.optional(),
  card_limit: cardLimitSchema.nullable().optional(),
  due_day: billingDaySchema.optional(),
  days_before_due: daysBeforeDueSchema.optional(),
  is_active: z.boolean().optional(),
};
const inputValidator = z.object(inputProperties).strict();

export default defineTool({
  name: "create_card",
  title: "Criar cartão",
  description:
    "Cria um cadastro pessoal de cartão no Gastinho. Não solicita número, CVV ou credenciais e não se comunica com banco emissor.",
  inputSchema: inputProperties,
  outputSchema: {
    resource_type: z.literal("card"),
    id: z.string().uuid(),
    created: z.literal(true),
    card: cardViewSchema,
    warnings: z.array(cardWriteWarningSchema),
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
    const credit = supportsCredit(input.card_type);
    if (
      (credit && input.due_day === undefined) ||
      (!credit &&
        (input.card_limit !== undefined && input.card_limit !== null ||
          input.due_day !== undefined ||
          input.days_before_due !== undefined))
    ) {
      return mcpError("INVALID_CARD_CONFIGURATION");
    }
    const dueDay = credit ? input.due_day! : null;
    const daysBeforeDue = credit ? (input.days_before_due ?? 10) : null;
    const billing =
      dueDay !== null && daysBeforeDue !== null
        ? deriveBillingDays(dueDay, daysBeforeDue)
        : { opening_day: null, closing_day: null };
    const supabase = supabaseForUser(ctx);
    const insertResult = await supabase
      .from("cards")
      .insert({
        user_id: userId,
        name: input.name,
        card_type: input.card_type,
        color: input.color ?? "#FFA500",
        card_limit: credit ? (input.card_limit ?? null) : null,
        opening_day: billing.opening_day,
        closing_day: billing.closing_day,
        due_day: dueDay,
        days_before_due: daysBeforeDue,
        is_active: input.is_active ?? true,
      })
      .select(COLUMNS)
      .single();
    if (insertResult.error || !insertResult.data) return mcpError("WRITE_FAILED");
    const card = cardWriteView(insertResult.data as CardWriteRow, userId);
    if (!card) return mcpError("INVALID_DATA");
    const warnings: CardWriteWarning[] = ["CARD_CREATED"];
    if (card.card_limit === null) warnings.push("CARD_WITHOUT_LIMIT");
    if (billingAdjustmentWarning(card.due_day)) {
      warnings.push("BILLING_DAY_MAY_BE_ADJUSTED");
    }
    if (!card.is_active) warnings.push("CARD_CREATED_INACTIVE");
    const result = {
      resource_type: "card" as const,
      id: card.id,
      created: true as const,
      card,
      warnings,
      data_complete: true as const,
    };
    return {
      content: [{ type: "text" as const, text: createCardContent(result) }],
      structuredContent: result,
    };
  },
});
