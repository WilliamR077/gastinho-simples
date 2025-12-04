import { useState, useEffect } from 'react';
import { useSharedGroups } from '@/hooks/use-shared-groups';
import { useAuth } from '@/hooks/use-auth';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { DeleteGroupDialog, DeleteGroupAction } from './delete-group-dialog';
import { 
  Copy, 
  Check, 
  Users, 
  Crown, 
  Shield, 
  User,
  Trash2,
  LogOut,
  Loader2,
  Pencil,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { SharedGroup, SharedGroupMember, GroupMemberRole } from '@/types/shared-group';

interface GroupManagementSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId: string | null;
}

const roleLabels: Record<GroupMemberRole, { label: string; icon: React.ReactNode }> = {
  owner: { label: 'Dono', icon: <Crown className="h-3 w-3 text-yellow-500" /> },
  admin: { label: 'Admin', icon: <Shield className="h-3 w-3 text-blue-500" /> },
  member: { label: 'Membro', icon: <User className="h-3 w-3 text-muted-foreground" /> },
};

// Extrai o nome de exibição do email (parte antes do @)
const getDisplayName = (email: string | undefined): string => {
  if (!email) return 'Membro';
  return email.split('@')[0];
};

export function GroupManagementSheet({ open, onOpenChange, groupId }: GroupManagementSheetProps) {
  const { user } = useAuth();
  const { 
    groups, 
    getGroupMembers, 
    leaveGroup, 
    deleteGroup, 
    removeMember,
    updateGroup 
  } = useSharedGroups();

  const [group, setGroup] = useState<SharedGroup | null>(null);
  const [members, setMembers] = useState<SharedGroupMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showLeaveDialog, setShowLeaveDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState('');

  // Carregar dados do grupo
  useEffect(() => {
    if (open && groupId) {
      const foundGroup = groups.find(g => g.id === groupId);
      setGroup(foundGroup || null);
      setEditName(foundGroup?.name || '');
      
      // Carregar membros
      loadMembers();
    }
  }, [open, groupId, groups]);

  const loadMembers = async () => {
    if (!groupId) return;
    setIsLoading(true);
    try {
      const membersList = await getGroupMembers(groupId);
      setMembers(membersList);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyCode = async () => {
    if (!group) return;
    
    try {
      await navigator.clipboard.writeText(group.invite_code);
      setCopied(true);
      toast.success('Código copiado!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Erro ao copiar código');
    }
  };

  const handleLeave = async () => {
    if (!groupId) return;
    
    const success = await leaveGroup(groupId);
    if (success) {
      onOpenChange(false);
    }
    setShowLeaveDialog(false);
  };

  const handleDelete = async (action: DeleteGroupAction) => {
    if (!groupId) return;
    
    const success = await deleteGroup(groupId, action);
    if (success) {
      onOpenChange(false);
    }
    setShowDeleteDialog(false);
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!groupId) return;
    await removeMember(groupId, memberId);
    loadMembers();
  };

  const handleSaveName = async () => {
    if (!groupId || !editName.trim()) return;
    
    const success = await updateGroup(groupId, { name: editName.trim() });
    if (success) {
      setEditMode(false);
    }
  };

  const isOwner = group?.my_role === 'owner';
  const isAdmin = group?.my_role === 'admin' || isOwner;

  if (!group) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <div 
                className="h-6 w-6 rounded-full flex items-center justify-center"
                style={{ backgroundColor: group.color }}
              >
                <Users className="h-3.5 w-3.5 text-white" />
              </div>
            {editMode ? (
                <div className="flex-1 space-y-2">
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="h-9"
                    maxLength={50}
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <Button 
                      size="icon" 
                      variant="ghost" 
                      className="h-8 w-8"
                      onClick={() => setEditMode(false)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                    <Button 
                      size="icon" 
                      className="h-8 w-8"
                      onClick={handleSaveName}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <span className="flex items-center gap-2">
                  {group.name}
                  {isAdmin && (
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-6 w-6"
                      onClick={() => setEditMode(true)}
                    >
                      <Pencil className="h-3 w-3" />
                    </Button>
                  )}
                </span>
              )}
            </SheetTitle>
            {group.description && (
              <SheetDescription>{group.description}</SheetDescription>
            )}
          </SheetHeader>

          <div className="mt-6 space-y-6">
            {/* Código de Convite */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                Código de Convite
              </Label>
              <div className="flex items-center gap-2">
                <div className="flex-1 bg-muted rounded-md px-4 py-3 font-mono text-lg tracking-widest text-center">
                  {group.invite_code}
                </div>
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleCopyCode}
                >
                  {copied ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Compartilhe este código para convidar pessoas.
              </p>
            </div>

            <Separator />

            {/* Lista de Membros */}
            <div className="space-y-3">
              <Label className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Membros ({members.length}{group.max_members ? `/${group.max_members}` : ''})
              </Label>
              
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const roleInfo = roleLabels[member.role];
                    const isCurrentUser = member.user_id === user?.id;
                    
                    return (
                      <div 
                        key={member.id}
                        className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg"
                      >
                        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {isCurrentUser ? 'Você' : getDisplayName(member.user_email)}
                          </p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            {roleInfo.icon}
                            {roleInfo.label}
                          </p>
                        </div>
                        {isOwner && !isCurrentUser && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleRemoveMember(member.user_id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <Separator />

            {/* Ações */}
            <div className="space-y-2">
              {isOwner ? (
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={() => setShowDeleteDialog(true)}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Excluir Grupo
                </Button>
              ) : (
                <Button
                  variant="outline"
                  className="w-full text-destructive hover:text-destructive"
                  onClick={() => setShowLeaveDialog(true)}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Sair do Grupo
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Dialog de confirmação para sair */}
      <AlertDialog open={showLeaveDialog} onOpenChange={setShowLeaveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair do grupo?</AlertDialogTitle>
            <AlertDialogDescription>
              Você não poderá mais ver as despesas compartilhadas deste grupo. 
              Para voltar, precisará de um novo convite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleLeave}>
              Sair
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog de confirmação para excluir */}
      <DeleteGroupDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        groupName={group.name}
        onConfirm={handleDelete}
      />
    </>
  );
}
