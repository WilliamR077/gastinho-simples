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
import { ArrowLeft, User, Mail, Lock, Trash2, Crown, Eye, EyeOff } from "lucide-react";
import { useSubscription } from "@/hooks/use-subscription";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { validatePasswordStrength, sanitizeErrorMessage, isEmailValid } from "@/utils/security";
import { Progress } from "@/components/ui/progress";

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { tier, features } = useSubscription();
  const [loading, setLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Form states
  const [newEmail, setNewEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(validatePasswordStrength(""));
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
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
    <div className="min-h-screen bg-background pb-16">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
            className="shrink-0 mt-1"
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-full bg-gradient-primary shadow-elegant">
              <User className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-foreground">Minha Conta</h1>
              <p className="text-muted-foreground">
                Gerencie suas informações pessoais • Conta criada em {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-6">
          {/* Subscription Section */}
          <Card className="border-primary/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Crown className="w-5 h-5 text-primary" />
                Assinatura e Planos
              </CardTitle>
              <CardDescription>
                Gerencie sua assinatura e veja outros planos disponíveis
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-4">
                <p className="text-sm font-semibold mb-1">Plano Atual</p>
                <p className="text-lg font-bold text-primary">{features.name}</p>
                <p className="text-sm text-muted-foreground mt-1">{features.price}</p>
              </div>
              <Button 
                onClick={() => navigate("/subscription")} 
                className="w-full gap-2"
                variant="outline"
              >
                <Crown className="h-4 w-4" />
                Ver Todos os Planos
              </Button>
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
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="Digite a nova senha"
                    value={newPassword}
                    onChange={(e) => handlePasswordChange(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
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
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirme a nova senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
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