import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { SubscriptionTier, SUBSCRIPTION_FEATURES } from "@/types/subscription";

interface UseSubscriptionReturn {
  tier: SubscriptionTier;
  loading: boolean;
  features: typeof SUBSCRIPTION_FEATURES[SubscriptionTier];
  canAddCard: (currentCount: number) => boolean;
  canAddGoal: (currentCount: number) => boolean;
  hasAdvancedReports: boolean;
  canExportPdf: boolean;
  canExportExcel: boolean;
  shouldShowAds: boolean;
  refreshSubscription: () => Promise<void>;
}

export function useSubscription(): UseSubscriptionReturn {
  const { user } = useAuth();
  const [tier, setTier] = useState<SubscriptionTier>("free");
  const [loading, setLoading] = useState(true);

  const fetchSubscription = async () => {
    if (!user) {
      setTier("free");
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase.rpc("get_user_subscription_tier", {
        user_id_param: user.id,
      });

      if (error) {
        console.error("Erro ao buscar subscription:", error);
        setTier("free");
      } else {
        setTier(data || "free");
      }
    } catch (error) {
      console.error("Erro ao buscar subscription:", error);
      setTier("free");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSubscription();
  }, [user]);

  const features = SUBSCRIPTION_FEATURES[tier];

  return {
    tier,
    loading,
    features,
    canAddCard: (currentCount: number) => currentCount < features.cards,
    canAddGoal: (currentCount: number) => currentCount < features.goals,
    hasAdvancedReports: features.reports,
    canExportPdf: features.exportPdf,
    canExportExcel: features.exportExcel,
    shouldShowAds: features.ads,
    refreshSubscription: fetchSubscription,
  };
}
