import { useMemo, useState } from "react";
import { Card as CardType } from "@/types/card";
import { Expense, PaymentMethod, categoryLabels } from "@/types/expense";
import { RecurringExpense } from "@/types/recurring-expense";
import { Income, RecurringIncome } from "@/types/income";
import { ResponsiveContainer, Tooltip, LineChart, Line, XAxis, YAxis, CartesianGrid, BarChart, Bar, Legend, ReferenceLine, PieChart, Pie, Cell } from "recharts";
import { format, parseISO } from "date-fns";
import { TrendingUp, TrendingDown, Crown, Lock, CreditCard, Users, CalendarClock, DollarSign, ArrowUpDown, Sparkles, Target, Trophy, Wallet, BarChart3 } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { parseLocalDate } from "@/lib/utils";
import { PeriodType } from "./period-selector";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { ReportViewModel, applyCumulativeMode, applyWeeklyMode } from "@/utils/report-view-model";

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

interface ReportsAccordionProps {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  cards: CardType[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  periodLabel: string;
  isGroupContext: boolean;
  groupMembers: GroupMember[];
  viewModel: ReportViewModel;
}

const COLORS = {
  credit: "#f59e0b",
  debit: "#8b5cf6",
  pix: "#06b6d4",
};

const CATEGORY_COLORS = [
  "#ef4444", "#f97316", "#f59e0b", "#eab308", 
  "#84cc16", "#22c55e", "#10b981", "#14b8a6",
  "#06b6d4", "#0ea5e9", "#3b82f6", "#6366f1",
  "#8b5cf6", "#a855f7", "#d946ef", "#ec4899"
];

const MEMBER_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444",
  "#8b5cf6", "#ec4899", "#06b6d4", "#84cc16"
];

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit: "Crédito",
  debit: "Débito",
  pix: "PIX"
};

