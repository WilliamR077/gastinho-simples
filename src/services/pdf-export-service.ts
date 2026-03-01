import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format, eachDayOfInterval, eachMonthOfInterval, startOfMonth, endOfMonth, subMonths, subYears, subQuarters, isSameDay, parseISO, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from '@/types/expense';
import { RecurringExpense } from '@/types/recurring-expense';
import { Card } from '@/types/card';
import { Income, RecurringIncome } from '@/types/income';
import { PeriodType } from '@/components/period-selector';
import { parseLocalDate } from '@/lib/utils';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const isNativeApp = () => Capacitor.isNativePlatform();

const saveAndShareFile = async (base64Data: string, fileName: string) => {
  try {
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });
    await Share.share({
      title: fileName,
      url: result.uri,
      dialogTitle: "Exportar relatório",
    });
    return true;
  } catch (error) {
    console.error("Erro ao salvar/compartilhar arquivo:", error);
    throw error;
  }
};

interface GroupMember {
  user_id: string;
  user_email: string;
  role: string;
}

const paymentMethodLabels: Record<PaymentMethod, string> = {
  credit: 'Crédito',
  debit: 'Débito',
  pix: 'PIX'
};

const COLORS = {
  credit: '#f59e0b',
  debit: '#8b5cf6',
  pix: '#06b6d4',
};

const CATEGORY_COLORS = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1',
  '#8b5cf6', '#a855f7', '#d946ef', '#ec4899'
];

interface ChartData {
  label: string;
  value: number;
  color: string;
}

// ============ CANVAS HELPERS ============

