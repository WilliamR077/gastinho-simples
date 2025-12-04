import { useState } from 'react';
import { ChevronDown, Users, User, Plus, Link2, Settings } from 'lucide-react';
import { useSharedGroups } from '@/hooks/use-shared-groups';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { CreateGroupDialog } from './create-group-dialog';
import { JoinGroupDialog } from './join-group-dialog';
import { GroupManagementSheet } from './group-management-sheet';

export function ContextSelector() {
  const { groups, currentContext, setPersonalContext, setGroupContext, canCreateGroup } = useSharedGroups();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [joinDialogOpen, setJoinDialogOpen] = useState(false);
  const [manageSheetOpen, setManageSheetOpen] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);

  const handleManageGroup = (groupId: string) => {
    setSelectedGroupId(groupId);
    setManageSheetOpen(true);
  };

  const currentLabel = currentContext.type === 'personal' 
    ? 'Meus Gastos' 
    : currentContext.groupName || 'Grupo';

  const currentColor = currentContext.type === 'group' 
    ? currentContext.groupColor 
    : undefined;

  return (
    <>
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/50 bg-background/95 backdrop-blur-sm">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className="flex items-center gap-2 h-9 px-3 font-medium"
            >
              {currentContext.type === 'personal' ? (
                <User className="h-4 w-4 text-muted-foreground" />
              ) : (
                <div 
                  className="h-4 w-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: currentColor }}
                >
                  <Users className="h-2.5 w-2.5 text-white" />
                </div>
              )}
              <span>{currentLabel}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent 
            align="start" 
            className="w-56 bg-popover border border-border shadow-lg z-50"
          >
            {/* Opção Pessoal */}
            <DropdownMenuItem 
              onClick={setPersonalContext}
              className={`flex items-center gap-2 cursor-pointer ${
                currentContext.type === 'personal' ? 'bg-accent' : ''
              }`}
            >
              <User className="h-4 w-4" />
              <span>Meus Gastos</span>
              {currentContext.type === 'personal' && (
                <span className="ml-auto text-xs text-primary">✓</span>
              )}
            </DropdownMenuItem>

            {/* Lista de Grupos */}
            {groups.length > 0 && (
              <>
                <DropdownMenuSeparator />
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                  Grupos ({groups.length})
                </div>
                {groups.map((group) => (
                  <DropdownMenuItem 
                    key={group.id}
                    onClick={() => setGroupContext(group.id)}
                    className={`flex items-center gap-2 cursor-pointer ${
                      currentContext.groupId === group.id ? 'bg-accent' : ''
                    }`}
                  >
                    <div 
                      className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ backgroundColor: group.color }}
                    >
                      <Users className="h-2.5 w-2.5 text-white" />
                    </div>
                    <span className="flex-1 truncate">
                      {group.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleManageGroup(group.id);
                      }}
                    >
                      <Settings className="h-3 w-3" />
                    </Button>
                    {currentContext.groupId === group.id && (
                      <span className="text-xs text-primary">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </>
            )}

            {/* Ações */}
            <DropdownMenuSeparator />
            <DropdownMenuItem 
              onClick={() => setCreateDialogOpen(true)}
              className="flex items-center gap-2 cursor-pointer"
              disabled={!canCreateGroup}
            >
              <Plus className="h-4 w-4" />
              <span>Criar Grupo</span>
              {!canCreateGroup && (
                <span className="ml-auto text-xs text-muted-foreground">Premium</span>
              )}
            </DropdownMenuItem>
            <DropdownMenuItem 
              onClick={() => setJoinDialogOpen(true)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <Link2 className="h-4 w-4" />
              <span>Entrar em Grupo</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Indicador de membros quando em grupo */}
        {currentContext.type === 'group' && (
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Users className="h-3 w-3" />
            <span>
              {groups.find(g => g.id === currentContext.groupId)?.member_count || 0} membros
            </span>
          </div>
        )}
      </div>

      {/* Dialogs */}
      <CreateGroupDialog 
        open={createDialogOpen} 
        onOpenChange={setCreateDialogOpen} 
      />
      <JoinGroupDialog 
        open={joinDialogOpen} 
        onOpenChange={setJoinDialogOpen} 
      />
      <GroupManagementSheet 
        open={manageSheetOpen} 
        onOpenChange={setManageSheetOpen}
        groupId={selectedGroupId}
      />
    </>
  );
}
