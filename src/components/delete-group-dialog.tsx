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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import { Trash2, ArrowRight, AlertTriangle } from "lucide-react";

export type DeleteGroupAction = 'move_to_personal' | 'delete_all';

interface DeleteGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupName: string;
  onConfirm: (action: DeleteGroupAction) => void;
}

export function DeleteGroupDialog({
  open,
  onOpenChange,
  groupName,
  onConfirm,
}: DeleteGroupDialogProps) {
  const [selectedAction, setSelectedAction] = useState<DeleteGroupAction>('move_to_personal');

  const handleConfirm = () => {
    onConfirm(selectedAction);
    onOpenChange(false);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-destructive" />
            Excluir grupo "{groupName}"
          </AlertDialogTitle>
          <AlertDialogDescription>
            O que deseja fazer com as despesas e metas deste grupo?
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="py-4">
          <RadioGroup 
            value={selectedAction} 
            onValueChange={(value) => setSelectedAction(value as DeleteGroupAction)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="move_to_personal" id="move" className="mt-1" />
              <Label htmlFor="move" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <ArrowRight className="h-4 w-4 text-primary" />
                  Mover para meus gastos pessoais
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  As despesas de cada membro serão movidas para a conta pessoal de cada um. As metas do grupo serão removidas.
                </p>
              </Label>
            </div>

            <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer">
              <RadioGroupItem value="delete_all" id="delete" className="mt-1" />
              <Label htmlFor="delete" className="flex-1 cursor-pointer">
                <div className="flex items-center gap-2 font-medium">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  Apagar todas as despesas
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Todas as despesas e metas do grupo serão excluídas permanentemente
                </p>
              </Label>
            </div>
          </RadioGroup>
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={selectedAction === 'delete_all' ? 'bg-destructive hover:bg-destructive/90' : ''}
          >
            {selectedAction === 'delete_all' ? 'Apagar tudo' : 'Mover e excluir grupo'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
