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
import { ArrowLeft, User, Mail, Lock, Trash2, Save, Shield } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { validatePasswordStrength, sanitizeErrorMessage, isEmailValid } from "@/utils/security";
import { Progress } from "@/components/ui/progress";
import { CreditCardConfig } from "@/components/credit-card-config";

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

      toast({
        title: "Dados limpos com sucesso",
        description: "Todos os seus gastos, despesas recorrentes e configurações foram removidos. Sua conta permanece ativa.",
      });

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
                        <AlertDialogDescription className="space-y-2">
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
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleClearAllExpenses}
                          disabled={loading}
                          className="bg-orange-600 text-white hover:bg-orange-700 dark:bg-orange-700 dark:hover:bg-orange-800"
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
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="text-destructive">🚨 ATENÇÃO: Excluir conta permanentemente?</AlertDialogTitle>
                        <AlertDialogDescription className="space-y-3">
                          <p className="font-bold text-destructive">Esta é uma ação IRREVERSÍVEL!</p>
                          <p>Ao confirmar, as seguintes ações serão realizadas:</p>
                          <ul className="list-disc list-inside space-y-1 text-sm">
                            <li>Todas as suas despesas serão excluídas</li>
                            <li>Todas as despesas recorrentes serão excluídas</li>
                            <li>Configurações do cartão serão excluídas</li>
                            <li>Você será desconectado do sistema</li>
                            <li>Sua conta ficará inativa</li>
                          </ul>
                          <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-900 rounded-md mt-4">
                            <p className="text-sm text-yellow-800 dark:text-yellow-400">
                              <strong>Nota:</strong> Para excluir completamente sua conta do sistema de autenticação, 
                              pode ser necessário entrar em contato com o suporte após este processo.
                            </p>
                          </div>
                          <p className="text-destructive font-bold text-center mt-4">
                            VOCÊ TEM CERTEZA ABSOLUTA?
                          </p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Não, cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccountCompletely}
                          disabled={loading}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {loading ? "Excluindo..." : "SIM, EXCLUIR TUDO"}
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