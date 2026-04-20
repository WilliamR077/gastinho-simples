import { useEffect, useMemo, useRef, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Eye, EyeOff, Pencil, Plus, Check, X, Loader2, Trash2 } from "lucide-react";
import { UserCategory } from "@/types/user-category";
import { useCategories } from "@/hooks/use-categories";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
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
import { useAdBannerLock } from "@/services/admob-visibility-coordinator";

// P2: Expanded emoji list for personal finance categories
const EMOJI_OPTIONS = [
  "🍔", "🚗", "🎮", "⚕️", "📚", "🏠", "👕", "🔧", "📦", "🐕",
  "🐱", "✈️", "🎬", "🎵", "💪", "💊", "🛒", "☕", "🍕", "🎁",
  "💰", "📱", "💻", "🎨", "⚽", "🏋️", "🚌", "🏥", "🎓", "🏪",
  "🍺", "🎭", "📺", "🎪", "🏖️", "💇",
  // New additions for common finance scenarios
  "🍽️", "🥗", "🍳", "🧃", "⛽", "🚕", "🚍", "🏍️",
  "🧾", "💡", "💧", "📡", "🏫", "👶", "🐾", "💍",
  "🛍️", "🏗️", "🔑", "🧹", "🧴", "💄", "🎂", "🎄",
  "🏸", "🎾", "🎒", "💉", "🦷", "👓", "🧥", "👟",
  "🍱", "🚲",
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
    toggleCategoryVisibility,
  } = useCategories();

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState("📦");
  const [saving, setSaving] = useState(false);
  const [editingCategory, setEditingCategory] = useState<EditingCategory | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<UserCategory | null>(null);
  const hasOpenedRef = useRef(false);

  const firstEditableCategoryId = useMemo(
    () => activeCategories.find((category) => !isOutrosCategory(category))?.id ?? null,
    [activeCategories]
  );

  // Hide AdMob banner while sheet is open so the "Add category" button and
  // action icons aren't covered. Released automatically on close/unmount via
  // the coordinator's reference-counted lock.
  useAdBannerLock("category-sheet", open);

  useEffect(() => {
    if (open) {
      hasOpenedRef.current = true;
    } else if (!hasOpenedRef.current) {
      return;
    }

    try {
      window.dispatchEvent(
        new CustomEvent("gastinho-onboarding-event", {
          detail: open ? "category-manager-opened" : "category-manager-closed",
        })
      );
    } catch {
      void 0;
    }
  }, [open]);

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

  const CategoryRow = ({
    category,
    isHidden = false,
  }: {
    category: UserCategory;
    isHidden?: boolean;
  }) => {
    const isEditing = editingCategory?.id === category.id;
    const isOutros = isOutrosCategory(category);
    const isPrimaryEditableCategory = category.id === firstEditableCategoryId;

    return (
      <div
        className={`flex flex-col gap-2 rounded-lg p-3 min-w-0 sm:flex-row sm:items-center sm:justify-between ${
          isHidden ? "bg-muted/30 opacity-60" : "bg-muted/50"
        }`}
        data-onboarding={
          isOutros
            ? "category-manager-outros-row"
            : isPrimaryEditableCategory && isEditing
              ? "category-manager-edit-btn"
              : undefined
        }
      >
        {isEditing ? (
          <div className="flex flex-1 items-center gap-2 min-w-0 w-full">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-10 w-10 shrink-0 text-xl">
                  {editingCategory.icon}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-64 bg-background p-2">
                <div className="grid grid-cols-6 gap-1">
                  {EMOJI_OPTIONS.map((emoji) => (
                    <Button
                      key={emoji}
                      variant={editingCategory.icon === emoji ? "secondary" : "ghost"}
                      size="sm"
                      className="h-9 w-9 text-lg"
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
              className="flex-1 min-w-0"
              autoFocus
            />
            <Button size="icon" variant="ghost" onClick={handleSaveEdit} disabled={saving} className="shrink-0">
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-green-500" />
              )}
            </Button>
            <Button size="icon" variant="ghost" onClick={() => setEditingCategory(null)} className="shrink-0">
              <X className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 min-w-0 w-full sm:flex-1">
              <span className="text-xl shrink-0">{category.icon}</span>
              <span className={`truncate ${isHidden ? "line-through text-muted-foreground" : ""}`}>
                {category.name}
              </span>
              {isOutros ? (
                <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600 shrink-0">
                  🔒 Fixa
                </span>
              ) : category.is_default ? (
                <span className="rounded bg-primary/10 px-2 py-0.5 text-xs text-primary shrink-0">
                  Padrão
                </span>
              ) : null}
            </div>
            {isOutros ? (
              <span className="text-xs text-muted-foreground shrink-0 self-end sm:self-auto">Fixa</span>
            ) : (
              <div className="flex items-center gap-0.5 shrink-0 self-end sm:self-auto">
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => startEditing(category)}
                  className="h-9 w-9"
                  data-onboarding={isPrimaryEditableCategory ? "category-manager-edit-btn" : undefined}
                  aria-label="Editar"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => toggleCategoryVisibility(category.id)}
                  className="h-9 w-9"
                  data-onboarding={isPrimaryEditableCategory ? "category-manager-hide-btn" : undefined}
                  aria-label={isHidden ? "Mostrar" : "Ocultar"}
                >
                  {isHidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDeletingCategory(category)}
                  className="h-9 w-9 text-destructive hover:text-destructive"
                  data-onboarding={isPrimaryEditableCategory ? "category-manager-delete-btn" : undefined}
                  aria-label="Excluir"
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
        <SheetContent
          side="bottom"
          className="h-[85vh]"
          data-onboarding="category-manager-sheet"
        >
          <SheetHeader className="text-left">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <SheetTitle className="flex items-center gap-2 text-primary">
                  ✏️ Gerenciar Categorias
                </SheetTitle>
                <SheetDescription>
                  Adicione, edite, oculte ou exclua categorias. A categoria "Outros" não pode
                  ser modificada.
                </SheetDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onOpenChange(false)}
                data-onboarding="category-manager-close-btn"
              >
                Voltar ao formulário
              </Button>
            </div>
          </SheetHeader>

          <ScrollArea className="mt-4 h-[calc(100%-120px)] pr-4">
            {loading ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="space-y-3">
                  <h3 className="text-sm font-medium text-muted-foreground">
                    📌 Categorias Ativas ({activeCategories.length})
                  </h3>
                  <div className="space-y-2">
                    {activeCategories.map((category) => (
                      <CategoryRow key={category.id} category={category} />
                    ))}
                  </div>
                </div>

                {showAddForm ? (
                  <div
                    className="space-y-3 rounded-lg border border-dashed p-4"
                    data-onboarding="category-manager-add-btn"
                  >
                    <h3 className="text-sm font-medium">Nova Categoria</h3>
                    <div className="flex items-center gap-2">
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" size="sm" className="h-12 w-12 text-2xl">
                            {newIcon}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 bg-background p-2">
                          <div className="grid grid-cols-6 gap-1">
                            {EMOJI_OPTIONS.map((emoji) => (
                              <Button
                                key={emoji}
                                variant={newIcon === emoji ? "secondary" : "ghost"}
                                size="sm"
                                className="h-9 w-9 text-lg"
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
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <Plus className="mr-2 h-4 w-4" />
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
                    data-onboarding="category-manager-add-btn"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Categoria
                  </Button>
                )}

                {hiddenCategories.length > 0 && (
                  <>
                    <Separator />
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground">
                        👁️‍🗨️ Categorias Ocultas ({hiddenCategories.length})
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Essas categorias não aparecem no seletor, mas despesas antigas continuam
                        associadas.
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

      <AlertDialog
        open={!!deletingCategory}
        onOpenChange={(nextOpen) => !nextOpen && setDeletingCategory(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir categoria?</AlertDialogTitle>
            <AlertDialogDescription>
              Se houver despesas nesta categoria, elas serão movidas para "Outros". Esta ação não
              pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
