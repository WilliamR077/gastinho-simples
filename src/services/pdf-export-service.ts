import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from '@/types/expense';
import { RecurringExpense } from '@/types/recurring-expense';
import { Card } from '@/types/card';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

// Helper para detectar se está no app nativo
const isNativeApp = () => Capacitor.isNativePlatform();

// Helper para salvar e compartilhar arquivo no app
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
  credit: '#ef4444',
  debit: '#3b82f6',
  pix: '#10b981',
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

// Função para criar gráfico de pizza usando canvas nativo
function createPieChartCanvas(
  data: ChartData[],
  title: string,
  width: number = 400,
  height: number = 300
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';

  const centerX = width / 2;
  const centerY = height / 2 - 20;
  const radius = Math.min(width, height) / 3;
  const total = data.reduce((sum, d) => sum + d.value, 0);

  // Desenhar título
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, centerX, 20);

  // Desenhar fatias
  let startAngle = -Math.PI / 2;
  data.forEach((item) => {
    const sliceAngle = (item.value / total) * 2 * Math.PI;
    
    ctx.beginPath();
    ctx.moveTo(centerX, centerY);
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Desenhar percentual no centro da fatia se > 5%
    const percentage = (item.value / total) * 100;
    if (percentage > 5) {
      const midAngle = startAngle + sliceAngle / 2;
      const labelRadius = radius * 0.6;
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

  // Desenhar legenda
  const legendY = height - 50;
  const legendItemWidth = width / Math.min(data.length, 3);
  
  data.slice(0, 6).forEach((item, index) => {
    const row = Math.floor(index / 3);
    const col = index % 3;
    const x = 20 + col * (width - 40) / 3;
    const y = legendY + row * 20;

    ctx.fillStyle = item.color;
    ctx.fillRect(x, y, 12, 12);
    
    ctx.fillStyle = '#374151';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    const label = item.label.length > 15 ? item.label.substring(0, 15) + '...' : item.label;
    ctx.fillText(label, x + 16, y + 6);
  });

  return canvas.toDataURL('image/png');
}

// Função para criar gráfico de linha usando canvas nativo
function createLineChartCanvas(
  labels: string[],
  values: number[],
  title: string,
  width: number = 500,
  height: number = 250
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';

  const padding = { top: 40, right: 20, bottom: 40, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Desenhar título
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);

  // Calcular escala
  const maxValue = Math.max(...values, 1);
  const minValue = 0;
  const valueRange = maxValue - minValue;
  const stepCount = labels.length - 1 || 1;

  // Desenhar grid e eixo Y
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const value = maxValue - (valueRange * i) / 4;
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`R$ ${value.toFixed(0)}`, padding.left - 5, y);
  }

  // Desenhar labels do eixo X
  labels.forEach((label, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(label, x, height - padding.bottom + 10);
  });

  // Desenhar área preenchida
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top + chartHeight);
  
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    const y = padding.top + chartHeight - (chartHeight * (value - minValue)) / (valueRange || 1);
    if (index === 0) {
      ctx.lineTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  
  ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
  ctx.closePath();
  ctx.fillStyle = 'rgba(59, 130, 246, 0.1)';
  ctx.fill();

  // Desenhar linha
  ctx.beginPath();
  ctx.strokeStyle = '#3b82f6';
  ctx.lineWidth = 3;
  
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    const y = padding.top + chartHeight - (chartHeight * (value - minValue)) / (valueRange || 1);
    if (index === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
    }
  });
  ctx.stroke();

  // Desenhar pontos
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth * index) / stepCount;
    const y = padding.top + chartHeight - (chartHeight * (value - minValue)) / (valueRange || 1);
    
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, 2 * Math.PI);
    ctx.fillStyle = '#3b82f6';
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  return canvas.toDataURL('image/png');
}

