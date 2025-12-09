import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Expense, PaymentMethod, ExpenseCategory, categoryLabels } from '@/types/expense';
import { RecurringExpense } from '@/types/recurring-expense';
import { Card } from '@/types/card';

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

  // Helper para adicionar nova página se necessário
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

  // ============ GASTOS POR FORMA DE PAGAMENTO ============
  checkPageBreak(50);
  
  const paymentTotals: Record<PaymentMethod, number> = { credit: 0, debit: 0, pix: 0 };
  filteredExpenses.forEach(e => { paymentTotals[e.payment_method] += Number(e.amount); });
  activeRecurring.forEach(e => { paymentTotals[e.payment_method] += Number(e.amount); });

  const paymentData = Object.entries(paymentTotals)
    .filter(([_, value]) => value > 0)
    .map(([method, value]) => {
      const percentage = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : '0';
      return [paymentMethodLabels[method as PaymentMethod], `R$ ${value.toFixed(2)}`, `${percentage}%`];
    });

  if (paymentData.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Gastos por Forma de Pagamento', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Forma de Pagamento', 'Valor', '%']],
      body: paymentData,
      theme: 'striped',
      headStyles: { fillColor: [59, 130, 246] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // ============ GASTOS POR CATEGORIA ============
  checkPageBreak(50);

  const categoryTotals: Partial<Record<ExpenseCategory, number>> = {};
  filteredExpenses.forEach(e => {
    const cat = e.category || 'outros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount);
  });
  activeRecurring.forEach(e => {
    const cat = e.category || 'outros';
    categoryTotals[cat] = (categoryTotals[cat] || 0) + Number(e.amount);
  });

  const categoryData = Object.entries(categoryTotals)
    .filter(([_, value]) => value > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, value]) => {
      const percentage = grandTotal > 0 ? ((value / grandTotal) * 100).toFixed(1) : '0';
      return [categoryLabels[cat as ExpenseCategory], `R$ ${value.toFixed(2)}`, `${percentage}%`];
    });

  if (categoryData.length > 0) {
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('Gastos por Categoria', 14, yPosition);
    yPosition += 8;

    autoTable(doc, {
      startY: yPosition,
      head: [['Categoria', 'Valor', '%']],
      body: categoryData,
      theme: 'striped',
      headStyles: { fillColor: [34, 197, 94] },
      columnStyles: {
        0: { cellWidth: 80 },
        1: { cellWidth: 50, halign: 'right' },
        2: { cellWidth: 30, halign: 'right' }
      },
      margin: { left: 14, right: 14 }
    });

    yPosition = (doc as any).lastAutoTable.finalY + 15;
  }

  // ============ GASTOS POR CARTÃO ============
  if (cards.length > 0) {
    checkPageBreak(50);

    const cardTotals: Record<string, { name: string; value: number }> = {
      'sem-cartao': { name: 'Sem cartão', value: 0 }
    };

    filteredExpenses.forEach(e => {
      if (e.card_id) {
        const card = cards.find(c => c.id === e.card_id);
        if (card) {
          if (!cardTotals[card.id]) {
            cardTotals[card.id] = { name: card.name, value: 0 };
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
            cardTotals[card.id] = { name: card.name, value: 0 };
          }
          cardTotals[card.id].value += Number(e.amount);
        }
      } else {
        cardTotals['sem-cartao'].value += Number(e.amount);
      }
    });

    const cardData = Object.values(cardTotals)
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(item => {
        const percentage = grandTotal > 0 ? ((item.value / grandTotal) * 100).toFixed(1) : '0';
        return [item.name, `R$ ${item.value.toFixed(2)}`, `${percentage}%`];
      });

    if (cardData.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Gastos por Cartão', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Cartão', 'Valor', '%']],
        body: cardData,
        theme: 'striped',
        headStyles: { fillColor: [249, 115, 22] },
        columnStyles: {
          0: { cellWidth: 80 },
          1: { cellWidth: 50, halign: 'right' },
          2: { cellWidth: 30, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
  }

  // ============ GASTOS POR MEMBRO (apenas grupo) ============
  if (isGroupContext && groupMembers.length > 0) {
    checkPageBreak(50);

    const memberTotals: Record<string, { name: string; email: string; value: number }> = {};
    
    filteredExpenses.forEach(e => {
      const member = groupMembers.find(m => m.user_id === e.user_id);
      const email = member?.user_email || 'Desconhecido';
      const name = email.split('@')[0];
      
      if (!memberTotals[e.user_id]) {
        memberTotals[e.user_id] = { name, email, value: 0 };
      }
      memberTotals[e.user_id].value += Number(e.amount);
    });

    const memberData = Object.values(memberTotals)
      .filter(item => item.value > 0)
      .sort((a, b) => b.value - a.value)
      .map(item => {
        const percentage = totalExpenses > 0 ? ((item.value / totalExpenses) * 100).toFixed(1) : '0';
        return [item.name, item.email, `R$ ${item.value.toFixed(2)}`, `${percentage}%`];
      });

    if (memberData.length > 0) {
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text('Gastos por Membro do Grupo', 14, yPosition);
      yPosition += 8;

      autoTable(doc, {
        startY: yPosition,
        head: [['Membro', 'Email', 'Valor', '%']],
        body: memberData,
        theme: 'striped',
        headStyles: { fillColor: [139, 92, 246] },
        columnStyles: {
          0: { cellWidth: 40 },
          1: { cellWidth: 60 },
          2: { cellWidth: 40, halign: 'right' },
          3: { cellWidth: 20, halign: 'right' }
        },
        margin: { left: 14, right: 14 }
      });

      yPosition = (doc as any).lastAutoTable.finalY + 15;
    }
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

    // Total das despesas fixas
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

  // Gerar nome do arquivo
  const fileName = `relatorio-gastos-${format(startDate, 'yyyy-MM')}.pdf`;
  
  // Salvar PDF
  doc.save(fileName);
  
  return fileName;
}
