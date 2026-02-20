import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { ExpenseCategory, categoryLabels } from "@/types/expense";
import { incomeCategoryLabels } from "@/types/income";
import { BudgetGoalType } from "@/types/budget-goal";
import { useSubscription } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingDown, TrendingUp } from "lucide-react";

const budgetGoalSchema = z.object({
  type: z.enum(["monthly_total", "category", "income_monthly_total", "income_category"] as const),
  category: z.string().optional(),
  limitAmount: z.number().positive("O valor deve ser maior que zero"),
});

type BudgetGoalFormData = z.infer<typeof budgetGoalSchema>;

type GoalScope = null | "expense" | "income";

interface BudgetGoalFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { type: BudgetGoalType; category?: ExpenseCategory; limitAmount: number }) => void;
  currentGoalsCount: number;
}

export function BudgetGoalFormSheet({
  open,
  onOpenChange,
  onSubmit,
  currentGoalsCount,
}: BudgetGoalFormSheetProps) {
  const [goalScope, setGoalScope] = useState<GoalScope>(null);
  const [goalType, setGoalType] = useState<string>("monthly_total");
  const { canAddGoal, features } = useSubscription();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<BudgetGoalFormData>({
    resolver: zodResolver(budgetGoalSchema),
    defaultValues: {
      type: "monthly_total",
    },
  });

  const canAddMore = canAddGoal(currentGoalsCount);

  const handleFormSubmit = (data: BudgetGoalFormData) => {
    onSubmit({
      type: data.type as BudgetGoalType,
      category: data.category as ExpenseCategory | undefined,
      limitAmount: data.limitAmount,
    });
    reset();
    setGoalType("monthly_total");
    setGoalScope(null);
    onOpenChange(false);
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      setGoalScope(null);
      setGoalType("monthly_total");
      reset();
    }
    onOpenChange(open);
  };

  const handleScopeSelect = (scope: "expense" | "income") => {
    setGoalScope(scope);
    const defaultType = scope === "expense" ? "monthly_total" : "income_monthly_total";
    setGoalType(defaultType);
    setValue("type", defaultType as any);
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-primary">Definir Nova Meta</SheetTitle>
          <SheetDescription>
            {goalScope === null
              ? "Escolha o tipo de meta que deseja criar"
              : goalScope === "expense"
              ? "Configure um limite máximo de gastos"
              : "Configure uma meta de ganhos"}
          </SheetDescription>
        </SheetHeader>

        {goalScope === null ? (
          <div className="space-y-3 pb-24">
            <Card
              className="cursor-pointer hover:border-destructive/50 transition-colors"
              onClick={() => handleScopeSelect("expense")}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-full bg-destructive/10 p-2 mt-0.5">
                  <TrendingDown className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Meta de Despesa</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Defina um limite máximo de gastos para controlar seus gastos mensais ou por categoria.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:border-green-500/50 transition-colors"
              onClick={() => handleScopeSelect("income")}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-full bg-green-500/10 p-2 mt-0.5">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Meta de Entrada</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Defina uma meta de ganhos para acompanhar suas receitas mensais ou por categoria.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-24">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground -ml-2"
              onClick={() => {
                setGoalScope(null);
                reset();
              }}
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Voltar
            </Button>

            <div className="space-y-2">
              <Label htmlFor="goal-sheet-type">Tipo de Meta</Label>
              <Select
                value={goalType}
                onValueChange={(value) => {
                  setGoalType(value);
                  setValue("type", value as any);
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {goalScope === "expense" ? (
                    <>
                      <SelectItem value="monthly_total">Limite Mensal Total</SelectItem>
                      <SelectItem value="category">Limite por Categoria</SelectItem>
                    </>
                  ) : (
                    <>
                      <SelectItem value="income_monthly_total">Meta Mensal de Entradas</SelectItem>
                      <SelectItem value="income_category">Meta por Categoria de Entrada</SelectItem>
                    </>
                  )}
                </SelectContent>
              </Select>
            </div>

            {(goalType === "category" || goalType === "income_category") && (
              <div className="space-y-2">
                <Label htmlFor="goal-sheet-category">Categoria</Label>
                <Select onValueChange={(value) => setValue("category", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(goalType === "income_category" ? incomeCategoryLabels : categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="goal-sheet-limitAmount">
                {goalScope === "expense" ? "Limite (R$)" : "Meta (R$)"}
              </Label>
              <Input
                id="goal-sheet-limitAmount"
                type="number"
                step="0.01"
                placeholder="0,00"
                {...register("limitAmount", { valueAsNumber: true })}
              />
              {errors.limitAmount && (
                <p className="text-sm text-destructive">{errors.limitAmount.message}</p>
              )}
            </div>

            {!canAddMore && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                <p className="text-foreground">
                  🎯 <strong>Apenas {features.goals} meta no plano Gratuito</strong>
                  <br />
                  Upgrade para Premium e crie <strong>quantas metas precisar!</strong>{" "}
                  <span
                    className="underline cursor-pointer font-semibold text-primary"
                    onClick={() => {
                      handleOpenChange(false);
                      navigate("/subscription");
                    }}
                  >
                    Ver planos
                  </span>
                </p>
              </div>
            )}

            <Button
              type="submit"
              className="w-full bg-gradient-primary"
              disabled={!canAddMore}
            >
              {canAddMore ? "Adicionar Meta" : "Limite Atingido - Faça Upgrade"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