// Função para criar gráfico de barras usando canvas nativo
function createBarChartCanvas(
  labels: string[],
  values: number[],
  colors: string[],
  title: string,
  width: number = 500,
  height: number = 250
): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  
  if (!ctx) return '';

  const padding = { top: 40, right: 20, bottom: 60, left: 60 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Desenhar título
  ctx.fillStyle = '#1f2937';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(title, width / 2, 20);

  // Calcular escala
  const maxValue = Math.max(...values, 1);
  const barWidth = chartWidth / labels.length * 0.7;
  const barGap = chartWidth / labels.length * 0.3;

  // Desenhar grid e eixo Y
  ctx.strokeStyle = '#e5e7eb';
  ctx.lineWidth = 1;
  
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight * i) / 4;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(width - padding.right, y);
    ctx.stroke();

    const value = maxValue - (maxValue * i) / 4;
    ctx.fillStyle = '#6b7280';
    ctx.font = '10px Arial';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`R$ ${value.toFixed(0)}`, padding.left - 5, y);
  }

  // Desenhar barras
  values.forEach((value, index) => {
    const x = padding.left + (chartWidth / labels.length) * index + barGap / 2;
    const barHeight = (chartHeight * value) / maxValue;
    const y = padding.top + chartHeight - barHeight;

    ctx.fillStyle = colors[index % colors.length];
    ctx.fillRect(x, y, barWidth, barHeight);

    // Label do eixo X
    ctx.fillStyle = '#6b7280';
    ctx.font = '9px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const label = labels[index].length > 10 ? labels[index].substring(0, 10) + '...' : labels[index];
    ctx.fillText(label, x + barWidth / 2, height - padding.bottom + 5);
  });

  return canvas.toDataURL('image/png');
}

