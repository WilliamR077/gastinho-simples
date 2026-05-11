import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";

/**
 * Guard de rota: exige usuário autenticado.
 * - Enquanto a sessão ainda está carregando, não renderiza nada (evita
 *   redirecionamento prematuro e flicker para /auth).
 * - Sem usuário, redireciona para /auth preservando `location` em
 *   `state.from` para que Auth.tsx possa retomar o destino após login.
 */
export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return null;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
