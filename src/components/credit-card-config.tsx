import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { CreditCard, Save, Settings } from "lucide-react";

interface CreditCardConfig {
  id?: string;
  opening_day: number;
  closing_day: number;
}

export function CreditCardConfig() {
  const [config, setConfig] = useState<CreditCardConfig>({ opening_day: 1, closing_day: 15 });
  const [closingDay, setClosingDay] = useState(15);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      loadConfig();
    }
  }, [user]);

  const loadConfig = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("credit_card_configs")
        .select("*")
        .eq("user_id", user?.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setConfig(data);
        setClosingDay(data.closing_day);
      }
    } catch (error) {
      console.error("Error loading credit card config:", error);
      toast({
        title: "Erro ao carregar configuração",
        description: "Não foi possível carregar as configurações do cartão.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfig = async () => {
    if (!user) return;

    // Validações
    if (closingDay < 1 || closingDay > 31) {
      toast({
        title: "Dia inválido",
        description: "O dia de fechamento deve ser entre 1 e 31.",
        variant: "destructive",
      });
      return;
    }

    // Calcula o dia de abertura (um dia depois do fechamento)
    const openingDay = closingDay === 31 ? 1 : closingDay + 1;

    try {
      setSaving(true);

      if (config.id) {
        // Update existing config
        const { error } = await supabase
          .from("credit_card_configs")
          .update({
            opening_day: openingDay,
            closing_day: closingDay,
          })
          .eq("id", config.id);

        if (error) throw error;
      } else {
        // Create new config
        const { data, error } = await supabase
          .from("credit_card_configs")
          .insert({
            user_id: user.id,
            opening_day: openingDay,
            closing_day: closingDay,
          })
          .select()
          .single();

        if (error) throw error;
        setConfig(data);
      }

      toast({
        title: "Configuração salva!",
        description: "As datas da fatura foram configuradas com sucesso.",
      });
    } catch (error) {
      console.error("Error saving credit card config:", error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as configurações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CreditCard className="h-5 w-5 text-primary" />
          <CardTitle>Configuração do Cartão de Crédito</CardTitle>
        </div>
        <CardDescription>
          Configure os dias de abertura e fechamento da fatura do seu cartão de crédito
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="closing-day">Dia de Fechamento da Fatura</Label>
            <Input
              id="closing-day"
              type="number"
              min="1"
              max="31"
              value={closingDay}
              onChange={(e) => setClosingDay(parseInt(e.target.value) || 15)}
              placeholder="Ex: 15"
            />
            <p className="text-sm text-muted-foreground">
              Dia do mês em que a fatura fecha (1-31)
            </p>
          </div>

          {closingDay && (
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm font-medium text-primary">
                Período da fatura: Dia {closingDay === 31 ? 1 : closingDay + 1} até dia {closingDay}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                A abertura será automaticamente um dia após o fechamento
              </p>
            </div>
          )}
        </div>

        <div className="bg-muted/50 rounded-lg p-4">
          <div className="flex items-start gap-2">
            <Settings className="h-4 w-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Como funciona:</p>
              <p>• <strong>Fechamento:</strong> Dia em que a fatura fecha</p>
              <p>• <strong>Abertura:</strong> Automaticamente um dia após o fechamento</p>
              <p className="mt-2">
                Exemplo: Se fechamento é dia 15, a fatura vai de dia 16 até dia 15 do mês seguinte.
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={saveConfig} 
          disabled={saving}
          className="w-full"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvando..." : "Salvar Configuração"}
        </Button>
      </CardContent>
    </Card>
  );
}