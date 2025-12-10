import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Pencil, Plus, Check, X, Loader2, Trash2 } from "lucide-react";
import { UserCategory } from "@/types/user-category";
import { useCategories } from "@/hooks/use-categories";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const EMOJI_OPTIONS = [
  "🍔", "🚗", "🎮", "⚕️", "📚", "🏠", "👕", "🔧", "📦",
  "🐕", "🐱", "✈️", "🎬", "🎵", "💪", "💊", "🛒", "☕",
  "🍕", "🎁", "💰", "📱", "💻", "🎨", "⚽", "🏋️", "🚌",
  "🏥", "🎓", "🏪", "🍺", "🎭", "📺", "🎪", "🏖️", "💇"
];

interface CategoryManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface EditingCategory {
  id: string;
  name: string;
  icon: string;
}

const isOutrosCategory = (category: UserCategory) => 
  category.name.toLowerCase() === "outros";

export function CategoryManager({ open, onOpenChange }: CategoryManagerProps) {
  const { 
    activeCategories, 
    hiddenCategories, 
    loading,
    addCategory, 
    updateCategory, 
    deleteCategory,
    toggleCategoryVisibility 
  } = useCategories();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<UserCategory | null>(null);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const result = await addCategory({
      name: newName.trim(),
      icon: newIcon,
    });
    setSaving(false);
    if (result) {
      setNewName("");
      setNewIcon("📦");
      setShowAddForm(false);
    }
  };

  const handleSaveEdit = async () => {
    if (!editingCategory || !editingCategory.name.trim()) return;
    setSaving(true);
    await updateCategory(editingCategory.id, {
      name: editingCategory.name.trim(),
      icon: editingCategory.icon,
    });
    setSaving(false);
    setEditingCategory(null);
  };

  const handleDelete = async () => {
    if (!deletingCategory) return;
    setSaving(true);
    await deleteCategory(deletingCategory.id);
    setSaving(false);
    setDeletingCategory(null);
  };

  const startEditing = (category: UserCategory) => {
    setEditingCategory({
      id: category.id,
      name: category.name,
      icon: category.icon,
    });
  };

  const CategoryRow = ({ category, isHidden = false }: { category: UserCategory; isHidden?: boolean }) => {
    const isEditing = editingCategory?.id === category.id;
    const isOutros = isOutrosCategory(category);

    return (
      <div className={`flex items-center justify-between p-3 rounded-lg ${isHidden ? 'bg-muted/30 opacity-60' : 'bg-muted/50'}`}>
        {isEditing ? (
          <div className="flex items-center gap-2 flex-1">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="w-10 h-10 text-xl">
                  {editingCategory.icon}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 p-2 bg-background">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant={editingCategory.icon === emoji ? "secondary" : "ghost"}
                      size="sm"
                      className="w-9 h-9 text-lg"
                      onClick={() => setEditingCategory({ ...editingCategory, icon: emoji })}
                    >
                      {emoji}
                    </Button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
            <Input
              value={editingCategory.name}
              onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
              className="flex-1"
              autoFocus
            />
            <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4 text-green-500" />}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingCategory(null)}>
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3">
              <span className="text-xl">{category.icon}</span>
              <span className={isHidden ? "line-through text-muted-foreground" : ""}>{category.name}</span>
              {isOutros ? (
                <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">🔒 Fixa</span>
              ) : category.is_default && (
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">Padrão</span>
              )}
            </div>
            {isOutros ? (
              <span className="text-xs text-muted-foreground">Não editável</span>
            ) : (
              <div className="flex items-center gap-1">
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => startEditing(category)}
                  className="h-8 w-8"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => toggleCategoryVisibility(category.id)}
                  className="h-8 w-8"
                >
                  {isHidden ? (
                    <Eye className="h-4 w-4" />
                  ) : (
                    <EyeOff className="h-4 w-4" />
                  )}
                </Button>
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={() => setDeletingCategory(category)}
                  className="h-8 w-8 text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="h-[85vh]">
          <SheetHeader className="text-left">
            <SheetTitle className="text-primary flex items-center gap-2">
              ✏️ Gerenciar Categorias
            </SheetTitle>
            <SheetDescription>
              Adicione, edite, oculte ou exclua categorias. A categoria "Outros" não pode ser modificada.
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100%-120px)] mt-4 pr-4">
            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                {/* Categorias Ativas */}
                <div className="space-y-3">
                  <h3 className="font-medium text-sm text-muted-foreground">
                    📌 Categorias Ativas ({activeCategories.length})
                  </h3>
                  <div className="space-y-2">
                    {activeCategories.map((category) => (
                      <CategoryRow key={category.id} category={category} />
                    ))}
                  </div>
                </div>

                {/* Adicionar Nova */}
                {showAddForm ? (
                  <div className="border border-dashed rounded-lg p-4 space-y-3">
                    <h3 className="font-medium text-sm">Nova Categoria</h3>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="w-12 h-12 text-2xl">
                            {newIcon}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-2 bg-background">
                          <div className="grid grid-cols-6 gap-1">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <Button
                                key={emoji}
                                variant={newIcon === emoji ? "secondary" : "ghost"}
                                size="sm"
                                className="w-9 h-9 text-lg"
                                onClick={() => setNewIcon(emoji)}
                              >
                                {emoji}
                              </Button>
                            ))}
                          </div>
                        </PopoverContent>
                      </Popover>
                      <div className="flex-1 space-y-1">
                        <Label htmlFor="new-category-name">Nome</Label>
                        <Input
                          id="new-category-name"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          placeholder="Ex: Pets, Academia..."
                        />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        onClick={() => {
                          setShowAddForm(false);
                          setNewName("");
                          setNewIcon("📦");
                        }}
                        className="flex-1"
                      >
                        Cancelar
                      </Button>
                      <Button 
                        onClick={handleAdd} 
                        disabled={!newName.trim() || saving}
                        className="flex-1"
                      >
                        {saving ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Plus className="h-4 w-4 mr-2" />
                        )}
                        Adicionar
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    onClick={() => setShowAddForm(true)}
                    className="w-full border-dashed"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Categoria
                  </Button>
                )}

                {/* Categorias Ocultas */}
                {hiddenCategories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="font-medium text-sm text-muted-foreground">
                        👁‍🗨 Categorias Ocultas ({hiddenCategories.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Essas categorias não aparecem no seletor, mas despesas antigas continuam associadas.
                      </p>
                      <div className="space-y-2">
                        {hiddenCategories.map((category) => (
                          <CategoryRow key={category.id} category={category} isHidden />
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </ScrollArea>
        </SheetContent>
      </Sheet>

      {/* Diálogo de confirmação de exclusão */}
      <AlertDialog open={!!deletingCategory} onOpenChange={(open) => !open && setDeletingCategory(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Se houver despesas nesta categoria, elas serão movidas para "Outros".
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
