import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { CardManager } from "@/components/card-manager";

interface CardManagerSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Wrapper que abre o CardManager (mesma UX da página /cards) dentro de um
 * Sheet, para uso a partir do campo "Cartão" nos formulários de despesa.
 *
 * Reaproveita CardManager sem alterações: criação, edição, exclusão e
 * limites continuam funcionando exatamente como hoje, inclusive a checagem
 * de limite de cartões do plano (useSubscription).
 */
export function CardManagerSheet({ open, onOpenChange }: CardManagerSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="h-[90dvh] max-h-[90dvh] flex flex-col p-0 pb-[env(safe-area-inset-bottom)]"
      >
        <SheetHeader className="px-6 pt-6 pb-2">
          <SheetTitle className="text-primary">Gerenciar Cartões</SheetTitle>
        </SheetHeader>
        <div className="flex-1 overflow-y-auto px-4 pb-6">
          <CardManager />
        </div>
      </SheetContent>
    </Sheet>
  );
}