export async function exportReportsToPDF(
  expenses: Expense[],
  recurringExpenses: RecurringExpense[],
  cards: Card[],
  startDate: Date,
  endDate: Date,
  isGroupContext: boolean,
  groupMembers: GroupMember[],
  groupName?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPosition = 20;

  const checkPageBreak = (requiredSpace: number) => {
    if (yPosition + requiredSpace > 270) {
      doc.addPage();
      yPosition = 20;
    }
  };

  // Filtrar despesas do período
  const filteredExpenses = expenses.filter(e => {
    const expenseDate = new Date(e.expense_date);
    return expenseDate >= startDate && expenseDate <= endDate;
  });

  const activeRecurring = recurringExpenses.filter(r => r.is_active);

  // ============ CABEÇALHO ============
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Relatório de Gastos', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const periodText = `${format(startDate, "MMMM 'de' yyyy", { locale: ptBR })}`;
  doc.text(periodText.charAt(0).toUpperCase() + periodText.slice(1), pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 6;

  if (isGroupContext && groupName) {
    doc.setFontSize(10);
    doc.text(`Grupo: ${groupName}`, pageWidth / 2, yPosition, { align: 'center' });
    yPosition += 6;
  }

  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}`, pageWidth / 2, yPosition, { align: 'center' });
  doc.setTextColor(0);
  yPosition += 15;

  // ============ RESUMO GERAL ============
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const totalRecurring = activeRecurring.reduce((sum, e) => sum + Number(e.amount), 0);
  const grandTotal = totalExpenses + totalRecurring;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.text('Resumo Geral', 14, yPosition);
  yPosition += 8;

  autoTable(doc, {
    startY: yPosition,
    head: [['Descrição', 'Valor']],
    body: [
      ['Total de Despesas do Mês', `R$ ${totalExpenses.toFixed(2)}`],
      ['Total de Despesas Fixas', `R$ ${totalRecurring.toFixed(2)}`],
      ['Total Geral', `R$ ${grandTotal.toFixed(2)}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [34, 197, 94] },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 60, halign: 'right' }
    },
    margin: { left: 14, right: 14 }
  });

  yPosition = (doc as any).lastAutoTable.finalY + 15;

  // ============ GRÁFICO: EVOLUÇÃO DOS ÚLTIMOS 6 MESES ============
  checkPageBreak(80);
  
  const monthlyTotals: { month: string; total: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthDate = new Date(startDate);
    monthDate.setMonth(monthDate.getMonth() - i);
    const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
    const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0);
    
    const monthExpenses = expenses.filter(e => {
      const expenseDate = new Date(e.expense_date);
      return expenseDate >= monthStart && expenseDate <= monthEnd;
    });
    
    let total = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    total += activeRecurring.reduce((sum, e) => sum + Number(e.amount), 0);
    
    monthlyTotals.push({
      month: format(monthDate, 'MMM/yy', { locale: ptBR }),
      total
    });
  }

  const lineChartImage = createLineChartCanvas(
    monthlyTotals.map(m => m.month),
    monthlyTotals.map(m => m.total),
    'Evolução dos Gastos - Últimos 6 Meses'
  );

  if (lineChartImage) {
    doc.addImage(lineChartImage, 'PNG', 14, yPosition, 180, 70);
    yPosition += 80;
  }

  // ============ COMPARAÇÃO MÊS A MÊS ============
  if (monthlyTotals.length >= 2) {
    checkPageBreak(40);
    
    const currentMonth = monthlyTotals[monthlyTotals.length - 1];
    const previousMonth = monthlyTotals[monthlyTotals.length - 2];
    const difference = currentMonth.total - previousMonth.total;
    const percentChange = previousMonth.total > 0 
      ? ((difference / previousMonth.total) * 100).toFixed(1)
      : '0';

    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('Comparação Mês a Mês', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Período', 'Valor', 'Variação']],
      body: [
        [previousMonth.month, `R$ ${previousMonth.total.toFixed(2)}`, '-'],
        [currentMonth.month, `R$ ${currentMonth.total.toFixed(2)}`, 
          `${difference >= 0 ? '+' : ''}R$ ${difference.toFixed(2)} (${difference >= 0 ? '+' : ''}${percentChange}%)`],
      ],
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      margin: { left: 14, right: 14 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // ============ GRÁFICOS DE PIZZA ============
  checkPageBreak(80);

  // Gastos por forma de pagamento
  const paymentTotals: Record<PaymentMethod, number> = { credit: 0, debit: 0, pix: 0 };
  filteredExpenses.forEach(e => { paymentTotals[e.payment_method] += Number(e.amount); });
  activeRecurring.forEach(e => { paymentTotals[e.payment_method] += Number(e.amount); });

  const paymentChartData: ChartData[] = Object.entries(paymentTotals)
    .filter(([_, value]) => value > 0)
    .map(([method, value]) => ({
      label: `${paymentMethodLabels[method as PaymentMethod]} (R$ ${value.toFixed(0)})`,
      value,
      color: COLORS[method as PaymentMethod]
    }));

  if (paymentChartData.length > 0) {
    const paymentChartImage = createPieChartCanvas(
      paymentChartData,
      'Gastos por Forma de Pagamento'
    );

    if (paymentChartImage) {
      doc.addImage(paymentChartImage, 'PNG', 14, yPosition, 85, 65);
    }
  }

  // Gastos por categoria
  const categoryTotals: Partial<Record<ExpenseCategory, number>> = {};
  filteredExpenses.forEach(e => {
    const cat = e.category || 'outros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount);
  });
  activeRecurring.forEach(e => {
    const cat = e.category || 'outros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount);
  });

  const categoryChartData: ChartData[] = Object.entries(categoryTotals)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value], index) => ({
      label: categoryLabels[cat as ExpenseCategory],
      value,
      color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
    }));

  if (categoryChartData.length > 0) {
    const categoryChartImage = createPieChartCanvas(
      categoryChartData,
      'Gastos por Categoria'
    );

    if (categoryChartImage) {
      doc.addImage(categoryChartImage, 'PNG', 105, yPosition, 85, 65);
    }
  }

  yPosition += 75;

  // ============ GRÁFICO: GASTOS POR CARTÃO ============
  if (cards.length > 0) {
    checkPageBreak(80);

    const cardTotals: Record<string, { name: string; color: string; value: number }> = {
      'sem-cartao': { name: 'Sem cartão', color: '#9ca3af', value: 0 }
    };

    filteredExpenses.forEach(e => {
      if (e.card_id) {
        const card = cards.find(c => c.id === e.card_id);
        if (card) {
          if (!cardTotals[card.id]) {
            cardTotals[card.id] = { name: card.name, color: card.color, value: 0 };
          }
          cardTotals[card.id].value += Number(e.amount);
        }
      } else {
        cardTotals['sem-cartao'].value += Number(e.amount);
      }
    });

    activeRecurring.forEach(e => {
      if (e.card_id) {
        const card = cards.find(c => c.id === e.card_id);
        if (card) {
          if (!cardTotals[card.id]) {
            cardTotals[card.id] = { name: card.name, color: card.color, value: 0 };
          }
          cardTotals[card.id].value += Number(e.amount);
        }
      } else {
        cardTotals['sem-cartao'].value += Number(e.amount);
      }
    });

    const cardChartData: ChartData[] = Object.values(cardTotals)
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(item => ({
        label: item.name,
        value: item.value,
        color: item.color
      }));

    if (cardChartData.length > 0) {
      const cardChartImage = createPieChartCanvas(
        cardChartData,
        'Gastos por Cartão'
      );

      if (cardChartImage) {
        doc.addImage(cardChartImage, 'PNG', 14, yPosition, 85, 65);
      }
    }

    // Gráfico por membro (se em grupo)
    if (isGroupContext && groupMembers.length > 0) {
      const memberTotals: Record<string, { name: string; value: number }> = {};
      
      filteredExpenses.forEach(e => {
        const member = groupMembers.find(m => m.user_id === e.user_id);
        const email = member?.user_email || 'Desconhecido';
        const name = email.split('@')[0];
        
        if (!memberTotals[e.user_id]) {
          memberTotals[e.user_id] = { name, value: 0 };
        }
        memberTotals[e.user_id].value += Number(e.amount);
      });

      const memberChartData: ChartData[] = Object.values(memberTotals)
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value)
        .map((item, index) => ({
          label: item.name,
          value: item.value,
          color: CATEGORY_COLORS[index % CATEGORY_COLORS.length]
        }));

      if (memberChartData.length > 0) {
        const memberChartImage = createPieChartCanvas(
          memberChartData,
          'Gastos por Membro'
        );

        if (memberChartImage) {
          doc.addImage(memberChartImage, 'PNG', 105, yPosition, 85, 65);
        }
      }
    }

    yPosition += 75;
  }

  // ============ DESPESAS FIXAS ============
  if (activeRecurring.length > 0) {
    checkPageBreak(50);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas Fixas', 14, yPosition);
    yPosition += 8;

    const recurringData = activeRecurring
      .sort((a, b) => Number(b.amount) - Number(a.amount))
      .map(e => {
        const card = cards.find(c => c.id === e.card_id);
        return [
          e.description,
          categoryLabels[e.category],
          `Dia ${e.day_of_month}`,
          paymentMethodLabels[e.payment_method],
          card?.name || '-',
          `R$ ${Number(e.amount).toFixed(2)}`
        ];
      });

    autoTable(doc, {
      startY: yPosition,
      head: [['Descrição', 'Categoria', 'Dia', 'Pagamento', 'Cartão', 'Valor']],
      body: recurringData,
      theme: 'striped',
      headStyles: { fillColor: [20, 184, 166] },
      columnStyles: {
        0: { cellWidth: 45 },
        1: { cellWidth: 30 },
        2: { cellWidth: 20 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Mensal em Despesas Fixas: R$ ${totalRecurring.toFixed(2)}`, 14, yPosition);
    yPosition += 15;
  }

  // ============ LISTA DE DESPESAS DO MÊS ============
  if (filteredExpenses.length > 0) {
    checkPageBreak(50);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Despesas do Mês', 14, yPosition);
    yPosition += 8;

    const expenseData = filteredExpenses
      .sort((a, b) => new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime())
      .map(e => {
        const card = cards.find(c => c.id === e.card_id);
        return [
          format(new Date(e.expense_date), 'dd/MM'),
          e.description.length > 25 ? e.description.substring(0, 25) + '...' : e.description,
          categoryLabels[e.category],
          paymentMethodLabels[e.payment_method],
          card?.name || '-',
          `R$ ${Number(e.amount).toFixed(2)}`
        ];
      });

    autoTable(doc, {
      startY: yPosition,
      head: [['Data', 'Descrição', 'Categoria', 'Pagamento', 'Cartão', 'Valor']],
      body: expenseData,
      theme: 'striped',
      headStyles: { fillColor: [100, 116, 139] },
      columnStyles: {
        0: { cellWidth: 18 },
        1: { cellWidth: 47 },
        2: { cellWidth: 30 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 14, right: 14 },
      styles: { fontSize: 8 }
    });
  }

  // ============ RODAPÉ ============
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(128);
    doc.text(
      `Página ${i} de ${pageCount} - Gastinho Simples`,
      pageWidth / 2,
      290,
      { align: 'center' }
    );
  }

  const fileName = `relatorio-gastos-${format(startDate, 'yyyy-MM')}.pdf`;

  if (isNativeApp()) {
    // No app nativo: converter para base64 e compartilhar
    const pdfBase64 = doc.output("datauristring").split(",")[1];
    await saveAndShareFile(pdfBase64, fileName);
  } else {
    // No navegador: download direto
    doc.save(fileName);
  }
  
  return fileName;
}
