import { useState, useEffect } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, Loader2 } from "lucide-react";
import { useIncomeCategories } from "@/hooks/use-income-categories";
import { IncomeCategoryManager } from "@/components/income-category-manager";
import { incomeCategoryLabels, incomeCategoryIcons, IncomeCategory } from "@/types/income";
import { supabase } from "@/integrations/supabase/client";

interface IncomeCategorySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function IncomeCategorySelector({
  value,
  onValueChange,
  className,
  triggerClassName,
}: IncomeCategorySelectorProps) {
  const { activeCategories, loading, refresh } = useIncomeCategories();
  const [showManager, setShowManager] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenManager = () => {
    setIsOpen(false);
    setTimeout(() => setShowManager(true), 100);
  };

  const handleManagerClose = (open: boolean) => {
    setShowManager(open);
    if (!open) {
      refresh();
    }
  };

  // Auto-inicializar categorias quando o usuário não tem nenhuma
  useEffect(() => {
    const initCategories = async () => {
      if (!loading && activeCategories.length === 0) {
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await supabase.rpc("initialize_user_income_categories", { user_id_param: user.id });
            await supabase.rpc("migrate_income_categories", { user_id_param: user.id });
            refresh();
          }
        } catch (error) {
          console.error("Erro ao inicializar categorias de entrada:", error);
        }
      }
    };
    initCategories();
  }, [loading, activeCategories.length, refresh]);

  const useStaticCategories = loading || activeCategories.length === 0;

  const getDisplayValue = () => {
    if (useStaticCategories) {
      const cat = value as IncomeCategory;
      return cat ? `${incomeCategoryIcons[cat] || ''} ${incomeCategoryLabels[cat] || value}` : "";
    }
    const category = activeCategories.find(c => c.id === value);
    if (category) {
      return `${category.icon} ${category.name}`;
    }
    // Fallback para categorias estáticas
    const staticCat = value as IncomeCategory;
    if (incomeCategoryLabels[staticCat]) {
      return `${incomeCategoryIcons[staticCat]} ${incomeCategoryLabels[staticCat]}`;
    }
    return "";
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-10 border rounded-md ${className}`}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
      <Select
        value={value}
        onValueChange={onValueChange}
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <SelectTrigger className={`${className} ${triggerClassName}`}>
          <SelectValue placeholder="Selecione a categoria">
            {getDisplayValue()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background">
          {useStaticCategories ? (
            Object.entries(incomeCategoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {incomeCategoryIcons[key as IncomeCategory]} {label}
              </SelectItem>
            ))
          ) : (
            activeCategories.map((category) => (
              <SelectItem key={category.id} value={category.id}>
                {category.icon} {category.name}
              </SelectItem>
            ))
          )}

          <Separator className="my-1" />

          <div className="p-1">
            <Button
              variant="ghost"
              className="w-full justify-start text-sm h-9"
              onClick={handleOpenManager}
            >
              <Settings className="h-4 w-4 mr-2" />
              Gerenciar categorias...
            </Button>
          </div>
        </SelectContent>
      </Select>

      <IncomeCategoryManager open={showManager} onOpenChange={handleManagerClose} />
    </>
  );
}
