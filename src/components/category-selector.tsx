import { useState } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Settings, Loader2 } from "lucide-react";
import { useCategories } from "@/hooks/use-categories";
import { CategoryManager } from "@/components/category-manager";
import { categoryLabels, categoryIcons, ExpenseCategory } from "@/types/expense";

interface CategorySelectorProps {
  value: string;
  onValueChange: (value: string) => void;
  className?: string;
  triggerClassName?: string;
}

export function CategorySelector({ 
  value, 
  onValueChange, 
  className,
  triggerClassName 
}: CategorySelectorProps) {
  const { activeCategories, loading } = useCategories();
  const [showManager, setShowManager] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenManager = () => {
    setIsOpen(false);
    // Pequeno delay para fechar o select antes de abrir o manager
    setTimeout(() => setShowManager(true), 100);
  };

  // Se ainda está carregando ou não tem categorias personalizadas, usar as estáticas
  const useStaticCategories = loading || activeCategories.length === 0;

  // Encontrar a categoria selecionada para mostrar o valor
  const getDisplayValue = () => {
    if (useStaticCategories) {
      const cat = value as ExpenseCategory;
      return cat ? `${categoryIcons[cat] || ''} ${categoryLabels[cat] || value}` : "";
    }
    const category = activeCategories.find(c => c.id === value);
    if (category) {
      return `${category.icon} ${category.name}`;
    }
    // Fallback para categorias estáticas se o valor é um enum
    const staticCat = value as ExpenseCategory;
    if (categoryLabels[staticCat]) {
      return `${categoryIcons[staticCat]} ${categoryLabels[staticCat]}`;
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
        <SelectTrigger className={triggerClassName}>
          <SelectValue placeholder="Selecione a categoria">
            {getDisplayValue()}
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="bg-background">
          {useStaticCategories ? (
            // Fallback para categorias estáticas
            Object.entries(categoryLabels).map(([key, label]) => (
              <SelectItem key={key} value={key}>
                {categoryIcons[key as ExpenseCategory]} {label}
              </SelectItem>
            ))
          ) : (
            // Categorias personalizadas do usuário
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

      <CategoryManager open={showManager} onOpenChange={setShowManager} />
    </>
  );
}
