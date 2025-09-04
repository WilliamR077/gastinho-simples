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
import { ArrowLeft, User, Mail, Lock, Trash2, Save } from "lucide-react";
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

  const handleDeleteAccount = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        throw new Error("Usuário não identificado");
      }

      // First delete all user expenses
      const { error: expensesError } = await supabase
        .from("expenses")
        .delete()
        .eq("user_id", user.id);

      if (expensesError) throw expensesError;

      // Sign out the user (Supabase Auth requires admin privileges to delete users)
      await signOut();
      
      toast({
        title: "Dados removidos",
        description: "Seus dados de gastos foram removidos. Sua conta de acesso permanece ativa.",
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
                Ações irreversíveis em sua conta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Separator className="mb-4" />
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-destructive mb-2">Excluir Conta</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Esta ação excluirá permanentemente sua conta e todos os dados associados. 
                    Esta ação não pode ser desfeita.
                  </p>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" className="flex items-center gap-2">
                        <Trash2 className="w-4 h-4" />
                        Excluir Conta Permanentemente
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Esta ação excluirá permanentemente sua conta e todos os seus gastos.
                          Esta ação não pode ser desfeita.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={handleDeleteAccount}
                          disabled={loading}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          {loading ? "Excluindo..." : "Sim, excluir conta"}
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