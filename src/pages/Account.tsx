import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, User, Mail, Lock, Trash2, Save, Shield, FileDown, FileSpreadsheet } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { validatePasswordStrength, sanitizeErrorMessage, isEmailValid } from "@/utils/security";
import { Progress } from "@/components/ui/progress";
import { CreditCardConfig } from "@/components/credit-card-config";
import { NotificationSettings } from "@/components/notification-settings";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { format } from "date-fns";
import { categoryLabels } from "@/types/expense";

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Form states
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(validatePasswordStrength(""));
  
  // Confirmation states for danger zone
  const [clearDataConfirmation, setClearDataConfirmation] = useState("");
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");

  const handleUpdateEmail = async () => {
    if (!newEmail || newEmail === user?.email) {
      toast({
        title: "Email inválido",
        description: "Digite um email diferente do atual.",
        variant: "destructive",
      });
      return;
    }

    if (!isEmailValid(newEmail)) {
      toast({
        title: "Email inválido",
        description: "Digite um email válido.",
        variant: "destructive",
      });
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        email: newEmail
      });

      if (error) throw error;

      toast({
        title: "Email atualizado!",
        description: "Verifique seu novo email para confirmar a alteração.",
      });
      
      // Log audit action
      await logAuditAction("email_change", { old_email: user?.email, new_email: newEmail });
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar email",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setEmailLoading(false);
    }
  };

  const handleUpdatePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos de senha.",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Senhas não conferem",
        description: "A nova senha e confirmação devem ser iguais.",
        variant: "destructive",
      });
      return;
    }

    if (!passwordStrength.isValid) {
      toast({
        title: "Senha não atende aos requisitos",
        description: passwordStrength.feedback.join(", "),
        variant: "destructive",
      });
      return;
    }

    setPasswordLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setPasswordStrength(validatePasswordStrength(""));

      toast({
        title: "Senha atualizada!",
        description: "Sua senha foi alterada com sucesso.",
      });
      
      // Log audit action
      await logAuditAction("password_change");
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar senha",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setPasswordLoading(false);
    }
  };

  const handlePasswordChange = (value: string) => {
    setNewPassword(value);
    setPasswordStrength(validatePasswordStrength(value));
  };

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

  const handleClearAllExpenses = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error("Usuário não identificado");
      }

      // Delete all user expenses
      const { error: expensesError } = await supabase
        .from("expenses")
        .delete()
        .eq("user_id", user.id);

      if (expensesError) throw expensesError;

      // Delete all recurring expenses
      const { error: recurringError } = await supabase
        .from("recurring_expenses")
        .delete()
        .eq("user_id", user.id);

      if (recurringError) throw recurringError;

      // Delete credit card config
      const { error: configError } = await supabase
        .from("credit_card_configs")
        .delete()
        .eq("user_id", user.id);

      if (configError) throw configError;

      // Log audit action before showing success
      await logAuditAction("data_cleared", { 
        message: "All expenses, recurring expenses, and credit card config cleared" 
      });

      toast({
        title: "Dados limpos com sucesso",
        description: "Todos os seus gastos, despesas recorrentes e configurações foram removidos. Sua conta permanece ativa.",
      });

      // Reset confirmation field
      setClearDataConfirmation("");
      
      // Refresh the page to show empty state
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Erro ao limpar dados",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteAccountCompletely = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error("Usuário não identificado");
      }

      // First clear all expenses (reuse the logic)
      const { error: expensesError } = await supabase
        .from("expenses")
        .delete()
        .eq("user_id", user.id);

      if (expensesError) throw expensesError;

      const { error: recurringError } = await supabase
        .from("recurring_expenses")
        .delete()
        .eq("user_id", user.id);

      if (recurringError) throw recurringError;

      const { error: configError } = await supabase
        .from("credit_card_configs")
        .delete()
        .eq("user_id", user.id);

      if (configError) throw configError;

      // Log audit action before sign out
      await logAuditAction("account_deletion_requested", {
        message: "User requested full account deletion"
      });

      // Note: Supabase Auth requires admin privileges to delete users
      // For now, we just sign out the user after clearing data
      await signOut();

      toast({
        title: "Conta encerrada",
        description: "Todos os seus dados foram removidos e você foi desconectado. Para excluir completamente sua conta do sistema, entre em contato com o suporte.",
      });

      navigate("/auth");
    } catch (error: any) {
      toast({
        title: "Erro ao excluir conta",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-gradient-primary shadow-elegant">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Minha Conta</h1>
              <p className="text-muted-foreground">Gerencie suas informações pessoais</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Credit Card Configuration */}
          <CreditCardConfig />

          {/* Notification Settings */}
          <NotificationSettings />

          {/* Export Data Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileDown className="w-5 h-5" />
                Exportar Dados
              </CardTitle>
              <CardDescription>
                Baixe todos os seus dados em diferentes formatos
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Exporte suas despesas, despesas recorrentes e metas de gastos para Excel ou PDF.
              </p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={handleExportToExcel}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  Exportar para Excel
                </Button>
                <Button
                  onClick={handleExportToPDF}
                  variant="outline"
                  className="flex items-center gap-2"
                >
                  <FileDown className="w-4 h-4" />
                  Exportar para PDF
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações da Conta
              </CardTitle>
              <CardDescription>
                Dados básicos do seu perfil
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="userId">ID do Usuário</Label>
                  <Input
                    id="userId"
                    value={user?.id || ""}
                    disabled
                    className="font-mono text-sm"
                  />
                </div>
                <div>
                  <Label htmlFor="createdAt">Membro desde</Label>
                  <Input
                    id="createdAt"
                    value={user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : ""}
                    disabled
                  />
                </div>
              </div>


              {/* Botão de Política de Privacidade */}
              <div className="pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/privacy")}
                  className="flex items-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  Política de Privacidade
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Email Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Alterar Email
              </CardTitle>
              <CardDescription>
                Atualize seu endereço de email
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="currentEmail">Email Atual</Label>
                <Input
                  id="currentEmail"
                  value={user?.email || ""}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="newEmail">Novo Email</Label>
                <Input
                  id="newEmail"
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Digite seu novo email"
                />
              </div>
              <Button
                onClick={handleUpdateEmail}
                disabled={emailLoading || !newEmail || newEmail === user?.email}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {emailLoading ? "Atualizando..." : "Atualizar Email"}
              </Button>
            </CardContent>
          </Card>

          {/* Password Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Alterar Senha
              </CardTitle>
              <CardDescription>
                Atualize sua senha de acesso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                  placeholder="Digite sua nova senha"
                />
                {newPassword && (
                  <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-sm">
                      <span>Força da senha:</span>
                      <span className={
                        passwordStrength.score >= 4 ? "text-green-600" :
                          passwordStrength.score >= 3 ? "text-yellow-600" :
                            "text-red-600"
                      }>
                        {passwordStrength.score >= 4 ? "Forte" :
                          passwordStrength.score >= 3 ? "Média" : "Fraca"}
                      </span>
                    </div>
                    <Progress value={(passwordStrength.score / 5) * 100} className="h-2" />
                    {passwordStrength.feedback.length > 0 && (
                      <ul className="text-xs text-muted-foreground space-y-1">
                        {passwordStrength.feedback.map((item, index) => (
                          <li key={index}>• {item}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
              <div>
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirme sua nova senha"
                />
              </div>
              <Button
                onClick={handleUpdatePassword}
                disabled={passwordLoading || !newPassword || !confirmPassword}
                className="flex items-center gap-2"
              >
                <Save className="w-4 h-4" />
                {passwordLoading ? "Atualizando..." : "Atualizar Senha"}
              </Button>
            </CardContent>
          </Card>

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Zona de Perigo
              </CardTitle>
              <CardDescription>
                Ações irreversíveis em sua conta e dados
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Separator className="mb-6" />
              <div className="space-y-6">
                {/* Clear All Expenses - Light red */}
                <div className="p-4 rounded-lg border border-orange-200 bg-orange-50 dark:bg-orange-950/20 dark:border-orange-900">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-md bg-orange-100 dark:bg-orange-900/40">
                      <Trash2 className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-orange-900 dark:text-orange-300 mb-1">
                        🗑️ Limpar Todos os Meus Gastos
                      </h3>
                      <p className="text-sm text-orange-700 dark:text-orange-400">
                        Remove todas as despesas, despesas recorrentes e configurações do cartão.
                        <strong className="block mt-1">Sua conta permanecerá ativa.</strong>
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="outline" 
                        className="flex items-center gap-2 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-400 dark:hover:bg-orange-900/40"
                      >
                        <Trash2 className="w-4 h-4" />
                        Limpar Todos os Dados
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>⚠️ Limpar todos os gastos?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p>Esta ação irá remover permanentemente:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Todas as suas despesas registradas</li>
                            <li>Todas as despesas recorrentes</li>
                            <li>Configurações do cartão de crédito</li>
                          </ul>
                          <p className="font-semibold mt-3">
                            Sua conta de acesso permanecerá ativa e você poderá continuar usando o sistema.
                          </p>
                          <p className="text-destructive font-bold">Esta ação não pode ser desfeita!</p>
                          
                          <div className="space-y-2 mt-4">
                            <Label htmlFor="clearConfirmation">
                              Para confirmar, digite <strong>CONFIRMAR</strong> abaixo:
                            </Label>
                            <Input
                              id="clearConfirmation"
                              value={clearDataConfirmation}
                              onChange={(e) => setClearDataConfirmation(e.target.value)}
                              placeholder="Digite CONFIRMAR"
                              className="font-mono"
                            />
                          </div>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setClearDataConfirmation("")}>
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearAllExpenses}
                          disabled={loading || clearDataConfirmation !== "CONFIRMAR"}
                          className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800 disabled:opacity-50"
                        >
                          {loading ? "Limpando..." : "Sim, limpar todos os dados"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>

                <Separator />

                {/* Delete Account Completely - Dark red */}
                <div className="p-4 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-900">
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 rounded-md bg-red-100 dark:bg-red-900/40">
                      <Trash2 className="w-5 h-5 text-red-700 dark:text-red-400" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-red-900 dark:text-red-300 mb-1">
                        ⚠️ Excluir Conta Permanentemente
                      </h3>
                      <p className="text-sm text-red-700 dark:text-red-400">
                        Remove todos os dados e encerra sua conta completamente.
                        <strong className="block mt-1">Você não poderá mais acessar o sistema com esta conta.</strong>
                      </p>
                    </div>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="destructive" 
                        className="flex items-center gap-2 bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800"
                      >
                        <Trash2 className="w-4 h-4" />
                        Excluir Conta Completamente
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="max-w-md">
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">🚨 EXCLUIR CONTA PERMANENTEMENTE?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p className="font-bold text-destructive">ATENÇÃO: Esta é uma ação IRREVERSÍVEL!</p>
                          <p>Esta ação irá:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Remover TODAS as suas despesas</li>
                            <li>Remover TODAS as despesas recorrentes</li>
                            <li>Remover suas configurações</li>
                            <li>Encerrar sua conta de acesso</li>
                          </ul>
                          <p className="font-semibold mt-3 text-destructive">
                            Você será desconectado e não poderá mais acessar o sistema com esta conta.
                          </p>
                          
                          <div className="space-y-3 mt-4 p-3 bg-destructive/10 rounded-md">
                            <div className="space-y-2">
                              <Label htmlFor="deleteAccountConfirmation">
                                Digite <strong>DELETAR MINHA CONTA</strong> para confirmar:
                              </Label>
                              <Input
                                id="deleteAccountConfirmation"
                                value={deleteAccountConfirmation}
                                onChange={(e) => setDeleteAccountConfirmation(e.target.value)}
                                placeholder="Digite DELETAR MINHA CONTA"
                                className="font-mono text-xs"
                              />
                            </div>
                          </div>
                          
                          <p className="text-xs text-muted-foreground mt-3">
                            Nota: Para exclusão completa dos dados de autenticação do Supabase, entre em contato com o suporte após esta ação.
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => {
                          setDeleteAccountConfirmation("");
                        }}>
                          Cancelar
                        </AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccountCompletely}
                          disabled={loading || deleteAccountConfirmation !== "DELETAR MINHA CONTA"}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
                        >
                          {loading ? "Excluindo..." : "Sim, EXCLUIR MINHA CONTA"}
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}