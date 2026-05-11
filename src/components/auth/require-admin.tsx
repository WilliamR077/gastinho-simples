import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { useIsAdmin } from "@/hooks/use-is-admin";

/**
 * Guard de rota admin: exige role 'admin' validada via RPC has_role.
 * Nunca confiar em e-mail hard-coded ou storage do cliente.
 * - Enquanto auth ou role estiverem carregando, não redireciona.
 * - Deslogado → /auth preservando from.
 * - Logado sem role admin → /
 * - Admin → renderiza filhos.
 */
export function RequireAdmin() {
  const { user, loading: authLoading } = useAuth();
  const { isAdmin, loading: roleLoading } = useIsAdmin();
  const location = useLocation();

  if (authLoading || roleLoading) return null;

  if (!user) {
    return <Navigate to="/auth" replace state={{ from: location }} />;
  }

  if (!isAdmin) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
