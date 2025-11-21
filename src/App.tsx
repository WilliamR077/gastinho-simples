import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@/hooks/use-theme";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { firebaseNotificationService } from "@/services/firebase-notification-service";
import { adMobService } from "@/services/admob-service";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import ResetPassword from "./pages/ResetPassword";
import Account from "./pages/Account";
import Cards from "./pages/Cards";
import Settings from "./pages/Settings";
import Reports from "./pages/Reports";
import NotFound from "./pages/NotFound";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import NotificationDebug from "./pages/NotificationDebug";

const queryClient = new QueryClient();

const AppContent = () => {
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      // Inicializar Firebase quando o usuário fizer login
      firebaseNotificationService.initialize();
      
      // Inicializar AdMob, mostrar banner global e intersticial de boas-vindas
      adMobService.initialize().then(() => {
        adMobService.showBanner(); // Banner global em todas as telas
        adMobService.showStartupInterstitial();
      });
    }

    return () => {
      if (user) {
        adMobService.hideBanner();
      }
    };
  }, [user]);

  return (
    <>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/account" element={<Account />} />
          <Route path="/cards" element={<Cards />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/reports" element={<Reports />} />
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
        <TooltipProvider>
          <AppContent />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
