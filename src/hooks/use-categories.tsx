import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { UserCategory, UserCategoryInsert, UserCategoryUpdate } from "@/types/user-category";
import { useToast } from "@/hooks/use-toast";

export function useCategories() {
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

  const addCategory = async (data: UserCategoryInsert): Promise<UserCategory | null> => {
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
  };

  const updateCategory = async (id: string, data: UserCategoryUpdate): Promise<boolean> => {
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
  };

  const toggleCategoryVisibility = async (id: string): Promise<boolean> => {
    const category = categories.find(c => c.id === id);
    if (!category) return false;

    return updateCategory(id, { is_active: !category.is_active });
  };

  const deleteCategory = async (id: string): Promise<boolean> => {
    try {
      const category = categories.find(c => c.id === id);
      if (!category) return false;

      // Impedir exclusão de "Outros"
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

      // Buscar categoria "Outros" do usuário
      const outrosCategory = categories.find(c => c.name.toLowerCase() === "outros");

      if (outrosCategory) {
        // Migrar despesas para "Outros"
        await supabase
          .from("expenses")
          .update({ category_id: outrosCategory.id })
          .eq("user_id", user.id)
          .eq("category_id", id);

        await supabase
          .from("recurring_expenses")
          .update({ category_id: outrosCategory.id })
          .eq("user_id", user.id)
          .eq("category_id", id);
      }

      // Excluir categoria
      const { error } = await supabase
        .from("user_categories")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCategories(prev => prev.filter(c => c.id !== id));
      toast({
        title: "Categoria excluída",
        description: outrosCategory 
          ? "Despesas relacionadas foram movidas para 'Outros'" 
          : "Categoria removida com sucesso",
      });
      return true;
    } catch (error) {
      console.error("Erro ao excluir categoria:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir a categoria",
        variant: "destructive",
      });
      return false;
    }
  };

  const activeCategories = useMemo(() => categories.filter(c => c.is_active), [categories]);
  const hiddenCategories = useMemo(() => categories.filter(c => !c.is_active), [categories]);

  return {
    categories,
    activeCategories,
    hiddenCategories,
    loading,
    addCategory,
    updateCategory,
    deleteCategory,
    toggleCategoryVisibility,
    refresh: loadCategories,
  };
}
