import { useState, useEffect, useCallback, useMemo, createContext, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserCategory, UserCategoryInsert, UserCategoryUpdate } from "@/types/user-category";
import { useToast } from "@/hooks/use-toast";
import { CategoryReferenceCounts, CategoryReplacementResult, parseCategoryReferenceCounts } from "@/types/category-history";

interface CategoriesContextType {
  categories: UserCategory[];
  activeCategories: UserCategory[];
  hiddenCategories: UserCategory[];
  loading: boolean;
  addCategory: (data: UserCategoryInsert) => Promise<UserCategory | null>;
  updateCategory: (id: string, data: UserCategoryUpdate) => Promise<boolean>;
  deleteCategory: (id: string) => Promise<boolean>;
  archiveCategory: (id: string) => Promise<boolean>;
  getCategoryReferences: (id: string) => Promise<CategoryReferenceCounts | null>;
  replaceCategory: (sourceId: string, destinationId: string) => Promise<CategoryReplacementResult | null>;
  toggleCategoryVisibility: (id: string) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const CategoriesContext = createContext<CategoriesContextType | null>(null);

export function CategoriesProvider({ children }: { children: ReactNode }) {
  const [categories, setCategories] = useState<UserCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadCategories = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      // Verificar se usuário tem categorias, se não, inicializar
      const { data: existingCategories, error: checkError } = await supabase
        .from("user_categories")
        .select("*")
        .eq("user_id", user.id)
        .order("display_order", { ascending: true });

      if (checkError) throw checkError;

      if (!existingCategories || existingCategories.length === 0) {
        // Inicializar categorias padrão
        await supabase.rpc("initialize_user_categories", { user_id_param: user.id });
        
        // Migrar categorias das despesas existentes
        await supabase.rpc("migrate_expense_categories", { user_id_param: user.id });
        
        // Recarregar categorias
        const { data: newCategories, error: loadError } = await supabase
          .from("user_categories")
          .select("*")
          .eq("user_id", user.id)
          .order("display_order", { ascending: true });

        if (loadError) throw loadError;
        setCategories(newCategories || []);
      } else {
        setCategories(existingCategories);
      }
    } catch (error) {
      console.error("Erro ao carregar categorias:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar as categorias",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  const addCategory = useCallback(async (data: UserCategoryInsert): Promise<UserCategory | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;

      const maxOrder = categories.length > 0 
        ? Math.max(...categories.map(c => c.display_order)) + 1 
        : 0;

      const { data: newCategory, error } = await supabase
        .from("user_categories")
        .insert({
          user_id: user.id,
          name: data.name,
          icon: data.icon,
          color: data.color || "#6366f1",
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
      console.error("Erro ao adicionar categoria:", error);
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

  const updateCategory = useCallback(async (id: string, data: UserCategoryUpdate): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from("user_categories")
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
      console.error("Erro ao atualizar categoria:", error);
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

  const getCategoryReferences = useCallback(async (id: string): Promise<CategoryReferenceCounts | null> => {
    const { data, error } = await supabase.rpc("p3a4_category_reference_counts", {
      p_kind: "expense",
      p_category_id: id,
    });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível verificar o uso da categoria", variant: "destructive" });
      return null;
    }
    return parseCategoryReferenceCounts(data);
  }, [toast]);

  const archiveCategory = useCallback(async (id: string): Promise<boolean> => {
    const { error } = await supabase.rpc("p3a4_archive_category", { p_kind: "expense", p_category_id: id });
    if (error) {
      toast({ title: "Erro", description: "Não foi possível arquivar a categoria", variant: "destructive" });
      return false;
    }
    setCategories(prev => prev.map(category => category.id === id ? { ...category, is_active: false } : category));
    toast({ title: "Categoria arquivada", description: "O histórico foi preservado" });
    return true;
  }, [toast]);

  const replaceCategory = useCallback(async (sourceId: string, destinationId: string): Promise<CategoryReplacementResult | null> => {
    const { data, error } = await supabase.rpc("p3a4_replace_category", {
      p_kind: "expense",
      p_source_category_id: sourceId,
      p_destination_category_id: destinationId,
    });
    if (error) {
      const legacyGoal = error.message?.includes("LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW");
      toast({
        title: "Não foi possível substituir a categoria",
        description: legacyGoal
          ? "Existe uma meta antiga cuja categoria precisa ser revisada antes desta operação."
          : "Nenhuma alteração foi realizada",
        variant: "destructive",
      });
      return null;
    }
    await loadCategories();
    toast({ title: "Categoria substituída", description: "Referências e snapshots foram atualizados" });
    return data as unknown as CategoryReplacementResult;
  }, [loadCategories, toast]);

  const deleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      const { error } = await supabase.rpc("p3a4_delete_category", { p_kind: "expense", p_category_id: id });
      if (error) throw error;
      setCategories(prev => prev.filter(c => c.id !== id));
      toast({ title: "Categoria excluída permanentemente", description: "Nenhum histórico foi alterado" });
      return true;
    } catch (error: any) {
      console.error("Erro ao excluir categoria:", error);
      toast({
        title: "Exclusão bloqueada",
        description: error?.message?.includes("LEGACY_GOAL_REFERENCE_REQUIRES_REVIEW")
          ? "Existe uma meta antiga cuja categoria precisa ser revisada antes desta operação."
          : "Somente categorias personalizadas, arquivadas e sem referências podem ser excluídas",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  const toggleCategoryVisibility = useCallback(async (id: string): Promise<boolean> => {
    const category = categories.find(c => c.id === id);
    if (!category) return false;
    return category.is_active ? archiveCategory(id) : updateCategory(id, { is_active: true });
  }, [archiveCategory, categories, updateCategory]);

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
    archiveCategory,
    getCategoryReferences,
    replaceCategory,
    toggleCategoryVisibility,
    refresh: loadCategories,
  }), [
    categories,
    activeCategories,
    hiddenCategories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    archiveCategory,
    getCategoryReferences,
    replaceCategory,
    toggleCategoryVisibility,
    loadCategories,
  ]);

  return (
    <CategoriesContext.Provider value={value}>
      {children}
    </CategoriesContext.Provider>
  );
}

export function useCategories() {
  const context = useContext(CategoriesContext);
  if (!context) {
    throw new Error("useCategories deve ser usado dentro de CategoriesProvider");
  }
  return context;
}
