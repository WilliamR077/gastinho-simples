import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { SharedGroupsProvider } from "@/hooks/use-shared-groups";
import { ValuesVisibilityProvider } from "@/hooks/use-values-visibility";
import { CategoriesProvider } from "@/hooks/use-categories";
import { firebaseNotificationService } from "@/services/firebase-notification-service";
import { adMobService } from "@/services/admob-service";
import { appLockService } from "@/services/app-lock-service";
import { billingService } from "@/services/billing-service";
import { AppLockScreen } from "@/components/app-lock-screen";
import { Capacitor } from "@capacitor/core";
import { App as CapacitorApp } from "@capacitor/app";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import Cards from "./pages/Cards";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import Subscription from "./pages/Subscription";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotificationDebug from "./pages/NotificationDebug";
import Landing from "./pages/Landing";
import About from "./pages/About";
import Contact from "./pages/Contact";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user, loading } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [lockChecked, setLockChecked] = useState(false);

  // Listener para deep link do OAuth (Google Sign-In no Android)
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    const listenerPromise = CapacitorApp.addListener('appUrlOpen', async ({ url }) => {
      // PKCE flow: Supabase retorna ?code=xxx
      try {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get('code');

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) {
            console.error('Erro ao trocar code por sessão:', error);
          } else {
            window.location.href = '/';
          }
          return;
        }
      } catch (e) {
        // URL inválida, tentar fallback
      }

      // Fallback: fluxo implicit (access_token no hash)
      const hashPart = url.includes('#') ? url.split('#')[1] : null;
      if (hashPart) {
        const params = new URLSearchParams(hashPart);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }
      }
    });

    return () => {
      listenerPromise.then(listener => listener.remove());
    };
  }, []);

  // Verificar se deve bloquear ao iniciar
  useEffect(() => {
    const checkLock = () => {
      if (Capacitor.isNativePlatform() && appLockService.isLockEnabled()) {
        const shouldLock = appLockService.shouldLock();
        setIsLocked(shouldLock);
      } else {
        setIsLocked(false);
      }
      setLockChecked(true);
    };

    checkLock();
  }, []);

  // Registrar última atividade e listener para app em segundo plano
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    // Registrar atividade ao interagir
    const handleActivity = () => {
      if (!isLocked) {
        appLockService.setLastActive();
      }
    };

    // Listener para quando o app volta do segundo plano
    const setupAppStateListener = async () => {
      const listener = await CapacitorApp.addListener("appStateChange", ({ isActive }) => {
        if (isActive && appLockService.isLockEnabled()) {
          const shouldLock = appLockService.shouldLock();
          if (shouldLock) {
            setIsLocked(true);
          }
        } else if (!isActive) {
          // App foi para segundo plano, registrar timestamp
          appLockService.setLastActive();
        }
      });

      return listener;
    };

    const listenerPromise = setupAppStateListener();

    // Registrar interações do usuário
    window.addEventListener("click", handleActivity);
    window.addEventListener("touchstart", handleActivity);

    return () => {
      window.removeEventListener("click", handleActivity);
      window.removeEventListener("touchstart", handleActivity);
      listenerPromise.then((listener) => listener.remove());
    };
  }, [isLocked]);

  // Inicializações do usuário logado
  useEffect(() => {
    if (user) {
      // Inicializar Firebase quando o usuário fizer login
      firebaseNotificationService.initialize();
      
      // Verificar e sincronizar assinatura com Google Play (antes do AdMob)
      if (Capacitor.isNativePlatform()) {
        billingService.checkAndSyncSubscription().then(() => {
          // Inicializar AdMob após sincronizar assinatura
          adMobService.initialize().then(() => {
            adMobService.showBanner();
            adMobService.showStartupInterstitial();
          });
        });
      } else {
        // Na web, inicializar AdMob diretamente
        adMobService.initialize().then(() => {
          adMobService.showBanner();
          adMobService.showStartupInterstitial();
        });
      }
    }

    return () => {
      if (user) {
        adMobService.hideBanner();
      }
    };
  }, [user]);

  const handleUnlock = () => {
    setIsLocked(false);
    appLockService.setLastActive();
  };

  // Aguardar verificação de bloqueio antes de renderizar
  if (!lockChecked) {
    return null;
  }

  // Mostrar tela de bloqueio se necessário
  if (isLocked && user) {
    return <AppLockScreen onUnlock={handleUnlock} />;
  }

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/landing" element={<Landing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/account" element={<Account />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/subscription" element={<Subscription />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/notification-debug" element={<NotificationDebug />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="dark">
      <AuthProvider>
        <CategoriesProvider>
          <SharedGroupsProvider>
            <ValuesVisibilityProvider>
              <TooltipProvider>
                <AppContent />
              </TooltipProvider>
            </ValuesVisibilityProvider>
          </SharedGroupsProvider>
        </CategoriesProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