export function ReportsAccordion({ 
  cards,
  startDate,
  endDate,
  periodType,
  periodLabel,
  isGroupContext,
  groupMembers,
  viewModel,
}: ReportsAccordionProps) {
  const { hasAdvancedReports } = useSubscription();
  const navigate = useNavigate();
  const [cashFlowMode, setCashFlowMode] = useState<"daily" | "cumulative">("daily");
  const [evolutionMode, setEvolutionMode] = useState<"daily" | "weekly">("daily");

  // All data comes from viewModel now
  const {
    filteredExpenses, filteredRecurringExpenses,
    filteredIncomes, filteredRecurringIncomes,
    monthsInPeriod, totalPeriod, totalIncomes, balance,
    previousPeriodDates, previousTotalExpenses, previousTotalIncomes, previousBalance,
    expenseDelta, incomeDelta, balanceDelta, savingsRate,
    topCategory, mostExpensiveDay,
    categoryData, paymentMethodData, cardData, memberData,
    cashFlowDataRaw, evolutionDataRaw, dailyAverage, topExpenses,
  } = viewModel;

  // Derive cash flow with mode
  const cashFlowData = useMemo(() => {
    return cashFlowMode === "cumulative" ? applyCumulativeMode(cashFlowDataRaw) : cashFlowDataRaw;
  }, [cashFlowDataRaw, cashFlowMode]);

  // Derive evolution with mode
  const evolutionData = useMemo(() => {
    return evolutionDataRaw;
  }, [evolutionDataRaw]);

  const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace(".", ",")}`;
  const formatDelta = (delta: number | null) => {
    if (delta === null) return null;
    const sign = delta >= 0 ? "↑" : "↓";
    return `${sign} ${Math.abs(delta).toFixed(0)}%`;
  };
  const formatDeltaWithAbsolute = (delta: number | null, currentVal: number, previousVal: number) => {
    if (previousVal < 10) return "sem base";
    if (delta === null) return null;
    const sign = delta >= 0 ? "↑" : "↓";
    const diff = currentVal - previousVal;
    const diffStr = diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`;
    return `${sign} ${Math.abs(delta).toFixed(0)}% (${diffStr})`;
  };

  const tooltipStyle = {
    contentStyle: { backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', color: 'hsl(var(--foreground))' },
    labelStyle: { color: 'hsl(var(--foreground))' },
    itemStyle: { color: 'hsl(var(--foreground))' }
  };

  const getSavingsInterpretation = (rate: number) => {
    if (rate < 0) return { text: "Você gastou mais do que ganhou", color: "text-red-500" };
    if (rate < 10) return { text: "Tente reservar mais", color: "text-orange-500" };
    if (rate < 20) return { text: "Bom ritmo!", color: "text-blue-500" };
    return { text: "Excelente! 🎉", color: "text-green-500" };
  };

  const renderPremiumLock = (description: string) => (
    <div className="h-[200px] flex flex-col items-center justify-center gap-4 text-center px-4">
      <Lock className="h-12 w-12 text-muted-foreground/40" />
      <div>
        <p className="text-sm font-semibold mb-1">Recurso Premium</p>
        <p className="text-xs text-muted-foreground mb-3">{description}</p>
        <Button variant="default" size="sm" onClick={() => navigate("/subscription")} className="gap-2">
          <Crown className="h-4 w-4" />
          Fazer Upgrade
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* === BLOCO 1A: Resumo Inteligente === */}
      {totalPeriod > 0 && (
        <div className="p-4 rounded-lg bg-card border border-border" data-onboarding="reports-smart-summary">
          <div className="flex items-center gap-2 mb-3">
            <Sparkles className="h-4 w-4 text-yellow-500" />
            <span className="text-sm font-semibold">Resumo Inteligente</span>
          </div>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>
              Você gastou <span className="font-semibold text-red-500">{formatCurrency(totalPeriod)}</span>
              {previousPeriodDates && (
                <span className={totalPeriod > previousTotalExpenses ? "text-red-500" : "text-green-500"}>
                  {" "}({formatDeltaWithAbsolute(expenseDelta, totalPeriod, previousTotalExpenses)})
                </span>
              )}
            </p>
            {topCategory && (
              <p>
                Maior categoria: <span className="font-semibold text-foreground">{topCategory.name}</span> ({topCategory.pct}%)
              </p>
            )}
            {mostExpensiveDay && (
              <p>
                Dia mais caro: <span className="font-semibold text-foreground">{mostExpensiveDay.date}</span> ({formatCurrency(mostExpensiveDay.value)})
              </p>
            )}
          </div>
        </div>
      )}

      {/* === BLOCO 1B: Resumo do Período (1 card, 3 colunas) === */}
      <div className="p-4 rounded-lg bg-card border border-border" data-onboarding="reports-period-summary">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-xs text-muted-foreground">Entradas</span>
            </div>
            <div className="text-lg font-bold text-green-500">{formatCurrency(totalIncomes)}</div>
            <div className="text-[10px] text-muted-foreground">{filteredIncomes.length}+{filteredRecurringIncomes.length} fixas</div>
          </div>
          <div className="space-y-1 border-x border-border">
            <div className="flex items-center justify-center gap-1">
              <TrendingDown className="h-3 w-3 text-red-500" />
              <span className="text-xs text-muted-foreground">Saídas</span>
            </div>
            <div className="text-lg font-bold text-red-500">{formatCurrency(totalPeriod)}</div>
            <div className="text-[10px] text-muted-foreground">{filteredExpenses.length}+{filteredRecurringExpenses.length} fixas</div>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1">
              <DollarSign className="h-3 w-3 text-blue-500" />
              <span className="text-xs text-muted-foreground">Saldo</span>
            </div>
            <div className={`text-lg font-bold ${balance >= 0 ? 'text-blue-500' : 'text-orange-500'}`}>
              {formatCurrency(balance)}
            </div>
            <div className="text-[10px] text-muted-foreground">{periodLabel || "Período"}</div>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border space-y-1.5 text-xs text-muted-foreground">
          {totalIncomes > 0 && (
            <p>
              Economia: <span className={`font-semibold ${savingsRate >= 0 ? 'text-blue-500' : 'text-red-500'}`}>
                {savingsRate.toFixed(0)}% da renda
              </span>
            </p>
          )}
          {previousPeriodDates && (incomeDelta !== null || expenseDelta !== null) && (
            <p className="flex flex-wrap gap-x-3">
              {previousTotalIncomes >= 10 && incomeDelta !== null && (
                <span>Entradas <span className={incomeDelta >= 0 ? 'text-green-500' : 'text-red-500'}>{formatDelta(incomeDelta)}</span></span>
              )}
              {previousTotalExpenses >= 10 && expenseDelta !== null && (
                <span>Saídas <span className={expenseDelta <= 0 ? 'text-green-500' : 'text-red-500'}>{formatDelta(expenseDelta)}</span></span>
              )}
              {previousBalance !== 0 && Math.abs(previousBalance) >= 10 && balanceDelta !== null && (
                <span>Saldo <span className={balanceDelta >= 0 ? 'text-blue-500' : 'text-orange-500'}>{formatDelta(balanceDelta)}</span></span>
              )}
            </p>
          )}
        </div>
      </div>

      <Accordion type="multiple" className="space-y-3" defaultValue={["category", "payment-method"]}>
        {/* === BLOCO 2A: Gastos por Categoria === */}
        <AccordionItem value="category" className="border rounded-lg bg-card" data-onboarding="reports-category">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <BarChart3 className="w-5 h-5 text-orange-500" />
              <div className="text-left">
                <span className="font-semibold">Gastos por Categoria</span>
                <span className="text-xs text-muted-foreground block">{categoryData.length} categorias</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {categoryData.length > 0 ? (
              <div className="space-y-3">
                {categoryData.map((cat, i) => {
                  const maxValue = categoryData[0]?.value || 1;
                  const barWidth = (cat.value / maxValue) * 100;
                  return (
                    <div key={cat.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1.5 truncate">
                          <span>{cat.icon}</span>
                          <span className="truncate">{cat.name}</span>
                        </span>
                        <span className="font-semibold whitespace-nowrap ml-2">
                          {formatCurrency(cat.value)} <span className="text-muted-foreground font-normal text-xs">({cat.percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: CATEGORY_COLORS[i % CATEGORY_COLORS.length] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 2B: Forma de Pagamento === */}
        <AccordionItem value="payment-method" className="border rounded-lg bg-card" data-onboarding="reports-payment-method">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <Wallet className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <span className="font-semibold">Forma de Pagamento</span>
                <span className="text-xs text-muted-foreground block">{formatCurrency(totalPeriod)} no período</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {paymentMethodData.length > 0 ? (
              <div className="space-y-3">
                {paymentMethodData.map((pm) => {
                  const maxValue = paymentMethodData[0]?.value || 1;
                  const barWidth = (pm.value / maxValue) * 100;
                  return (
                    <div key={pm.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{pm.name}</span>
                        <span className="font-semibold whitespace-nowrap">
                          {formatCurrency(pm.value)} <span className="text-muted-foreground font-normal text-xs">({pm.percentage.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${barWidth}%`, backgroundColor: COLORS[pm.method] }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 2C: Gastos por Cartão === */}
        {cards.length > 0 && cardData.length > 0 && (
          <AccordionItem value="cards" className="border rounded-lg bg-card" data-onboarding="reports-cards">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <CreditCard className="w-5 h-5 text-orange-500" />
                <div className="text-left">
                  <span className="font-semibold">Gastos por Cartão</span>
                  <span className="text-xs text-muted-foreground block">{cardData.length} cartões</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={cardData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" paddingAngle={2}>
                      {cardData.map((entry, index) => (
                        <Cell key={index} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCurrency(value)} {...tooltipStyle} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="w-full space-y-2 mt-2">
                  {cardData.map((c, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c.color }} />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap">{formatCurrency(c.value)} <span className="text-xs text-muted-foreground font-normal">({c.percentage}%)</span></span>
                    </div>
                  ))}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === BLOCO 3A: Fluxo de Caixa === */}
        <AccordionItem value="cashflow" className="border rounded-lg bg-card" data-onboarding="reports-cashflow">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <ArrowUpDown className="w-5 h-5 text-blue-500" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Fluxo de Caixa</span>
                  {!hasAdvancedReports && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
                <span className="text-xs text-muted-foreground">Entradas vs Saídas</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {hasAdvancedReports ? (
              <>
                <div className="flex justify-end mb-3">
                  <ToggleGroup type="single" value={cashFlowMode} onValueChange={(v) => v && setCashFlowMode(v as "daily" | "cumulative")} size="sm" className="bg-muted rounded-lg p-0.5">
                    <ToggleGroupItem value="daily" className="text-xs px-3 data-[state=on]:bg-background rounded-md">Por dia</ToggleGroupItem>
                    <ToggleGroupItem value="cumulative" className="text-xs px-3 data-[state=on]:bg-background rounded-md">Acumulado</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {cashFlowData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={cashFlowData}>
                      <CartesianGrid strokeDasharray="6 6" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} interval={periodType === "month" ? 2 : 0} />
                      <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                      <Tooltip formatter={(value: number, name: string) => [formatCurrency(value), name === 'entradas' ? 'Entradas' : 'Saídas']} labelFormatter={(l) => periodType === "month" ? `Dia ${l}` : l} {...tooltipStyle} />
                      <Legend formatter={(v) => v === 'entradas' ? 'Entradas' : 'Saídas'} />
                      <Bar dataKey="entradas" fill="#22c55e" radius={[3, 3, 0, 0]} />
                      <Bar dataKey="saidas" fill="#ef4444" radius={[3, 3, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Nenhum dado no período</div>
                )}
              </>
            ) : renderPremiumLock("Compare entradas e saídas ao longo do tempo")}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 2D: Evolução dos Gastos === */}
        <AccordionItem value="evolution" className="border rounded-lg bg-card" data-onboarding="reports-evolution">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <TrendingUp className="w-5 h-5 text-red-500" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Evolução dos Gastos</span>
                  {!hasAdvancedReports && <Crown className="h-4 w-4 text-yellow-500" />}
                </div>
                <span className="text-xs text-muted-foreground">Gastos por {periodType === "month" ? "dia" : "mês"}</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {hasAdvancedReports ? (
              <>
                {periodType === "month" && (
                  <div className="flex justify-end mb-3">
                    <ToggleGroup type="single" value={evolutionMode} onValueChange={(v) => v && setEvolutionMode(v as "daily" | "weekly")} size="sm" className="bg-muted rounded-lg p-0.5">
                      <ToggleGroupItem value="daily" className="text-xs px-3 data-[state=on]:bg-background rounded-md">Diário</ToggleGroupItem>
                      <ToggleGroupItem value="weekly" className="text-xs px-3 data-[state=on]:bg-background rounded-md">Semanal</ToggleGroupItem>
                    </ToggleGroup>
                  </div>
                )}
                {(() => {
                  const displayData = periodType === "month" && evolutionMode === "weekly"
                    ? applyWeeklyMode(evolutionData)
                    : evolutionData;
                  const weeklyAvg = evolutionMode === "weekly" ? dailyAverage * 7 : dailyAverage;
                  return displayData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={280}>
                      <LineChart data={displayData}>
                        <CartesianGrid strokeDasharray="6 6" stroke="hsl(var(--border))" strokeOpacity={0.3} />
                        <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} interval={evolutionMode === "weekly" ? 0 : (periodType === "month" ? 2 : 0)} />
                        <YAxis stroke="hsl(var(--muted-foreground))" style={{ fontSize: '10px' }} tickFormatter={(v) => `R$${v >= 1000 ? `${(v/1000).toFixed(0)}k` : v}`} />
                        <Tooltip formatter={(value: number) => [formatCurrency(value), 'Total']} labelFormatter={(l) => evolutionMode === "weekly" ? l : (periodType === "month" ? `Dia ${l}` : l)} {...tooltipStyle} />
                        <ReferenceLine y={weeklyAvg} stroke="#f59e0b" strokeDasharray="5 5" label={{ value: `Média: ${formatCurrency(weeklyAvg)}`, position: 'insideTopRight', fill: '#f59e0b', fontSize: 10 }} />
                        <Line type="monotone" dataKey="total" stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: evolutionMode === "weekly" ? 4 : (periodType === "month" ? 2 : 4) }} activeDot={{ r: 6 }} name="Gastos" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
                  );
                })()}
              </>
            ) : renderPremiumLock("Acompanhe a evolução dos seus gastos")}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 4B: Maiores Gastos (Top 10) === */}
        <AccordionItem value="top-expenses" className="border rounded-lg bg-card" data-onboarding="reports-top-expenses">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <div className="text-left">
                <span className="font-semibold">Maiores Gastos</span>
                <span className="text-xs text-muted-foreground block">Top 10 do período</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {topExpenses.length > 0 ? (
              <div className="space-y-2">
                {topExpenses.map((e, i) => (
                  <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/50">
                    <span className="text-xs font-bold text-muted-foreground w-5 text-center">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{e.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {e.type === 'recurring' 
                          ? `Fixa • Dia ${e.dayOfMonth}` 
                          : format(parseLocalDate(e.date), "dd/MM")}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-red-500 whitespace-nowrap">{formatCurrency(e.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhum gasto no período</div>
            )}
          </AccordionContent>
        </AccordionItem>

        {/* === BLOCO 4A: Comparação com período anterior === */}
        {previousPeriodDates && (previousTotalExpenses > 0 || previousTotalIncomes > 0) && (
          <AccordionItem value="comparison" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Target className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <span className="font-semibold">Comparação</span>
                  <span className="text-xs text-muted-foreground block">vs período anterior</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-3">
                {[
                  { label: "Entradas", current: totalIncomes, previous: previousTotalIncomes, delta: incomeDelta, goodUp: true },
                  { label: "Saídas", current: totalPeriod, previous: previousTotalExpenses, delta: expenseDelta, goodUp: false },
                  { label: "Saldo", current: balance, previous: previousBalance, delta: balanceDelta, goodUp: true },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                    <div>
                      <p className="text-xs text-muted-foreground">{item.label}</p>
                      <p className="text-sm font-semibold">{formatCurrency(item.current)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Anterior: {formatCurrency(item.previous)}</p>
                      {item.previous >= 10 && item.delta !== null ? (
                        <p className={`text-sm font-semibold ${
                          item.goodUp 
                            ? (item.delta >= 0 ? 'text-green-500' : 'text-red-500')
                            : (item.delta <= 0 ? 'text-green-500' : 'text-red-500')
                        }`}>
                          {formatDeltaWithAbsolute(item.delta, item.current, item.previous)}
                        </p>
                      ) : item.previous < 10 && item.current > 0 ? (
                        <p className="text-sm text-muted-foreground italic">sem base</p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === BLOCO 4C: Taxa de Economia === */}
        {totalIncomes > 0 && (
          <AccordionItem value="savings-rate" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <DollarSign className="w-5 h-5 text-blue-500" />
                <div className="text-left">
                  <span className="font-semibold">Taxa de Economia</span>
                  <span className="text-xs text-muted-foreground block">Savings rate do período</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="text-center space-y-3">
                <div className={`text-4xl font-bold ${getSavingsInterpretation(savingsRate).color}`}>
                  {savingsRate.toFixed(0)}%
                </div>
                <Progress value={Math.min(Math.max(savingsRate, 0), 100)} className="h-2" />
                <p className={`text-sm font-medium ${getSavingsInterpretation(savingsRate).color}`}>
                  {getSavingsInterpretation(savingsRate).text}
                </p>
                <p className="text-xs text-muted-foreground">
                  Você economizou {formatCurrency(Math.max(balance, 0))} de {formatCurrency(totalIncomes)} em entradas
                </p>
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === Gastos por Membro (grupo) === */}
        {isGroupContext && memberData.length > 0 && (
          <AccordionItem value="members" className="border rounded-lg bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-purple-500" />
                <div className="text-left">
                  <span className="font-semibold">Gastos por Membro</span>
                  <span className="text-xs text-muted-foreground block">{groupMembers.length} membros</span>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-4">
              <div className="space-y-2">
                {memberData.map((member, index) => (
                  <div key={member.email} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: MEMBER_COLORS[index % MEMBER_COLORS.length] }} />
                      <span className="text-sm font-medium">{member.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-semibold">{formatCurrency(member.value)}</span>
                      <Badge variant="secondary" className="ml-2 text-xs">{member.percentage}%</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </AccordionContent>
          </AccordionItem>
        )}

        {/* === BLOCO 5: Despesas Fixas/Recorrentes === */}
        <AccordionItem value="recurring" className="border rounded-lg bg-card">
          <AccordionTrigger className="px-4 py-3 hover:no-underline">
            <div className="flex items-center gap-3">
              <CalendarClock className="w-5 h-5 text-teal-500" />
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className="font-semibold">Despesas Fixas</span>
                  <Button variant="link" size="sm" className="text-xs text-muted-foreground p-0 h-auto" onClick={(e) => { e.stopPropagation(); navigate("/"); }}>
                    Gerenciar
                  </Button>
                </div>
                <span className="text-xs text-muted-foreground block">{filteredRecurringExpenses.length} despesas ativas</span>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-4 pb-4">
            {filteredRecurringExpenses.length > 0 ? (
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-muted">
                  <div className="text-xs text-muted-foreground">
                    {periodType === "month" ? "Total Mensal" : `Total (${monthsInPeriod} ${monthsInPeriod === 1 ? 'mês' : 'meses'})`}
                  </div>
                  <div className="text-xl font-bold text-red-500">
                    {formatCurrency(filteredRecurringExpenses.reduce((s, e) => s + Number(e.amount), 0) * (periodType === "month" ? 1 : monthsInPeriod))}
                  </div>
                </div>
                {filteredRecurringExpenses.sort((a, b) => Number(b.amount) - Number(a.amount)).map((expense) => {
                  const card = cards.find(c => c.id === expense.card_id);
                  const today = new Date().getDate();
                  const daysUntil = expense.day_of_month >= today ? expense.day_of_month - today : (30 - today) + expense.day_of_month;
                  const isPaid = expense.day_of_month < today;
                  return (
                    <div key={expense.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{expense.description}</div>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge variant={isPaid ? "secondary" : "outline"} className="text-[10px]">
                            {isPaid ? "Paga" : "Pendente"}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground">
                            {isPaid ? `Dia ${expense.day_of_month}` : `Vence em ${daysUntil}d`}
                          </span>
                          {card && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: card.color }} />
                              {card.name}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-sm text-red-500">{formatCurrency(Number(expense.amount))}</div>
                        <Badge variant="secondary" className="text-[10px]">{paymentMethodLabels[expense.payment_method]}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-[100px] flex items-center justify-center text-muted-foreground text-sm">Nenhuma despesa fixa ativa</div>
            )}
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
