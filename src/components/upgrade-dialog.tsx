import { useNavigate } from "react-router-dom";
import { Crown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface UpgradeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  features?: string[];
}

export function UpgradeDialog({ open, onOpenChange, title, description, features }: UpgradeDialogProps) {
  const navigate = useNavigate();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Crown className="h-5 w-5 text-yellow-500" />
            {title}
          </DialogTitle>
          <DialogDescription className="text-left space-y-3 pt-2">
            <p>{description}</p>
            {features && features.length > 0 && (
              <>
                <p className="font-medium">Com o Premium você pode:</p>
                <ul className="list-disc list-inside space-y-1 text-sm">
                  {features.map((f, i) => (
                    <li key={i}>{f}</li>
                  ))}
                </ul>
              </>
            )}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="w-full sm:w-auto">
            Agora não
          </Button>
          <Button
            onClick={() => { onOpenChange(false); navigate("/subscription"); }}
            className="w-full sm:w-auto gap-2"
          >
            Virar Premium ⭐
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
