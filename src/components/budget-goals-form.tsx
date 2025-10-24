import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ExpenseCategory, categoryLabels } from "@/types/expense";
import { BudgetGoalType } from "@/types/budget-goal";
import { Target } from "lucide-react";

const budgetGoalSchema = z.object({
  type: z.enum(["monthly_total", "category"] as const),
  category: z.string().optional(),
  limitAmount: z.number().positive("O valor deve ser maior que zero"),
});

type BudgetGoalFormData = z.infer<typeof budgetGoalSchema>;

interface BudgetGoalsFormProps {
  onSubmit: (data: { type: BudgetGoalType; category?: ExpenseCategory; limitAmount: number }) => void;
}

export function BudgetGoalsForm({ onSubmit }: BudgetGoalsFormProps) {
  const [goalType, setGoalType] = useState<"monthly_total" | "category">("monthly_total");

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

  const handleFormSubmit = (data: BudgetGoalFormData) => {
    onSubmit({
      type: data.type as BudgetGoalType,
      category: data.category as ExpenseCategory | undefined,
      limitAmount: data.limitAmount,
    });
    reset();
    setGoalType("monthly_total");
  };

  return (
    <Card className="bg-gradient-card border-border/50 shadow-card backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <Target className="h-5 w-5" />
          Definir Nova Meta
        </CardTitle>
        <CardDescription>
          Configure um limite mensal total ou por categoria
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo de Meta</Label>
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
              <Label htmlFor="category">Categoria</Label>
              <Select
                onValueChange={(value) => setValue("category", value)}
              >
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
            <Label htmlFor="limitAmount">Limite (R$)</Label>
            <Input
              id="limitAmount"
              type="number"
              step="0.01"
              placeholder="0,00"
              {...register("limitAmount", { valueAsNumber: true })}
            />
            {errors.limitAmount && (
              <p className="text-sm text-destructive">{errors.limitAmount.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full bg-gradient-primary hover:scale-105 transition-all duration-300 shadow-elegant">
            Adicionar Meta
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
