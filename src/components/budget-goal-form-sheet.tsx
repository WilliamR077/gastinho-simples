import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { ExpenseCategory, categoryLabels } from "@/types/expense";
import { BudgetGoalType } from "@/types/budget-goal";
import { useSubscription } from "@/hooks/use-subscription";
import { useNavigate } from "react-router-dom";

const budgetGoalSchema = z.object({
  type: z.enum(["monthly_total", "category"] as const),
  category: z.string().optional(),
  limitAmount: z.number().positive("O valor deve ser maior que zero"),
});

type BudgetGoalFormData = z.infer<typeof budgetGoalSchema>;

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
  const [goalType, setGoalType] = useState<"monthly_total" | "category">("monthly_total");
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
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[70vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="text-primary">Definir Nova Meta</SheetTitle>
          <SheetDescription>
            Configure um limite mensal total ou por categoria
          </SheetDescription>
        </SheetHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4 pb-24">
          <div className="space-y-2">
            <Label htmlFor="goal-sheet-type">Tipo de Meta</Label>
            <Select
              value={goalType}
              onValueChange={(value) => {
                setGoalType(value as "monthly_total" | "category");
                setValue("type", value as "monthly_total" | "category");
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly_total">Limite Mensal Total</SelectItem>
                <SelectItem value="category">Limite por Categoria</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {goalType === "category" && (
            <div className="space-y-2">
              <Label htmlFor="goal-sheet-category">Categoria</Label>
              <Select onValueChange={(value) => setValue("category", value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a categoria" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(categoryLabels).map(([key, label]) => (
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
            <Label htmlFor="goal-sheet-limitAmount">Limite (R$)</Label>
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
                    onOpenChange(false);
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
      </SheetContent>
    </Sheet>
  );
}
