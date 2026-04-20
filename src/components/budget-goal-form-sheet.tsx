import { useState, useEffect } from "react";
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
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { BudgetGoalType } from "@/types/budget-goal";
import { useSubscription } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, TrendingDown, TrendingUp, Scale } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboardingTour } from "@/hooks/use-onboarding-tour";

const budgetGoalSchema = z.object({
  type: z.enum(["monthly_total", "category", "income_monthly_total", "income_category", "balance_target"] as const),
  category: z.string().optional(),
  limitAmount: z.number().positive("O valor deve ser maior que zero"),
});

type BudgetGoalFormData = z.infer<typeof budgetGoalSchema>;

type GoalScope = null | "expense" | "income" | "balance";

interface BudgetGoalFormSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { type: BudgetGoalType; category?: ExpenseCategory; limitAmount: number }) => void;
  currentGoalsCount: number;
  preventClose?: boolean;
  onboardingActive?: boolean;
}

export function BudgetGoalFormSheet({
  open,
  onOpenChange,
  onSubmit,
  currentGoalsCount,
  preventClose,
  onboardingActive,
}: BudgetGoalFormSheetProps) {
  const [goalScope, setGoalScope] = useState<GoalScope>(null);
  const [goalType, setGoalType] = useState<string>("monthly_total");
  const { canAddGoal, features } = useSubscription();
  const { activeCategories: incomeActiveCategories } = useIncomeCategories();
  const navigate = useNavigate();
  const { currentStep, currentSubstepIndex } = useOnboardingTour();

  // Proteção: enquanto o onboarding estiver guiando o step "add-budget-goal"
  // a partir do substep "budget-click-btn", o sheet NÃO pode fechar via
  // gestos/outside/ESC. Caso contrário, os targets dos substeps de form
  // (goal-scope-expense, goal-type-select, goal-amount-input) desmontam e
  // o tutorial precisa esperar o fallback de 10s.
  const isOnboardingGuarding = (() => {
    if (currentStep?.id !== "add-budget-goal") return false;
    const guardStartIdx = currentStep.substeps.findIndex(
      (s) => s.id === "budget-click-btn"
    );
    if (guardStartIdx < 0) return false;
    return currentSubstepIndex >= guardStartIdx;
  })();

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

  // Dispatch goal-form-opened when the sheet opens and scope cards are mounted
  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "goal-form-opened" }));
    }, 200);
    return () => clearTimeout(timer);
  }, [open]);

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

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen && (preventClose || isOnboardingGuarding)) return;
    if (!newOpen) {
      setGoalScope(null);
      setGoalType("monthly_total");
      reset();
    }
    onOpenChange(newOpen);
  };

  const handleScopeSelect = (scope: "expense" | "income" | "balance") => {
    setGoalScope(scope);
    const defaultType = scope === "expense" ? "monthly_total" : scope === "balance" ? "balance_target" : "income_monthly_total";
    setGoalType(defaultType);
    setValue("type", defaultType as any);

    if (scope === "expense") {
      window.dispatchEvent(new CustomEvent("gastinho-onboarding-event", { detail: "goal-scope-selected" }));
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[70vh] overflow-y-auto"
        onPointerDownOutside={(e) => {
          if (isOnboardingGuarding) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (isOnboardingGuarding) e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (isOnboardingGuarding) e.preventDefault();
        }}
      >
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
              data-onboarding="goal-scope-expense"
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
              data-onboarding="goal-scope-income"
              className={cn(
                "cursor-pointer hover:border-green-500/50 transition-colors",
                onboardingActive && "pointer-events-none opacity-50"
              )}
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

            <Card
              data-onboarding="goal-scope-balance"
              className={cn(
                "cursor-pointer hover:border-blue-500/50 transition-colors",
                onboardingActive && "pointer-events-none opacity-50"
              )}
              onClick={() => handleScopeSelect("balance")}
            >
              <CardContent className="p-4 flex items-start gap-3">
                <div className="rounded-full bg-blue-500/10 p-2 mt-0.5">
                  <Scale className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Meta de Saldo</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Defina um saldo mínimo desejado. A meta é atingida quando entradas - despesas ≥ valor definido.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-24">
            {!onboardingActive && (
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
            )}

            {goalScope !== "balance" && (
              <div className="space-y-2" data-onboarding="goal-type-select">
                <Label htmlFor="goal-sheet-type">Tipo de Meta</Label>
                <Select
                  value={goalType}
                  onValueChange={(value) => {
                    setGoalType(value);
                    setValue("type", value as any);
                  }}
                  disabled={onboardingActive}
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
            )}

            {(goalType === "category" || goalType === "income_category") && (
              <div className="space-y-2">
                <Label htmlFor="goal-sheet-category">Categoria</Label>
                <Select onValueChange={(value) => setValue("category", value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {goalType === "income_category" ? (
                      incomeActiveCategories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.id}>
                          {cat.icon} {cat.name}
                        </SelectItem>
                      ))
                    ) : (
                      Object.entries(categoryLabels).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                {errors.category && (
                  <p className="text-sm text-destructive">{errors.category.message}</p>
                )}
              </div>
            )}

            <div className="space-y-2" data-onboarding="goal-amount-input">
              <Label htmlFor="goal-sheet-limitAmount">
                {goalScope === "expense" ? "Limite (R$)" : goalScope === "balance" ? "Saldo Mínimo Desejado (R$)" : "Meta (R$)"}
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
                  🎯 <strong>Metas ilimitadas no Premium</strong>
                  <br />
                  Virar Premium e crie <strong>quantas metas precisar!</strong>{" "}
                  <span
                    className="underline cursor-pointer font-semibold text-primary"
                    onClick={() => {
                      handleOpenChange(false);
                      navigate("/subscription");
                    }}
                  >
                    Virar Premium ⭐
                  </span>
                </p>
              </div>
            )}

            <Button
              data-onboarding="goal-submit-btn"
              type="submit"
              className="w-full bg-gradient-primary"
              disabled={!canAddMore}
            >
              {canAddMore ? "Adicionar Meta" : "Limite Atingido - Virar Premium ⭐"}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}
