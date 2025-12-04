import { useState } from 'react';
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
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Users, Crown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CreateGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const GROUP_COLORS = [
  '#6366f1', // Indigo
  '#8b5cf6', // Violet
  '#ec4899', // Pink
  '#ef4444', // Red
  '#f97316', // Orange
  '#eab308', // Yellow
  '#22c55e', // Green
  '#14b8a6', // Teal
  '#06b6d4', // Cyan
  '#3b82f6', // Blue
];

export function CreateGroupDialog({ open, onOpenChange }: CreateGroupDialogProps) {
  const navigate = useNavigate();
  const { createGroup, canCreateGroup, maxGroups, groupsCreatedCount } = useSharedGroups();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [color, setColor] = useState(GROUP_COLORS[0]);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name.trim()) return;

    setIsLoading(true);
    try {
      const group = await createGroup({
        name: name.trim(),
        description: description.trim() || undefined,
        color,
      });

      if (group) {
        onOpenChange(false);
        setName('');
        setDescription('');
        setColor(GROUP_COLORS[0]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate('/subscription');
  };

  // Se não pode criar grupos (não é premium)
  if (!canCreateGroup && groupsCreatedCount === 0) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-yellow-500" />
              Recurso Premium
            </DialogTitle>
            <DialogDescription>
              Criar grupos compartilhados é um recurso exclusivo para assinantes Premium e Premium Plus.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center py-6 gap-4">
            <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm text-muted-foreground">
                Com o Premium, você pode criar até <strong>3 grupos</strong> e convidar até <strong>5 pessoas</strong> por grupo.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpgrade}>
              Ver Planos
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  // Se atingiu o limite de grupos
  if (!canCreateGroup && groupsCreatedCount >= maxGroups) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Limite de Grupos Atingido</DialogTitle>
            <DialogDescription>
              Você já criou {groupsCreatedCount} de {maxGroups} grupos permitidos no seu plano.
            </DialogDescription>
          </DialogHeader>

          <div className="py-4 text-center text-sm text-muted-foreground">
            Para criar mais grupos, você pode excluir um grupo existente ou aguardar futuras atualizações do plano.
          </div>

          <DialogFooter>
            <Button onClick={() => onOpenChange(false)}>
              Entendi
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Criar Novo Grupo
          </DialogTitle>
          <DialogDescription>
            Crie um grupo para compartilhar despesas com família ou amigos.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nome do Grupo *</Label>
            <Input
              id="name"
              placeholder="Ex: Família, Casa, Viagem..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Adicione uma descrição para o grupo..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
              rows={2}
            />
          </div>

          <div className="space-y-2">
            <Label>Cor do Grupo</Label>
            <div className="flex flex-wrap gap-2">
              {GROUP_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`h-8 w-8 rounded-full transition-all ${
                    color === c 
                      ? 'ring-2 ring-offset-2 ring-offset-background ring-primary scale-110' 
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            Grupos criados: {groupsCreatedCount}/{maxGroups}
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
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Criando...
                </>
              ) : (
                'Criar Grupo'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
