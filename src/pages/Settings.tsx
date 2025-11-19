import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings as SettingsIcon, FileDown, FileSpreadsheet, Bug } from "lucide-react";
import { FirebaseNotificationSettings } from "@/components/firebase-notification-settings";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { categoryLabels } from "@/types/expense";
import { sanitizeErrorMessage } from "@/utils/security";

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Audit log helper function
  const logAuditAction = async (action: string, details?: any) => {
    try {
      if (!user?.id) return;
      
      await supabase.from("audit_log").insert({
        user_id: user.id,
        action,
        details,
        user_agent: navigator.userAgent,
      });
    } catch (error) {
      console.error("Failed to log audit action:", error);
    }
  };

  const handleExportToExcel = async () => {
    try {
      if (!user?.id) {
        throw new Error("Usuário não identificado");
      }

      // Fetch all data
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false });

      if (expensesError) throw expensesError;

      const { data: recurringExpenses, error: recurringError } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_month", { ascending: true });

      if (recurringError) throw recurringError;

      const { data: budgetGoals, error: budgetError } = await supabase
        .from("budget_goals")
        .select("*")
        .eq("user_id", user.id);

      if (budgetError) throw budgetError;

      // Prepare data for Excel
      const expensesData = expenses?.map((exp) => ({
        Data: format(new Date(exp.expense_date), "dd/MM/yyyy"),
        Descrição: exp.description,
        Valor: `R$ ${Number(exp.amount).toFixed(2)}`,
        Categoria: categoryLabels[exp.category as keyof typeof categoryLabels] || exp.category,
        "Forma de Pagamento": exp.payment_method === "credit" ? "Cartão de Crédito" : 
                              exp.payment_method === "debit" ? "Cartão de Débito" : "PIX",
        Parcelas: exp.total_installments > 1 ? `${exp.installment_number}/${exp.total_installments}` : "À vista",
      })) || [];

      const recurringData = recurringExpenses?.map((rec) => ({
        Descrição: rec.description,
        Valor: `R$ ${Number(rec.amount).toFixed(2)}`,
        Categoria: categoryLabels[rec.category as keyof typeof categoryLabels] || rec.category,
        "Forma de Pagamento": rec.payment_method === "credit" ? "Cartão de Crédito" : 
                              rec.payment_method === "debit" ? "Cartão de Débito" : "PIX",
        "Dia do Mês": rec.day_of_month,
        Status: rec.is_active ? "Ativa" : "Inativa",
      })) || [];

      const budgetData = budgetGoals?.map((goal) => ({
        Tipo: goal.type === "monthly_total" ? "Total Mensal" : "Por Categoria",
        Categoria: goal.category ? categoryLabels[goal.category as keyof typeof categoryLabels] : "N/A",
        Limite: `R$ ${Number(goal.limit_amount).toFixed(2)}`,
      })) || [];

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add sheets
      const wsExpenses = XLSX.utils.json_to_sheet(expensesData);
      const wsRecurring = XLSX.utils.json_to_sheet(recurringData);
      const wsBudget = XLSX.utils.json_to_sheet(budgetData);
      
      XLSX.utils.book_append_sheet(wb, wsExpenses, "Despesas");
      XLSX.utils.book_append_sheet(wb, wsRecurring, "Despesas Recorrentes");
      XLSX.utils.book_append_sheet(wb, wsBudget, "Metas de Gastos");

      // Download
      XLSX.writeFile(wb, `gastinho-simples-${format(new Date(), "dd-MM-yyyy")}.xlsx`);

      toast({
        title: "Excel exportado!",
        description: "Seus dados foram exportados com sucesso.",
      });

      // Log audit action
      await logAuditAction("data_exported_excel");
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  const handleExportToPDF = async () => {
    try {
      if (!user?.id) {
        throw new Error("Usuário não identificado");
      }

      // Fetch all data
      const { data: expenses, error: expensesError } = await supabase
        .from("expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("expense_date", { ascending: false });

      if (expensesError) throw expensesError;

      const { data: recurringExpenses, error: recurringError } = await supabase
        .from("recurring_expenses")
        .select("*")
        .eq("user_id", user.id)
        .order("day_of_month", { ascending: true });

      if (recurringError) throw recurringError;

      const { data: budgetGoals, error: budgetError } = await supabase
        .from("budget_goals")
        .select("*")
        .eq("user_id", user.id);

      if (budgetError) throw budgetError;

      // Create PDF
      const doc = new jsPDF();
      
      // Title
      doc.setFontSize(18);
      doc.text("Gastinho Simples - Relatório de Dados", 14, 20);
      doc.setFontSize(10);
      doc.text(`Exportado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);
      doc.text(`Usuário: ${user.email}`, 14, 34);

      let yPosition = 45;

      // Expenses table
      if (expenses && expenses.length > 0) {
        doc.setFontSize(14);
        doc.text("Despesas", 14, yPosition);
        yPosition += 5;

        const expensesData = expenses.map((exp) => [
          format(new Date(exp.expense_date), "dd/MM/yyyy"),
          exp.description,
          `R$ ${Number(exp.amount).toFixed(2)}`,
          categoryLabels[exp.category as keyof typeof categoryLabels] || exp.category,
          exp.payment_method === "credit" ? "Cartão" : 
          exp.payment_method === "debit" ? "Débito" : "PIX",
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Data", "Descrição", "Valor", "Categoria", "Pagamento"]],
          body: expensesData,
          theme: "grid",
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Recurring Expenses table
      if (recurringExpenses && recurringExpenses.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text("Despesas Recorrentes", 14, yPosition);
        yPosition += 5;

        const recurringData = recurringExpenses.map((rec) => [
          rec.description,
          `R$ ${Number(rec.amount).toFixed(2)}`,
          categoryLabels[rec.category as keyof typeof categoryLabels] || rec.category,
          rec.day_of_month.toString(),
          rec.is_active ? "Ativa" : "Inativa",
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Descrição", "Valor", "Categoria", "Dia", "Status"]],
          body: recurringData,
          theme: "grid",
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
        });

        yPosition = (doc as any).lastAutoTable.finalY + 10;
      }

      // Budget Goals table
      if (budgetGoals && budgetGoals.length > 0) {
        if (yPosition > 250) {
          doc.addPage();
          yPosition = 20;
        }

        doc.setFontSize(14);
        doc.text("Metas de Gastos", 14, yPosition);
        yPosition += 5;

        const budgetData = budgetGoals.map((goal) => [
          goal.type === "monthly_total" ? "Total Mensal" : "Por Categoria",
          goal.category ? categoryLabels[goal.category as keyof typeof categoryLabels] : "N/A",
          `R$ ${Number(goal.limit_amount).toFixed(2)}`,
        ]);

        autoTable(doc, {
          startY: yPosition,
          head: [["Tipo", "Categoria", "Limite"]],
          body: budgetData,
          theme: "grid",
          styles: { fontSize: 8 },
          headStyles: { fillColor: [59, 130, 246] },
        });
      }

      // Download
      doc.save(`gastinho-simples-${format(new Date(), "dd-MM-yyyy")}.pdf`);

      toast({
        title: "PDF exportado!",
        description: "Seus dados foram exportados com sucesso.",
      });

      // Log audit action
      await logAuditAction("data_exported_pdf");
    } catch (error: any) {
      toast({
        title: "Erro ao exportar",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-4xl mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
        </div>

        {/* Título */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-primary" />
            <h1 className="text-3xl font-bold">Configurações</h1>
          </div>
          <p className="text-muted-foreground">
            Personalize e configure seu aplicativo
          </p>
        </div>

        {/* Seção: Exportar Dados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Exportar Dados
            </CardTitle>
            <CardDescription>
              Baixe todos os seus dados em formato Excel ou PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <Button onClick={handleExportToExcel} className="flex-1 gap-2">
                <FileSpreadsheet className="h-4 w-4" />
                Exportar para Excel
              </Button>
              <Button onClick={handleExportToPDF} variant="outline" className="flex-1 gap-2">
                <FileDown className="h-4 w-4" />
                Exportar para PDF
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Seção: Notificações */}
        <FirebaseNotificationSettings />

        <Separator />

        {/* Seção: Debug */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bug className="h-5 w-5" />
              Debug de Notificações
            </CardTitle>
            <CardDescription>
              Ferramentas para desenvolvedores e testes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="outline"
              onClick={() => navigate("/notification-debug")}
              className="gap-2"
            >
              <Bug className="h-4 w-4" />
              Abrir Painel de Debug
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
