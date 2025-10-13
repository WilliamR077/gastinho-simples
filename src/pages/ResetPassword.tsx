import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { validatePasswordStrength, sanitizeErrorMessage } from "@/utils/security";
import { Progress } from "@/components/ui/progress";

export default function ResetPassword() {
  const [isLoading, setIsLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordStrength, setPasswordStrength] = useState(validatePasswordStrength(""));
  const [hasValidToken, setHasValidToken] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // Check if we have a valid recovery token
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setHasValidToken(true);
      } else {
        toast({
          title: "Link inválido ou expirado",
          description: "Solicite um novo link de recuperação",
          variant: "destructive",
        });
        navigate("/auth");
      }
    });
  }, [navigate, toast]);

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setPasswordStrength(validatePasswordStrength(value));
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!passwordStrength.isValid) {
      toast({
        title: "Senha não atende aos requisitos",
        description: passwordStrength.feedback.join(", "),
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({
        title: "Senhas não coincidem",
        description: "Digite a mesma senha nos dois campos",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    const { error } = await supabase.auth.updateUser({
      password: password,
    });

    if (error) {
      toast({
        title: "Erro ao redefinir senha",
        description: sanitizeErrorMessage(error),
        variant: "destructive",
      });
    } else {
      toast({
        title: "Senha redefinida com sucesso!",
        description: "Você já pode fazer login com sua nova senha.",
      });
      navigate("/auth");
    }

    setIsLoading(false);
  };

  if (!hasValidToken) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-secondary/20 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl text-center">Redefinir Senha</CardTitle>
          <CardDescription className="text-center">
            Digite sua nova senha abaixo
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                required
                minLength={8}
              />
              {password && (
                <div className="space-y-2">
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
            
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
              />
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Redefinindo..." : "Redefinir senha"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