function createPieChartCanvas(
  data: ChartData[],
  width: number = 400,
  height: number = 280
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const centerX = width / 2;
  const centerY = height / 2;
  const outerRadius = Math.min(width, height) / 2.8;
  const innerRadius = outerRadius * 0.55;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  let startAngle = -Math.PI / 2;
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, outerRadius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    const percentage = (item.value / total) * 100;
    if (percentage > 8) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelRadius = (outerRadius + innerRadius) / 2;
      const labelX = centerX + Math.cos(midAngle) * labelRadius;
      const labelY = centerY + Math.sin(midAngle) * labelRadius;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${percentage.toFixed(0)}%`, labelX, labelY);
    }
    startAngle += sliceAngle;
  });

  return canvas.toDataURL('image/png');
}

function createLineChartCanvas(
  labels: string[],
  values: number[],
  width: number = 500,
  height: number = 220,
  lineColor: string = '#ef4444',
  averageValue?: number
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const padding = { top: 20, right: 20, bottom: 35, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...values, averageValue || 0, 1);
  const stepCount = Math.max(labels.length - 1, 1);

  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    const value = maxValue - (maxValue * i) / 4;
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`R$ ${value.toFixed(0)}`, padding.left - 5, y);
  }

  // X labels
  const showEvery = labels.length > 15 ? 3 : 1;
  labels.forEach((label, index) => {
    if (index % showEvery !== 0 && index !== labels.length - 1) return;
    const x = padding.left + (chartWidth * index) / stepCount;
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, height - padding.bottom + 5);
  });

  // Average dashed line
  if (averageValue !== undefined && averageValue > 0) {
    const avgY = padding.top + chartHeight - (chartHeight * averageValue) / maxValue;
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.moveTo(padding.left, avgY);
    ctx.lineTo(width - padding.right, avgY);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    ctx.font = '9px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(`Média: R$ ${averageValue.toFixed(0)}`, width - padding.right, avgY - 5);
  }

  // Area fill
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    const y = padding.top + chartHeight - (chartHeight * value) / (maxValue || 1);
    ctx.lineTo(x, y);
  });
  ctx.lineTo(padding.left + (chartWidth * (values.length - 1)) / stepCount, padding.top + chartHeight);
  ctx.closePath();
  const hex = lineColor;
  ctx.fillStyle = hex + '1A';
  ctx.fill();

  // Line
  ctx.beginPath();
  ctx.strokeStyle = lineColor;
  ctx.lineWidth = 2.5;
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    const y = padding.top + chartHeight - (chartHeight * value) / (maxValue || 1);
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Dots
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    const y = padding.top + chartHeight - (chartHeight * value) / (maxValue || 1);
    ctx.beginPath();
    ctx.arc(x, y, labels.length > 15 ? 2 : 3.5, 0, 2 * Math.PI);
    ctx.fillStyle = lineColor;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.stroke();
  });

  return canvas.toDataURL('image/png');
}

function createDualBarChartCanvas(
  data: { label: string; entradas: number; saidas: number }[],
  width: number = 500,
  height: number = 220
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const padding = { top: 25, right: 20, bottom: 35, left: 55 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;
  const maxValue = Math.max(...data.map(d => Math.max(d.entradas, d.saidas)), 1);
  const groupWidth = chartWidth / data.length;
  const barWidth = groupWidth * 0.35;

  // Grid
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();
    const value = maxValue - (maxValue * i) / 4;
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`R$ ${value.toFixed(0)}`, padding.left - 5, y);
  }

  // Bars + X labels
  const showEvery = data.length > 15 ? 3 : 1;
  data.forEach((item, index) => {
    const groupX = padding.left + groupWidth * index;
    // Green bar (entradas)
    const h1 = (chartHeight * item.entradas) / maxValue;
    ctx.fillStyle = '#22c55e';
    ctx.fillRect(groupX + groupWidth * 0.1, padding.top + chartHeight - h1, barWidth, h1);
    // Red bar (saidas)
    const h2 = (chartHeight * item.saidas) / maxValue;
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(groupX + groupWidth * 0.1 + barWidth + 1, padding.top + chartHeight - h2, barWidth, h2);
    // Label
    if (index % showEvery === 0 || index === data.length - 1) {
      ctx.fillStyle = '#6b7280';
      ctx.font = '8px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(item.label, groupX + groupWidth / 2, height - padding.bottom + 5);
    }
  });

  // Legend
  ctx.fillStyle = '#22c55e';
  ctx.fillRect(padding.left, 5, 10, 10);
  ctx.fillStyle = '#374151';
  ctx.font = '10px Arial';
  ctx.textAlign = 'left';
  ctx.fillText('Entradas', padding.left + 14, 13);
  ctx.fillStyle = '#ef4444';
  ctx.fillRect(padding.left + 80, 5, 10, 10);
  ctx.fillStyle = '#374151';
  ctx.fillText('Saídas', padding.left + 94, 13);

  return canvas.toDataURL('image/png');
}

// ============ HELPERS ============

const formatCurrency = (v: number) => `R$ ${v.toFixed(2).replace('.', ',')}`;

const formatDeltaWithAbsolute = (delta: number | null, currentVal: number, previousVal: number): string => {
  if (previousVal < 10) return "sem base";
  if (delta === null) return "—";
  const sign = delta >= 0 ? "↑" : "↓";
  const diff = currentVal - previousVal;
  const diffStr = diff >= 0 ? `+${formatCurrency(diff)}` : `-${formatCurrency(Math.abs(diff))}`;
  return `${sign} ${Math.abs(delta).toFixed(0)}% (${diffStr})`;
};

const getCategoryInfo = (expense: Expense | RecurringExpense) => {
  if (expense.category_name) return { id: expense.category_id || expense.category, name: expense.category_name, icon: expense.category_icon || '📦' };
  const label = categoryLabels[expense.category] || expense.category;
  return { id: expense.category, name: label, icon: '📦' };
};

// ============ MAIN EXPORT ============

export interface ExportReportParams {
  expenses: Expense[];
  recurringExpenses: RecurringExpense[];
  cards: Card[];
  incomes: Income[];
  recurringIncomes: RecurringIncome[];
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  periodLabel: string;
  isGroupContext: boolean;
  groupMembers: GroupMember[];
  groupName?: string;
}

export async function exportReportsToPDF(params: ExportReportParams) {
  const {
    expenses, recurringExpenses, cards,
    incomes, recurringIncomes,
    startDate, endDate, periodType, periodLabel,
    isGroupContext, groupMembers, groupName
  } = params;

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > 270) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // ============ DATA CALCULATIONS (replicating reports-accordion) ============

  const filteredExpenses = expenses.filter(e => {
    const d = parseLocalDate(e.expense_date);
    return d >= startDate && d <= endDate;
  });

  const filteredRecurringExpenses = recurringExpenses.filter(re => {
    if (!re.is_active && !re.end_date) return false;
    const sd = re.start_date ? parseISO(re.start_date) : parseLocalDate(re.created_at);
    const ed = re.end_date ? parseISO(re.end_date) : null;
    return sd <= endDate && (!ed || ed >= startDate);
  });

  const filteredIncomes = incomes.filter(i => {
    const d = parseLocalDate(i.income_date);
    return d >= startDate && d <= endDate;
  });

  const filteredRecurringIncomes = recurringIncomes.filter(ri => {
    if (!ri.is_active && !ri.end_date) return false;
    const sd = ri.start_date ? parseISO(ri.start_date) : parseLocalDate(ri.created_at);
    const ed = ri.end_date ? parseISO(ri.end_date) : null;
    return sd <= endDate && (!ed || ed >= startDate);
  });

  const monthsInPeriod = eachMonthOfInterval({ start: startDate, end: endDate }).length;
  const rm = periodType === "month" ? 1 : monthsInPeriod;

  const totalPeriod = filteredExpenses.reduce((s, e) => s + Number(e.amount), 0)
    + filteredRecurringExpenses.reduce((s, e) => s + Number(e.amount), 0) * rm;

  const totalIncomes = filteredIncomes.reduce((s, i) => s + Number(i.amount), 0)
    + filteredRecurringIncomes.reduce((s, i) => s + Number(i.amount), 0) * rm;

  const balance = totalIncomes - totalPeriod;

  // Previous period
  let previousPeriodDates: { start: Date; end: Date } | null = null;
  if (periodType === "month") {
    const ps = subMonths(startDate, 1);
    previousPeriodDates = { start: startOfMonth(ps), end: endOfMonth(ps) };
  } else if (periodType === "year") {
    const ps = subYears(startDate, 1);
    previousPeriodDates = { start: new Date(ps.getFullYear(), 0, 1), end: new Date(ps.getFullYear(), 11, 31) };
  } else if (periodType === "quarter") {
    const ps = subQuarters(startDate, 1);
    previousPeriodDates = { start: startOfMonth(ps), end: endOfMonth(subMonths(startDate, 1)) };
  }

  let previousTotalExpenses = 0;
  let previousTotalIncomes = 0;
  if (previousPeriodDates) {
    previousTotalExpenses = expenses.filter(e => {
      const d = parseLocalDate(e.expense_date);
      return d >= previousPeriodDates!.start && d <= previousPeriodDates!.end;
    }).reduce((s, e) => s + Number(e.amount), 0);
    previousTotalIncomes = incomes.filter(i => {
      const d = parseLocalDate(i.income_date);
      return d >= previousPeriodDates!.start && d <= previousPeriodDates!.end;
    }).reduce((s, i) => s + Number(i.amount), 0);
  }
  const previousBalance = previousTotalIncomes - previousTotalExpenses;

  const expenseDelta = previousTotalExpenses > 0 ? ((totalPeriod - previousTotalExpenses) / previousTotalExpenses) * 100 : null;
  const incomeDelta = previousTotalIncomes > 0 ? ((totalIncomes - previousTotalIncomes) / previousTotalIncomes) * 100 : null;
  const balanceDelta = Math.abs(previousBalance) >= 10 ? ((balance - previousBalance) / Math.abs(previousBalance)) * 100 : null;
  const savingsRate = totalIncomes > 0 ? (balance / totalIncomes) * 100 : 0;

  // Top category
  const catTotals: Record<string, { name: string; value: number }> = {};
  filteredExpenses.forEach(e => {
    const c = getCategoryInfo(e);
    if (!catTotals[c.id]) catTotals[c.id] = { name: c.name, value: 0 };
    catTotals[c.id].value += Number(e.amount);
  });
  const catSorted = Object.values(catTotals).sort((a, b) => b.value - a.value);
  const catTotal = catSorted.reduce((s, i) => s + i.value, 0);
  const topCategory = catSorted.length > 0 ? { name: catSorted[0].name, pct: catTotal > 0 ? ((catSorted[0].value / catTotal) * 100).toFixed(0) : "0" } : null;

  // Most expensive day
  const dayTotals: Record<string, { date: string; total: number }> = {};
  filteredExpenses.forEach(e => {
    if (!dayTotals[e.expense_date]) dayTotals[e.expense_date] = { date: e.expense_date, total: 0 };
    dayTotals[e.expense_date].total += Number(e.amount);
  });
  const daySorted = Object.values(dayTotals).sort((a, b) => b.total - a.total);
  const mostExpensiveDay = daySorted.length > 0 ? { date: format(parseLocalDate(daySorted[0].date), "dd/MM"), value: daySorted[0].total } : null;

  // Category data (Top 5 + Others)
  const categoryDataMap: Record<string, { name: string; icon: string; value: number }> = {};
  filteredExpenses.forEach(e => {
    const c = getCategoryInfo(e);
    if (!categoryDataMap[c.id]) categoryDataMap[c.id] = { name: c.name, icon: c.icon, value: 0 };
    categoryDataMap[c.id].value += Number(e.amount);
  });
  filteredRecurringExpenses.forEach(r => {
    const c = getCategoryInfo(r as any);
    if (!categoryDataMap[c.id]) categoryDataMap[c.id] = { name: c.name, icon: c.icon, value: 0 };
    categoryDataMap[c.id].value += Number(r.amount) * rm;
  });
  const catDataTotal = Object.values(categoryDataMap).reduce((s, i) => s + i.value, 0);
  let categoryData = Object.values(categoryDataMap)
    .filter(i => i.value > 0)
    .map(i => ({ ...i, percentage: catDataTotal > 0 ? (i.value / catDataTotal) * 100 : 0 }))
    .sort((a, b) => b.value - a.value);
  if (categoryData.length > 5) {
    const top5 = categoryData.slice(0, 5);
    const othersVal = categoryData.slice(5).reduce((s, i) => s + i.value, 0);
    categoryData = [...top5, { name: "Outros", icon: "📦", value: othersVal, percentage: catDataTotal > 0 ? (othersVal / catDataTotal) * 100 : 0 }];
  }

  // Payment method data
  const pmTotals: Record<PaymentMethod, number> = { credit: 0, debit: 0, pix: 0 };
  filteredExpenses.forEach(e => { pmTotals[e.payment_method] += Number(e.amount); });
  filteredRecurringExpenses.forEach(r => { pmTotals[r.payment_method] += Number(r.amount) * rm; });
  const pmTotal = Object.values(pmTotals).reduce((s, v) => s + v, 0);
  const paymentMethodData = Object.entries(pmTotals)
    .filter(([, v]) => v > 0)
    .map(([method, value]) => ({
      name: paymentMethodLabels[method as PaymentMethod],
      method: method as PaymentMethod,
      value,
      percentage: pmTotal > 0 ? (value / pmTotal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value);

  // Card data
  const cardTotals: Record<string, { name: string; color: string; value: number }> = {};
  cardTotals['no-card'] = { name: 'Sem cartão', color: '#9ca3af', value: 0 };
  filteredExpenses.forEach(e => {
    if (e.card_id) {
      const card = cards.find(c => c.id === e.card_id);
      if (card) {
        if (!cardTotals[card.id]) cardTotals[card.id] = { name: card.name, color: card.color, value: 0 };
        cardTotals[card.id].value += Number(e.amount);
      }
    } else { cardTotals['no-card'].value += Number(e.amount); }
  });
  filteredRecurringExpenses.forEach(r => {
    if (r.card_id) {
      const card = cards.find(c => c.id === r.card_id);
      if (card) {
        if (!cardTotals[card.id]) cardTotals[card.id] = { name: card.name, color: card.color, value: 0 };
        cardTotals[card.id].value += Number(r.amount) * rm;
      }
    } else { cardTotals['no-card'].value += Number(r.amount) * rm; }
  });
  const cardDataTotal = Object.values(cardTotals).reduce((s, i) => s + i.value, 0);
  const cardData = Object.values(cardTotals)
    .filter(i => i.value > 0)
    .map(i => ({ ...i, percentage: cardDataTotal > 0 ? ((i.value / cardDataTotal) * 100).toFixed(1) : "0" }))
    .sort((a, b) => b.value - a.value);

  // Cash flow data (always "daily" mode for PDF)
  const cashFlowData = periodType === "month"
    ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseLocalDate(e.expense_date), day));
        const dayInc = filteredIncomes.filter(i => isSameDay(parseLocalDate(i.income_date), day));
        return {
          label: format(day, "dd"),
          entradas: Number(dayInc.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)),
          saidas: Number(dayExp.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)),
        };
      })
    : eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
        const ms = startOfMonth(month), me = endOfMonth(month);
        const mExp = filteredExpenses.filter(e => { const d = parseLocalDate(e.expense_date); return d >= ms && d <= me; });
        const mInc = filteredIncomes.filter(i => { const d = parseLocalDate(i.income_date); return d >= ms && d <= me; });
        let totalE = mExp.reduce((s, e) => s + Number(e.amount), 0);
        let totalI = mInc.reduce((s, i) => s + Number(i.amount), 0);
        filteredRecurringExpenses.forEach(r => {
          const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
          const ed = r.end_date ? parseISO(r.end_date) : null;
          if (sd <= me && (!ed || ed >= ms)) totalE += Number(r.amount);
        });
        filteredRecurringIncomes.forEach(r => {
          const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
          const ed = r.end_date ? parseISO(r.end_date) : null;
          if (sd <= me && (!ed || ed >= ms)) totalI += Number(r.amount);
        });
        return { label: format(month, "MMM/yy", { locale: ptBR }), entradas: Number(totalI.toFixed(2)), saidas: Number(totalE.toFixed(2)) };
      });

  // Evolution data (always "daily" for PDF)
  const evolutionData = periodType === "month"
    ? eachDayOfInterval({ start: startDate, end: endDate }).map(day => {
        const dayExp = filteredExpenses.filter(e => isSameDay(parseLocalDate(e.expense_date), day));
        return { label: format(day, "dd"), total: Number(dayExp.reduce((s, e) => s + Number(e.amount), 0).toFixed(2)) };
      })
    : eachMonthOfInterval({ start: startDate, end: endDate }).map(month => {
        const ms = startOfMonth(month), me = endOfMonth(month);
        const mExp = filteredExpenses.filter(e => { const d = parseLocalDate(e.expense_date); return d >= ms && d <= me; });
        let total = mExp.reduce((s, e) => s + Number(e.amount), 0);
        filteredRecurringExpenses.forEach(r => {
          const sd = r.start_date ? parseISO(r.start_date) : parseLocalDate(r.created_at);
          const ed = r.end_date ? parseISO(r.end_date) : null;
          if (sd <= me && (!ed || ed >= ms)) total += Number(r.amount);
        });
        return { label: format(month, "MMM/yy", { locale: ptBR }), total: Number(total.toFixed(2)) };
      });

  const days = differenceInDays(endDate, startDate) + 1;
  const dailyAverage = days > 0 ? totalPeriod / days : 0;

  // Top 10 expenses
  const topExpenses = [
    ...filteredExpenses.map(e => ({ description: e.description, amount: Number(e.amount), date: e.expense_date, type: 'expense' as const, dayOfMonth: undefined as number | undefined })),
    ...filteredRecurringExpenses.map(r => ({ description: r.description, amount: Number(r.amount), date: '', type: 'recurring' as const, dayOfMonth: r.day_of_month })),
  ].sort((a, b) => b.amount - a.amount).slice(0, 10);

  // ============ SECTION 1: HEADER ============
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatórios', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 8;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  const walletName = isGroupContext && groupName ? `Grupo: ${groupName}` : 'Meus Gastos';
  doc.text(walletName, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;

  doc.setFontSize(10);
  const periodText = periodLabel || format(startDate, "MMMM 'de' yyyy", { locale: ptBR });
  doc.text(periodText.charAt(0).toUpperCase() + periodText.slice(1), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;

  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: 'center' });
  doc.setTextColor(0);
  yPosition += 12;

  // ============ SECTION 2: RESUMO INTELIGENTE ============
  if (totalPeriod > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('✨ Resumo Inteligente', 14, yPosition);
    yPosition += 7;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');

    let line1 = `Você gastou ${formatCurrency(totalPeriod)}`;
    if (previousPeriodDates) {
      line1 += ` (${formatDeltaWithAbsolute(expenseDelta, totalPeriod, previousTotalExpenses)})`;
    }
    doc.text(line1, 14, yPosition);
    yPosition += 5;

    if (topCategory) {
      doc.text(`Maior categoria: ${topCategory.name} (${topCategory.pct}%)`, 14, yPosition);
      yPosition += 5;
    }
    if (mostExpensiveDay) {
      doc.text(`Dia mais caro: ${mostExpensiveDay.date} (${formatCurrency(mostExpensiveDay.value)})`, 14, yPosition);
      yPosition += 5;
    }
    yPosition += 5;
  }

  // ============ SECTION 3: RESUMO DO PERÍODO ============
  checkPageBreak(35);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo do Período', 14, yPosition);
  yPosition += 7;

  const savingsLabel = totalIncomes > 0 ? `${savingsRate.toFixed(0)}% da renda` : '—';

  autoTable(doc, {
    startY: yPosition,
    head: [['', 'Entradas', 'Saídas', 'Saldo']],
    body: [
      ['Valor', formatCurrency(totalIncomes), formatCurrency(totalPeriod), formatCurrency(balance)],
      ['Contagem', `${filteredIncomes.length}+${filteredRecurringIncomes.length} fixas`, `${filteredExpenses.length}+${filteredRecurringExpenses.length} fixas`, periodLabel || '—'],
      ['Economia', savingsLabel, '', ''],
    ],
    theme: 'grid',
    headStyles: { fillColor: [100, 116, 139], fontSize: 9 },
    styles: { fontSize: 8 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 30 }, 1: { cellWidth: 45 }, 2: { cellWidth: 45 }, 3: { cellWidth: 45 } },
    margin: { left: 14, right: 14 }
  });
  yPosition = (doc as any).lastAutoTable.finalY + 10;

  // ============ SECTION 4: GASTOS POR CATEGORIA (barras horizontais via tabela) ============
  if (categoryData.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Gastos por Categoria', 14, yPosition);
    yPosition += 7;

    autoTable(doc, {
      startY: yPosition,
      head: [['Categoria', 'Valor', '%', '']],
      body: categoryData.map((cat, i) => [
        `${cat.icon} ${cat.name}`,
        formatCurrency(cat.value),
        `${cat.percentage.toFixed(0)}%`,
        '',
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 50 },
        1: { cellWidth: 40, halign: 'right' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 60 },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
          const cat = categoryData[data.row.index];
          if (cat) {
            const maxVal = categoryData[0]?.value || 1;
            const barW = (cat.value / maxVal) * (data.cell.width - 4);
            const colorIdx = data.row.index % CATEGORY_COLORS.length;
            doc.setFillColor(CATEGORY_COLORS[colorIdx]);
            doc.roundedRect(data.cell.x + 2, data.cell.y + data.cell.height / 2 - 3, Math.max(barW, 2), 6, 1, 1, 'F');
          }
        }
      }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============ SECTION 5: FORMA DE PAGAMENTO (barras) ============
  if (paymentMethodData.length > 0) {
    checkPageBreak(40);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Forma de Pagamento', 14, yPosition);
    yPosition += 7;

    autoTable(doc, {
      startY: yPosition,
      head: [['Método', 'Valor', '%', '']],
      body: paymentMethodData.map(pm => [
        pm.name,
        formatCurrency(pm.value),
        `${pm.percentage.toFixed(0)}%`,
        '',
      ]),
      theme: 'plain',
      styles: { fontSize: 8, cellPadding: 3 },
      headStyles: { fillColor: [245, 245, 245], textColor: [100, 100, 100], fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 40 },
        1: { cellWidth: 45, halign: 'right' },
        2: { cellWidth: 20, halign: 'right' },
        3: { cellWidth: 65 },
      },
      margin: { left: 14, right: 14 },
      didDrawCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 3) {
          const pm = paymentMethodData[data.row.index];
          if (pm) {
            const maxVal = paymentMethodData[0]?.value || 1;
            const barW = (pm.value / maxVal) * (data.cell.width - 4);
            const color = COLORS[pm.method];
            const r = parseInt(color.slice(1, 3), 16);
            const g = parseInt(color.slice(3, 5), 16);
            const b = parseInt(color.slice(5, 7), 16);
            doc.setFillColor(r, g, b);
            doc.roundedRect(data.cell.x + 2, data.cell.y + data.cell.height / 2 - 3, Math.max(barW, 2), 6, 1, 1, 'F');
          }
        }
      }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============ SECTION 6: GASTOS POR CARTÃO (donut) ============
  if (cardData.length > 0) {
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Gastos por Cartão', 14, yPosition);
    yPosition += 7;

    const donutChartData: ChartData[] = cardData.map((c, i) => ({
      label: c.name,
      value: c.value,
      color: c.color,
    }));

    const donutImage = createPieChartCanvas(donutChartData, 300, 220);
    if (donutImage) {
      doc.addImage(donutImage, 'PNG', 14, yPosition, 80, 60);
    }

    // Legend next to donut
    let legendY = yPosition + 5;
    cardData.forEach((c, i) => {
      if (legendY > yPosition + 55) return;
      const color = c.color;
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      doc.setFillColor(r, g, b);
      doc.circle(102, legendY + 2, 2, 'F');
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(0);
      const name = c.name.length > 18 ? c.name.substring(0, 18) + '...' : c.name;
      doc.text(`${name}: ${formatCurrency(c.value)} (${c.percentage}%)`, 106, legendY + 3);
      legendY += 7;
    });
    yPosition += 68;
  }

  // ============ SECTION 7: FLUXO DE CAIXA ============
  if (cashFlowData.length > 0) {
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Fluxo de Caixa', 14, yPosition);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    doc.text('Entradas vs Saídas — Por dia', 60, yPosition);
    doc.setTextColor(0);
    yPosition += 5;

    const cfImage = createDualBarChartCanvas(cashFlowData, 500, 200);
    if (cfImage) {
      doc.addImage(cfImage, 'PNG', 14, yPosition, 180, 65);
      yPosition += 70;
    }
  }

  // ============ SECTION 8: EVOLUÇÃO DOS GASTOS ============
  if (evolutionData.length > 0) {
    checkPageBreak(80);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Evolução dos Gastos', 14, yPosition);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    doc.text(`Diário — Média: ${formatCurrency(dailyAverage)}`, 62, yPosition);
    doc.setTextColor(0);
    yPosition += 5;

    const evoImage = createLineChartCanvas(
      evolutionData.map(d => d.label),
      evolutionData.map(d => d.total),
      500, 200,
      '#ef4444',
      dailyAverage
    );
    if (evoImage) {
      doc.addImage(evoImage, 'PNG', 14, yPosition, 180, 65);
      yPosition += 70;
    }
  }

  // ============ SECTION 9: MAIORES GASTOS (Top 10) ============
  if (topExpenses.length > 0) {
    checkPageBreak(60);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Maiores Gastos', 14, yPosition);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(128);
    doc.text('Top 10 do período', 52, yPosition);
    doc.setTextColor(0);
    yPosition += 7;

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Descrição', 'Data', 'Valor']],
      body: topExpenses.map((e, i) => [
        `${i + 1}`,
        e.description.length > 35 ? e.description.substring(0, 35) + '...' : e.description,
        e.type === 'recurring' ? `Fixa • Dia ${e.dayOfMonth}` : format(parseLocalDate(e.date), "dd/MM"),
        formatCurrency(e.amount),
      ]),
      theme: 'striped',
      headStyles: { fillColor: [234, 179, 8], textColor: [0, 0, 0], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 12, halign: 'center' },
        1: { cellWidth: 80 },
        2: { cellWidth: 35, halign: 'center' },
        3: { cellWidth: 40, halign: 'right' },
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============ SECTION 10: COMPARAÇÃO VS ANTERIOR ============
  if (previousPeriodDates && (previousTotalExpenses > 0 || previousTotalIncomes > 0)) {
    checkPageBreak(45);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Comparação vs Período Anterior', 14, yPosition);
    yPosition += 7;

    const compData = [
      { label: 'Entradas', current: totalIncomes, previous: previousTotalIncomes, delta: incomeDelta },
      { label: 'Saídas', current: totalPeriod, previous: previousTotalExpenses, delta: expenseDelta },
      { label: 'Saldo', current: balance, previous: previousBalance, delta: balanceDelta },
    ];

    autoTable(doc, {
      startY: yPosition,
      head: [['', 'Atual', 'Anterior', 'Variação']],
      body: compData.map(item => [
        item.label,
        formatCurrency(item.current),
        formatCurrency(item.previous),
        formatDeltaWithAbsolute(item.delta, item.current, item.previous),
      ]),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246], fontSize: 9 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 30 },
        1: { cellWidth: 45, halign: 'right' },
        2: { cellWidth: 45, halign: 'right' },
        3: { cellWidth: 50 },
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============ SECTION 11: TAXA DE ECONOMIA ============
  if (totalIncomes > 0) {
    checkPageBreak(25);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Taxa de Economia', 14, yPosition);
    yPosition += 8;

    doc.setFontSize(22);
    doc.setFont('helvetica', 'bold');
    const srColor = savingsRate < 0 ? [239, 68, 68] : savingsRate < 10 ? [249, 115, 22] : savingsRate < 20 ? [59, 130, 246] : [34, 197, 94];
    doc.setTextColor(srColor[0], srColor[1], srColor[2]);
    doc.text(`${savingsRate.toFixed(0)}%`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;

    doc.setFontSize(9);
    const interpretation = savingsRate < 0 ? "Você gastou mais do que ganhou" : savingsRate < 10 ? "Tente reservar mais" : savingsRate < 20 ? "Bom ritmo!" : "Excelente! 🎉";
    doc.text(interpretation, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 5;

    doc.setTextColor(128);
    doc.setFontSize(8);
    doc.text(`Você economizou ${formatCurrency(Math.max(balance, 0))} de ${formatCurrency(totalIncomes)} em entradas`, pageWidth / 2, yPosition, { align: 'center' });
    doc.setTextColor(0);
    yPosition += 10;
  }

  // ============ SECTION 12: DESPESAS FIXAS ============
  if (filteredRecurringExpenses.length > 0) {
    checkPageBreak(50);
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas Fixas', 14, yPosition);
    yPosition += 7;

    const recurringTotal = filteredRecurringExpenses.reduce((s, e) => s + Number(e.amount), 0) * rm;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`Total: ${formatCurrency(recurringTotal)}`, 14, yPosition);
    yPosition += 6;

    const today = new Date().getDate();
    const recurringData = filteredRecurringExpenses
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .map(e => {
        const card = cards.find(c => c.id === e.card_id);
        const isPaid = e.day_of_month < today;
        return [
          e.description,
          isPaid ? 'Paga' : 'Pendente',
          `Dia ${e.day_of_month}`,
          paymentMethodLabels[e.payment_method],
          card?.name || '-',
          formatCurrency(Number(e.amount)),
        ];
      });

    autoTable(doc, {
      startY: yPosition,
      head: [['Descrição', 'Status', 'Dia', 'Método', 'Cartão', 'Valor']],
      body: recurringData,
      theme: 'striped',
      headStyles: { fillColor: [20, 184, 166], fontSize: 8 },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 20 },
        2: { cellWidth: 18 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });
    yPosition = (doc as any).lastAutoTable.finalY + 10;
  }

  // ============ FOOTER ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Página ${i} de ${pageCount} — Gastinho Simples`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  const fileName = `relatorio-${format(startDate, 'yyyy-MM')}.pdf`;

  if (isNativeApp()) {
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    await saveAndShareFile(pdfBase64, fileName);
  } else {
    doc.save(fileName);
  }

  return fileName;
}
