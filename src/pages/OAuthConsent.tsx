import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

// Wrapper tipado para o namespace beta supabase.auth.oauth.
type OAuthApi = {
  getAuthorizationDetails: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  approveAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
  denyAuthorization: (id: string) => Promise<{ data: any; error: { message: string } | null }>;
};

function getOAuth(): OAuthApi | null {
  const anyAuth = supabase.auth as unknown as { oauth?: OAuthApi };
  return anyAuth.oauth ?? null;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const [details, setDetails] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      if (!authorizationId) return setError("Parâmetro authorization_id ausente.");
      const oauth = getOAuth();
      if (!oauth) {
        return setError(
          "Este servidor Supabase ainda não tem o OAuth 2.1 (dynamic client registration) habilitado. Habilite no dashboard do Supabase para permitir integrações MCP.",
        );
      }
      const { data: sess } = await supabase.auth.getSession();
      if (!sess.session) {
        const next = window.location.pathname + window.location.search;
        window.location.href = "/auth?redirect=" + encodeURIComponent(next);
        return;
      }
      const { data, error } = await oauth.getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) return setError(error.message);
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
    })();
    return () => {
      active = false;
    };
  }, [authorizationId]);

  async function decide(approve: boolean) {
    const oauth = getOAuth();
    if (!oauth) return;
    setBusy(true);
    const { data, error } = approve
      ? await oauth.approveAuthorization(authorizationId)
      : await oauth.denyAuthorization(authorizationId);
    if (error) {
      setBusy(false);
      return setError(error.message);
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      return setError("Servidor de autorização não retornou URL de redirecionamento.");
    }
    window.location.href = target;
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background to-secondary/20">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Conectar aplicativo</CardTitle>
          <CardDescription>
            Um aplicativo externo quer acessar o Gastinho Simples em seu nome via MCP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && <p className="text-sm text-destructive">{error}</p>}
          {!error && !details && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {details && (
            <>
              <div className="rounded-md border p-3 text-sm">
                <div className="font-medium">{details.client?.name ?? "Aplicativo"}</div>
                {details.client?.uri && (
                  <div className="text-xs text-muted-foreground break-all">{details.client.uri}</div>
                )}
              </div>
              <p className="text-sm text-muted-foreground">
                Ao aprovar, o aplicativo poderá usar as ferramentas MCP como você (listar e criar
                receitas/despesas, ver resumo do período).
              </p>
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" disabled={busy} onClick={() => decide(false)}>
                  Recusar
                </Button>
                <Button className="flex-1" disabled={busy} onClick={() => decide(true)}>
                  Aprovar
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
