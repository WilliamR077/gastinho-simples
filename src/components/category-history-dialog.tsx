import { useEffect, useMemo, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CategoryReferenceCounts, shouldApplyCategoryReferenceResponse } from "@/types/category-history";

interface CategoryLike {
  id: string;
  name: string;
  icon: string;
  is_active: boolean;
  is_default: boolean;
  system_key: string | null;
}

interface CategoryHistoryDialogProps<T extends CategoryLike> {
  category: T | null;
  kindLabel: "despesas" | "entradas";
  activeCategories: T[];
  onClose: () => void;
  getReferences: (id: string) => Promise<CategoryReferenceCounts | null>;
  archive: (id: string) => Promise<boolean>;
  replace: (sourceId: string, destinationId: string) => Promise<unknown>;
  permanentlyDelete: (id: string) => Promise<boolean>;
}

export function CategoryHistoryDialog<T extends CategoryLike>({
  category, kindLabel, activeCategories, onClose, getReferences, archive, replace, permanentlyDelete,
}: CategoryHistoryDialogProps<T>) {
  const [counts, setCounts] = useState<CategoryReferenceCounts | null>(null);
  const [destinationId, setDestinationId] = useState("");
  const [busy, setBusy] = useState(false);
  const requestIdRef = useRef(0);
  const currentCategoryIdRef = useRef<string | null>(null);
  currentCategoryIdRef.current = category?.id ?? null;
  const destinations = useMemo(() => activeCategories.filter(item => item.id !== category?.id), [activeCategories, category]);

  useEffect(() => {
    const requestId = ++requestIdRef.current;
    let active = true;
    setCounts(null);
    setDestinationId("");
    if (category) {
      const requestedCategoryId = category.id;
      void getReferences(requestedCategoryId).then(result => {
        if (active && shouldApplyCategoryReferenceResponse(
          requestId,
          requestIdRef.current,
          requestedCategoryId,
          currentCategoryIdRef.current,
        )) setCounts(result);
      });
    }
    return () => {
      active = false;
      requestIdRef.current += 1;
    };
  }, [category, getReferences]);

  const run = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    try {
      const result = await operation();
      if (result) onClose();
    } catch (error) {
      console.error("Category history operation failed:", error);
    } finally {
      setBusy(false);
    }
  };

  const isSystemOther = category?.system_key === "other";
  const isCustomInactive = !!category && !category.is_default && !category.is_active && !isSystemOther;
  const canDelete = isCustomInactive && counts?.total === 0;

  return (
    <AlertDialog open={!!category} onOpenChange={open => !open && !busy && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Preservar histórico da categoria</AlertDialogTitle>
          <AlertDialogDescription>
            {category?.icon} {category?.name}. Arquivar mantém lançamentos antigos; substituir é uma alteração deliberada do histórico.
          </AlertDialogDescription>
        </AlertDialogHeader>

        {!counts ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Verificando referências…</div>
        ) : (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border p-3">
              <p className="font-medium">Referências atuais: {counts.total}</p>
              <p className="text-muted-foreground">{counts.transactions} lançamentos, {counts.recurring} recorrências e {counts.goals} metas.</p>
            </div>
            <Button className="w-full" variant="outline" disabled={busy || !category?.is_active}
              onClick={() => category && run(() => archive(category.id))}>
              Arquivar e preservar histórico
            </Button>
            {counts.total > 0 && !isSystemOther ? (
              <div className="space-y-2 rounded-md border p-3">
                <Label>Substituir em todos os {kindLabel}</Label>
                <Select value={destinationId} onValueChange={setDestinationId}>
                  <SelectTrigger><SelectValue placeholder="Escolha a categoria de destino" /></SelectTrigger>
                  <SelectContent>{destinations.map(item => <SelectItem key={item.id} value={item.id}>{item.icon} {item.name}</SelectItem>)}</SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">Isso atualizará IDs, nomes/ícones históricos e metas. A origem será arquivada.</p>
                <Button className="w-full" variant="destructive" disabled={busy || !destinationId}
                  onClick={() => category && run(() => replace(category.id, destinationId))}>
                  Confirmar substituição de {counts.total} referências
                </Button>
              </div>
            ) : null}
            {isCustomInactive ? (
              <Button className="w-full" variant="destructive" disabled={busy || !canDelete}
                onClick={() => category && run(() => permanentlyDelete(category.id))}>
                {canDelete ? "Excluir permanentemente" : "Exclusão bloqueada: há referências"}
              </Button>
            ) : null}
          </div>
        )}
        <AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel></AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
