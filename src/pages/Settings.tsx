import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Settings as SettingsIcon, FileDown, FileSpreadsheet, Crown, Lock, GraduationCap, Upload } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { useState } from "react";
import { SpreadsheetImportSheet } from "@/components/spreadsheet-import-sheet";
import { FirebaseNotificationSettings } from "@/components/firebase-notification-settings";
import { SecuritySettings } from "@/components/security-settings";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { categoryLabels } from "@/types/expense";
import { parseLocalDate } from "@/lib/utils";
import { sanitizeErrorMessage } from "@/utils/security";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { Footer } from "@/components/footer";

const TOUR_STORAGE_KEY = "gastinho_tour_completed";

// Helper para detectar se está no app nativo
const isNativeApp = () => Capacitor.isNativePlatform();

// Helper para salvar e compartilhar arquivo no app
const saveAndShareFile = async (base64Data: string, fileName: string, mimeType: string) => {
  try {
    // Salvar arquivo no dispositivo
    const result = await Filesystem.writeFile({
      path: fileName,
      data: base64Data,
      directory: Directory.Cache,
    });

    // Compartilhar o arquivo
    await Share.share({
      title: fileName,
      url: result.uri,
      dialogTitle: "Exportar arquivo",
    });

    return true;
  } catch (error) {
    console.error("Erro ao salvar/compartilhar arquivo:", error);
    throw error;
  }
};

export default function Settings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canExportPdf, canExportExcel, canImportSpreadsheet, importLimit } = useSubscription();
  const [importSheetOpen, setImportSheetOpen] = useState(false);

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
    if (!canExportExcel) {
      toast({
        title: "Recurso Premium 👑",
        description: "A exportação para Excel está disponível apenas para assinantes Premium. Faça upgrade para desbloquear!",
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }

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
        Data: format(parseLocalDate(exp.expense_date), "dd/MM/yyyy"),
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

      const fileName = `gastinho-simples-${format(new Date(), "dd-MM-yyyy")}.xlsx`;

      if (isNativeApp()) {
        // No app: converter para base64 e compartilhar
        const wbout = XLSX.write(wb, { bookType: "xlsx", type: "base64" });
        await saveAndShareFile(wbout, fileName, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      } else {
        // No navegador: download direto
        XLSX.writeFile(wb, fileName);
      }

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
    if (!canExportPdf) {
      toast({
        title: "Recurso Premium 👑",
        description: "A exportação para PDF está disponível apenas para assinantes Premium. Faça upgrade para desbloquear!",
        variant: "destructive",
      });
      navigate("/subscription");
      return;
    }

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
          format(parseLocalDate(exp.expense_date), "dd/MM/yyyy"),
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

      const fileName = `gastinho-simples-${format(new Date(), "dd-MM-yyyy")}.pdf`;

      if (isNativeApp()) {
        // No app: converter para base64 e compartilhar
        const pdfBase64 = doc.output("datauristring").split(",")[1];
        await saveAndShareFile(pdfBase64, fileName, "application/pdf");
      } else {
        // No navegador: download direto
        doc.save(fileName);
      }

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
    <div className="min-h-screen bg-background pb-16">
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

        {/* Seção: Segurança */}
        <SecuritySettings />

        <Separator />

        {/* Seção: Exportar Dados */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileDown className="h-5 w-5" />
              Exportar Dados
              {(!canExportPdf || !canExportExcel) && (
                <Crown className="h-4 w-4 text-primary ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Baixe todos os seus dados em formato Excel ou PDF
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {(!canExportPdf || !canExportExcel) && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Crown className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">📁 Exportações Premium</h4>
                    <p className="text-sm text-muted-foreground">
                      Salve seus dados para análise externa ou backup seguro em Excel e PDF.
                      Disponível nos planos Premium e Premium Plus.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <div className="flex flex-col sm:flex-row gap-3">
              <Button 
                onClick={handleExportToExcel} 
                className="flex-1 gap-2"
                disabled={!canExportExcel}
              >
                {!canExportExcel && <Lock className="h-4 w-4" />}
                <FileSpreadsheet className="h-4 w-4" />
                Exportar para Excel
                {!canExportExcel && <Crown className="h-4 w-4 ml-auto" />}
              </Button>
              <Button 
                onClick={handleExportToPDF} 
                variant="outline" 
                className="flex-1 gap-2"
                disabled={!canExportPdf}
              >
                {!canExportPdf && <Lock className="h-4 w-4" />}
                <FileDown className="h-4 w-4" />
                Exportar para PDF
                {!canExportPdf && <Crown className="h-4 w-4 ml-auto" />}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Separator />

        {/* Seção: Importar Planilha */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Importar Planilha
              {!canImportSpreadsheet && (
                <Crown className="h-4 w-4 text-primary ml-auto" />
              )}
            </CardTitle>
            <CardDescription>
              Importe gastos de uma planilha Excel ou CSV
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!canImportSpreadsheet && (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Crown className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1">
                    <h4 className="font-semibold mb-1">📊 Importação Premium</h4>
                    <p className="text-sm text-muted-foreground">
                      Migre seus gastos de planilhas existentes para o Gastinho Simples facilmente.
                      Premium: até 100 itens | Premium Plus: até 500 itens.
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Button 
              onClick={() => setImportSheetOpen(true)} 
              variant="outline"
              className="w-full gap-2"
              disabled={!canImportSpreadsheet}
            >
              {!canImportSpreadsheet && <Lock className="h-4 w-4" />}
              <FileSpreadsheet className="h-4 w-4" />
              Importar Planilha
              {!canImportSpreadsheet && <Crown className="h-4 w-4 ml-auto" />}
            </Button>
            {canImportSpreadsheet && (
              <p className="text-xs text-muted-foreground text-center">
                Limite: até {importLimit} gastos por importação
              </p>
            )}
          </CardContent>
        </Card>

        <Separator />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <GraduationCap className="h-5 w-5" />
              Tutorial
            </CardTitle>
            <CardDescription>
              Aprenda como usar o aplicativo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              onClick={() => {
                localStorage.removeItem(TOUR_STORAGE_KEY);
                navigate("/");
                toast({
                  title: "Tutorial reiniciado",
                  description: "Volte para a tela inicial para ver o tutorial novamente.",
                });
              }}
              variant="outline"
              className="w-full gap-2"
            >
              <GraduationCap className="h-4 w-4" />
              Ver tutorial novamente
            </Button>
          </CardContent>
        </Card>

        <Separator />

        {/* Seção: Notificações */}
        <FirebaseNotificationSettings />
      </div>
      
      {/* Import Sheet */}
      <SpreadsheetImportSheet 
        open={importSheetOpen} 
        onOpenChange={setImportSheetOpen}
        onSuccess={() => {
          toast({
            title: "Importação concluída!",
            description: "Seus gastos foram importados com sucesso.",
          });
        }}
      />
      <Footer />
    </div>
  );
}
