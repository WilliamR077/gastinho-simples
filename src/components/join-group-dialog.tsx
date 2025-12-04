import { useState, useRef, useEffect } from 'react';
import { useSharedGroups } from '@/hooks/use-shared-groups';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Link2 } from 'lucide-react';

interface JoinGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JoinGroupDialog({ open, onOpenChange }: JoinGroupDialogProps) {
  const { joinGroup } = useSharedGroups();
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focar no primeiro input quando abrir
  useEffect(() => {
    if (open) {
      setCode(['', '', '', '', '', '']);
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [open]);

  const handleChange = (index: number, value: string) => {
    // Aceitar apenas letras e números
    const char = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    if (char.length === 0) {
      const newCode = [...code];
      newCode[index] = '';
      setCode(newCode);
      return;
    }

    // Se colar código completo
    if (char.length > 1) {
      const chars = char.slice(0, 6).split('');
      const newCode = [...code];
      chars.forEach((c, i) => {
        if (i < 6) newCode[i] = c;
      });
      setCode(newCode);
      inputRefs.current[Math.min(chars.length, 5)]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = char;
    setCode(newCode);

    // Mover para próximo input
    if (index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedText = e.clipboardData.getData('text').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const chars = pastedText.slice(0, 6).split('');
    const newCode = ['', '', '', '', '', ''];
    chars.forEach((c, i) => {
      newCode[i] = c;
    });
    setCode(newCode);
    inputRefs.current[Math.min(chars.length, 5)]?.focus();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const fullCode = code.join('');
    if (fullCode.length !== 6) return;

    setIsLoading(true);
    try {
      const success = await joinGroup(fullCode);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isCodeComplete = code.every(c => c !== '');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Entrar em um Grupo
          </DialogTitle>
          <DialogDescription>
            Digite o código de convite de 6 caracteres para entrar em um grupo compartilhado.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="flex justify-center gap-2">
              {code.map((char, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="text"
                  maxLength={6}
                  value={char}
                  onChange={(e) => handleChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  className="w-11 h-12 text-center text-lg font-bold uppercase"
                  disabled={isLoading}
                />
              ))}
            </div>

            <p className="text-xs text-center text-muted-foreground">
              Peça o código para quem criou o grupo.
            </p>
          </div>

          <DialogFooter>
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading || !isCodeComplete}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
