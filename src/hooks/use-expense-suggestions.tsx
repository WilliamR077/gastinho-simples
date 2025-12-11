import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";

interface ExpenseSuggestion {
  description: string;
  count: number;
}

export function useExpenseSuggestions() {
  const { user } = useAuth();
  const [suggestions, setSuggestions] = useState<ExpenseSuggestion[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchSuggestions = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from("expenses")
          .select("description")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500);

        if (error) throw error;

        // Count occurrences and get unique descriptions
        const countMap = new Map<string, number>();
        data?.forEach((expense) => {
          const desc = expense.description.trim();
          countMap.set(desc, (countMap.get(desc) || 0) + 1);
        });

        // Convert to array and sort by frequency
        const sortedSuggestions = Array.from(countMap.entries())
          .map(([description, count]) => ({ description, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 50);

        setSuggestions(sortedSuggestions);
      } catch (error) {
        console.error("Error fetching expense suggestions:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSuggestions();
  }, [user]);

  const filterSuggestions = (query: string): string[] => {
    if (!query.trim()) return suggestions.slice(0, 7).map(s => s.description);
    
    const lowerQuery = query.toLowerCase();
    return suggestions
      .filter(s => s.description.toLowerCase().includes(lowerQuery))
      .slice(0, 7)
      .map(s => s.description);
  };

  return { suggestions, filterSuggestions, isLoading };
}
