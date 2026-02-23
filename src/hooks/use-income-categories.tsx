import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserIncomeCategory, UserIncomeCategoryInsert, UserIncomeCategoryUpdate } from "@/types/user-income-category";
import { useToast } from "@/hooks/use-toast";

interface IncomeCategoriesContextType {
  categories: UserIncomeCategory[];
  activeCategories: UserIncomeCategory[];
  hiddenCategories: UserIncomeCategory[];
  loading: boolean;
  addCategory: (data: UserIncomeCategoryInsert) => Promise<UserIncomeCategory | null>;
  updateCategory: (id: string, data: UserIncomeCategoryUpdate) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  toggleCategoryVisibility: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const IncomeCategoriesContext = createContext<IncomeCategoriesContextType | null>(null);

export function IncomeCategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<UserIncomeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: existingCategories, error: checkError } = await supabase
        .from("user_income_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (checkError) throw checkError;

      if (!existingCategories || existingCategories.length === 0) {
        await supabase.rpc("initialize_user_income_categories", { user_id_param: user.id });
        await supabase.rpc("migrate_income_categories", { user_id_param: user.id });

        const { data: newCategories, error: loadError } = await supabase
          .from("user_income_categories")
          .select("*")
          .eq("user_id", user.id)
          .order("display_order", { ascending: true });

        if (loadError) throw loadError;
        setCategories(newCategories || []);
      } else {
        setCategories(existingCategories);
      }
    } catch (error) {
      console.error("Erro ao carregar categorias de entrada:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as categorias de entrada",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const addCategory = useCallback(async (data: UserIncomeCategoryInsert): Promise<UserIncomeCategory | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const maxOrder = categories.length > 0
        ? Math.max(...categories.map(c => c.display_order)) + 1
        : 0;

      const { data: newCategory, error } = await supabase
        .from("user_income_categories")
        .insert({
          user_id: user.id,
          name: data.name,
          icon: data.icon,
          color: data.color || "#10b981",
          is_default: false,
          is_active: true,
          display_order: maxOrder,
        })
        .select()
        .single();

      if (error) throw error;

      setCategories(prev => [...prev, newCategory]);
      toast({
        title: "Categoria criada",
        description: `${data.icon} ${data.name} foi adicionada com sucesso`,
      });
      return newCategory;
    } catch (error: any) {
      console.error("Erro ao adicionar categoria de entrada:", error);
      if (error.code === "23505") {
        toast({
          title: "Erro",
          description: "Já existe uma categoria com esse nome",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível adicionar a categoria",
          variant: "destructive",
        });
      }
      return null;
    }
  }, [categories, toast]);

  const updateCategory = useCallback(async (id: string, data: UserIncomeCategoryUpdate): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("user_income_categories")
        .update(data)
        .eq("id", id);

      if (error) throw error;

      setCategories(prev => prev.map(c => c.id === id ? { ...c, ...data } : c));
      toast({
        title: "Categoria atualizada",
        description: "Alterações salvas com sucesso",
      });
      return true;
    } catch (error: any) {
      console.error("Erro ao atualizar categoria de entrada:", error);
      if (error.code === "23505") {
        toast({
          title: "Erro",
          description: "Já existe uma categoria com esse nome",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Erro",
          description: "Não foi possível atualizar a categoria",
          variant: "destructive",
        });
      }
      return false;
    }
  }, [toast]);

  const toggleCategoryVisibility = useCallback(async (id: string): Promise<boolean> => {
    const category = categories.find(c => c.id === id);
    if (!category) return false;
    return updateCategory(id, { is_active: !category.is_active });
  }, [categories, updateCategory]);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const category = categories.find(c => c.id === id);
      if (!category) return false;

      if (category.name.toLowerCase() === "outros") {
        toast({
          title: "Ação não permitida",
          description: "A categoria 'Outros' não pode ser excluída",
          variant: "destructive",
        });
        return false;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return false;

      const outrosCategory = categories.find(c => c.name.toLowerCase() === "outros");

      if (outrosCategory) {
        await supabase
          .from("incomes")
          .update({ income_category_id: outrosCategory.id })
          .eq("user_id", user.id)
          .eq("income_category_id", id);

        await supabase
          .from("recurring_incomes")
          .update({ income_category_id: outrosCategory.id })
          .eq("user_id", user.id)
          .eq("income_category_id", id);
      }

      const { error } = await supabase
        .from("user_income_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== id));
      toast({
        title: "Categoria excluída",
        description: outrosCategory
          ? "Entradas relacionadas foram movidas para 'Outros'"
          : "Categoria removida com sucesso",
      });
      return true;
    } catch (error) {
      console.error("Erro ao excluir categoria de entrada:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a categoria",
        variant: "destructive",
      });
      return false;
    }
  }, [categories, toast]);

  const activeCategories = useMemo(() => categories.filter(c => c.is_active), [categories]);
  const hiddenCategories = useMemo(() => categories.filter(c => !c.is_active), [categories]);

  const value = useMemo(() => ({
    categories,
    activeCategories,
    hiddenCategories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    refresh: loadCategories,
  }), [
    categories, activeCategories, hiddenCategories, loading,
    addCategory, updateCategory, deleteCategory, toggleCategoryVisibility, loadCategories,
  ]);

  return (
    <IncomeCategoriesContext.Provider value={value}>
      {children}
    </IncomeCategoriesContext.Provider>
  );
}

export function useIncomeCategories() {
  const context = useContext(IncomeCategoriesContext);
  if (!context) {
    throw new Error("useIncomeCategories deve ser usado dentro de IncomeCategoriesProvider");
  }
  return context;
}
