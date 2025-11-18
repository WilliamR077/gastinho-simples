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
import { ArrowLeft, User, Mail, Lock, Trash2 } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { validatePasswordStrength, sanitizeErrorMessage, isEmailValid } from "@/utils/security";
import { Progress } from "@/components/ui/progress";

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

      // Log audit action before deletion
      await logAuditAction("account_deletion_requested", {
        message: "User requested full account deletion"
      });

      // Call the Edge Function to delete the account permanently
      const { data, error } = await supabase.functions.invoke('delete-user-account', {
        method: 'POST',
      });

      if (error) {
        console.error('Error calling delete-user-account function:', error);
        throw new Error(`Falha ao deletar conta: ${error.message || 'Erro desconhecido'}`);
      }

      toast({
        title: "Conta deletada",
        description: "Sua conta foi permanentemente deletada. Você será redirecionado para a página de login.",
      });

      // Sign out and redirect to auth page
      await signOut();
      navigate('/auth');
    } catch (error: any) {
      console.error('Delete account error:', error);
      toast({
        title: "Erro ao deletar conta",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setLoading(false);
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
              <p className="text-muted-foreground">Gerencie suas informações pessoais e segurança</p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Account Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Informações da Conta
              </CardTitle>
              <CardDescription>
                Dados básicos da sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm text-muted-foreground">ID do Usuário</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded mt-1 break-all">{user?.id}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Conta criada em</Label>
                <p className="text-sm font-mono bg-muted p-2 rounded mt-1">
                  {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  }) : 'N/A'}
                </p>
              </div>
            </CardContent>
          </Card>

          <Separator />

          {/* Email Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Gerenciamento de Email
              </CardTitle>
              <CardDescription>
                Atualize o email associado à sua conta
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email atual: {user?.email}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="Digite o novo email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleUpdateEmail}
                disabled={emailLoading}
                className="w-full"
              >
                {emailLoading ? "Atualizando..." : "Atualizar Email"}
              </Button>
              <p className="text-xs text-muted-foreground">
                Você receberá um email de confirmação no novo endereço
              </p>
            </CardContent>
          </Card>

          <Separator />

          {/* Password Management */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="w-5 h-5" />
                Gerenciamento de Senha
              </CardTitle>
              <CardDescription>
                Altere sua senha de acesso
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Nova Senha</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Digite a nova senha"
                  value={newPassword}
                  onChange={(e) => handlePasswordChange(e.target.value)}
                />
                {newPassword && (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Força da senha:</span>
                      <span className={
                        passwordStrength.score >= 80 ? "text-green-500" :
                        passwordStrength.score >= 60 ? "text-yellow-500" :
                        "text-red-500"
                      }>
                        {passwordStrength.score >= 80 ? "Forte" :
                         passwordStrength.score >= 60 ? "Média" :
                         "Fraca"}
                      </span>
                    </div>
                    <Progress value={passwordStrength.score} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      Mínimo 8 caracteres com letras maiúsculas, minúsculas, números e símbolos
                    </p>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirme a nova senha"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleUpdatePassword}
                disabled={passwordLoading}
                className="w-full"
              >
                {passwordLoading ? "Atualizando..." : "Atualizar Senha"}
              </Button>
            </CardContent>
          </Card>

          <Separator />

          {/* Danger Zone */}
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-destructive">
                <Trash2 className="w-5 h-5" />
                Zona de Perigo
              </CardTitle>
              <CardDescription>
                Ações irreversíveis que afetam seus dados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Clear All Data */}
              <div className="p-4 border border-yellow-500/50 bg-yellow-500/10 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Trash2 className="w-4 h-4" />
                  Limpar Todos os Dados
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Remove todas as suas despesas, despesas recorrentes e configurações. Sua conta permanecerá ativa.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="w-full border-yellow-500 text-yellow-600 hover:bg-yellow-500/10">
                      Limpar Dados
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá <strong>deletar permanentemente</strong>:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Todas as despesas</li>
                          <li>Todas as despesas recorrentes</li>
                          <li>Todas as configurações de cartão de crédito</li>
                        </ul>
                        <br />
                        Sua conta permanecerá ativa e você poderá começar do zero.
                        <br /><br />
                        Para confirmar, digite <strong>LIMPAR</strong> abaixo:
                      </AlertDialogDescription>
                      <Input
                        placeholder="Digite LIMPAR"
                        value={clearDataConfirmation}
                        onChange={(e) => setClearDataConfirmation(e.target.value)}
                        className="mt-2"
                      />
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => setClearDataConfirmation("")}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleClearAllExpenses}
                        disabled={clearDataConfirmation !== "LIMPAR" || loading}
                        className="bg-yellow-600 hover:bg-yellow-700"
                      >
                        {loading ? "Limpando..." : "Confirmar Limpeza"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              {/* Delete Account */}
              <div className="p-4 border border-destructive bg-destructive/10 rounded-lg">
                <h4 className="font-semibold mb-2 flex items-center gap-2 text-destructive">
                  <Trash2 className="w-4 h-4" />
                  Deletar Conta Permanentemente
                </h4>
                <p className="text-sm text-muted-foreground mb-4">
                  Remove completamente sua conta e TODOS os dados associados. Esta ação é irreversível.
                </p>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="w-full">
                      Deletar Conta
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-destructive">ATENÇÃO: Deletar Conta</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação irá <strong className="text-destructive">deletar permanentemente</strong>:
                        <ul className="list-disc list-inside mt-2 space-y-1">
                          <li>Sua conta de usuário</li>
                          <li>Todas as suas despesas</li>
                          <li>Todas as despesas recorrentes</li>
                          <li>Todas as configurações</li>
                          <li>Todo o histórico de logs</li>
                        </ul>
                        <br />
                        <strong className="text-destructive">Esta ação NÃO pode ser desfeita!</strong>
                        <br /><br />
                        Para confirmar, digite <strong>DELETAR CONTA</strong> abaixo:
                      </AlertDialogDescription>
                      <Input
                        placeholder="Digite DELETAR CONTA"
                        value={deleteAccountConfirmation}
                        onChange={(e) => setDeleteAccountConfirmation(e.target.value)}
                        className="mt-2"
                      />
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel onClick={() => {
                        setDeleteAccountConfirmation("");
                        setDeleteAccountPassword("");
                      }}>
                        Cancelar
                      </AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeleteAccountCompletely}
                        disabled={deleteAccountConfirmation !== "DELETAR CONTA" || loading}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {loading ? "Deletando..." : "Confirmar Deleção"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}