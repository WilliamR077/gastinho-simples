import { useState, useEffect, useCallback, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './use-auth';
import { useSubscription } from './use-subscription';
import { toast } from 'sonner';
import {
  SharedGroup,
  SharedGroupMember,
  SharedGroupContext,
  CreateGroupInput,
  GroupMemberRole,
} from '@/types/shared-group';

interface SharedGroupsContextType {
  // Estado
  groups: SharedGroup[];
  currentContext: SharedGroupContext;
  isLoading: boolean;
  
  // Permissões
  canCreateGroup: boolean;
  maxGroups: number;
  groupsCreatedCount: number;
  
  // Ações de contexto
  setContext: (context: SharedGroupContext) => void;
  setPersonalContext: () => void;
  setGroupContext: (groupId: string) => void;
  
  // Ações de grupo
  createGroup: (input: CreateGroupInput) => Promise<SharedGroup | null>;
  joinGroup: (inviteCode: string) => Promise<boolean>;
  leaveGroup: (groupId: string) => Promise<boolean>;
  deleteGroup: (groupId: string) => Promise<boolean>;
  updateGroup: (groupId: string, data: Partial<CreateGroupInput>) => Promise<boolean>;
  
  // Ações de membros
  getGroupMembers: (groupId: string) => Promise<SharedGroupMember[]>;
  removeMember: (groupId: string, userId: string) => Promise<boolean>;
  
  // Utilitários
  getMyRoleInGroup: (groupId: string) => GroupMemberRole | undefined;
  refreshGroups: () => Promise<void>;
}

const SharedGroupsContext = createContext<SharedGroupsContextType | undefined>(undefined);

const CONTEXT_STORAGE_KEY = 'gastinho_group_context';

export function SharedGroupsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { tier } = useSubscription();
  
  const [groups, setGroups] = useState<SharedGroup[]>([]);
  const [currentContext, setCurrentContext] = useState<SharedGroupContext>({ type: 'personal' });
  const [isLoading, setIsLoading] = useState(true);
  const [groupsCreatedCount, setGroupsCreatedCount] = useState(0);

  // Permissões baseadas no tier
  const isPremium = tier === 'premium' || tier === 'premium_plus';
  const maxGroups = isPremium ? 3 : 0;
  const canCreateGroup = isPremium && groupsCreatedCount < maxGroups;

  // Carregar contexto salvo do localStorage
  useEffect(() => {
    const savedContext = localStorage.getItem(CONTEXT_STORAGE_KEY);
    if (savedContext) {
      try {
        const parsed = JSON.parse(savedContext) as SharedGroupContext;
        setCurrentContext(parsed);
      } catch {
        // Ignorar erro de parse
      }
    }
  }, []);

  // Salvar contexto no localStorage quando mudar
  useEffect(() => {
    localStorage.setItem(CONTEXT_STORAGE_KEY, JSON.stringify(currentContext));
  }, [currentContext]);

  // Buscar grupos do usuário
  const fetchGroups = useCallback(async () => {
    if (!user) {
      setGroups([]);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Buscar grupos onde o usuário é membro
      const { data: memberData, error: memberError } = await supabase
        .from('shared_group_members')
        .select('group_id, role')
        .eq('user_id', user.id);

      if (memberError) throw memberError;

      if (!memberData || memberData.length === 0) {
        setGroups([]);
        setGroupsCreatedCount(0);
        setIsLoading(false);
        return;
      }

      const groupIds = memberData.map(m => m.group_id);
      const roleMap = new Map(memberData.map(m => [m.group_id, m.role as GroupMemberRole]));

      // Buscar detalhes dos grupos
      const { data: groupsData, error: groupsError } = await supabase
        .from('shared_groups')
        .select('*')
        .in('id', groupIds)
        .eq('is_active', true);

      if (groupsError) throw groupsError;

      // Buscar contagem de membros para cada grupo
      const groupsWithMeta: SharedGroup[] = await Promise.all(
        (groupsData || []).map(async (group) => {
          const { count } = await supabase
            .from('shared_group_members')
            .select('*', { count: 'exact', head: true })
            .eq('group_id', group.id);

          return {
            ...group,
            member_count: count || 0,
            my_role: roleMap.get(group.id),
          };
        })
      );

      setGroups(groupsWithMeta);
      
      // Contar grupos criados pelo usuário
      const createdCount = groupsWithMeta.filter(g => g.created_by === user.id).length;
      setGroupsCreatedCount(createdCount);

      // Validar contexto atual - se o grupo selecionado não existe mais, voltar para pessoal
      if (currentContext.type === 'group' && currentContext.groupId) {
        const groupExists = groupsWithMeta.some(g => g.id === currentContext.groupId);
        if (!groupExists) {
          setCurrentContext({ type: 'personal' });
        }
      }
    } catch (error) {
      console.error('Erro ao buscar grupos:', error);
      toast.error('Erro ao carregar grupos');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentContext.groupId, currentContext.type]);

  useEffect(() => {
    fetchGroups();
  }, [fetchGroups]);

  // Funções de contexto
  const setContext = useCallback((context: SharedGroupContext) => {
    setCurrentContext(context);
  }, []);

  const setPersonalContext = useCallback(() => {
    setCurrentContext({ type: 'personal' });
  }, []);

  const setGroupContext = useCallback((groupId: string) => {
    const group = groups.find(g => g.id === groupId);
    if (group) {
      setCurrentContext({
        type: 'group',
        groupId: group.id,
        groupName: group.name,
        groupColor: group.color,
      });
    }
  }, [groups]);

  // Criar grupo
  const createGroup = useCallback(async (input: CreateGroupInput): Promise<SharedGroup | null> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return null;
    }

    if (!canCreateGroup) {
      if (!isPremium) {
        toast.error('Apenas assinantes Premium podem criar grupos');
      } else {
        toast.error(`Você atingiu o limite de ${maxGroups} grupos`);
      }
      return null;
    }

    try {
      // Gerar código de convite
      const { data: codeData, error: codeError } = await supabase
        .rpc('generate_invite_code');

      if (codeError) throw codeError;

      const inviteCode = codeData as string;

      // Criar o grupo
      const { data: groupData, error: groupError } = await supabase
        .from('shared_groups')
        .insert({
          name: input.name,
          description: input.description || null,
          color: input.color || '#6366f1',
          created_by: user.id,
          invite_code: inviteCode,
        })
        .select()
        .single();

      if (groupError) throw groupError;

      // Adicionar criador como owner
      const { error: memberError } = await supabase
        .from('shared_group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          role: 'owner',
        });

      if (memberError) throw memberError;

      toast.success('Grupo criado com sucesso!');
      
      // Atualizar lista e mudar contexto
      await fetchGroups();
      setGroupContext(groupData.id);

      return {
        ...groupData,
        member_count: 1,
        my_role: 'owner',
      };
    } catch (error: any) {
      console.error('Erro ao criar grupo:', error);
      toast.error(error.message || 'Erro ao criar grupo');
      return null;
    }
  }, [user, canCreateGroup, isPremium, maxGroups, fetchGroups, setGroupContext]);

  // Entrar em grupo via código
  const joinGroup = useCallback(async (inviteCode: string): Promise<boolean> => {
    if (!user) {
      toast.error('Você precisa estar logado');
      return false;
    }

    const normalizedCode = inviteCode.toUpperCase().trim();

    try {
      // Buscar grupo pelo código usando função RPC (bypassa RLS de forma segura)
      const { data: groupResult, error: rpcError } = await supabase
        .rpc('find_group_by_invite_code', { invite_code_param: normalizedCode });

      if (rpcError) throw rpcError;

      // A função retorna um array, pegar o primeiro resultado
      const groupData = Array.isArray(groupResult) ? groupResult[0] : groupResult;

      if (!groupData) {
        toast.error('Código de convite inválido');
        return false;
      }

      // Verificar se já é membro
      const { data: existingMember } = await supabase
        .from('shared_group_members')
        .select('id')
        .eq('group_id', groupData.id)
        .eq('user_id', user.id)
        .maybeSingle();

      if (existingMember) {
        toast.error('Você já faz parte deste grupo');
        return false;
      }

      // Verificar limite de membros
      const { count } = await supabase
        .from('shared_group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupData.id);

      if (count && count >= groupData.max_members) {
        toast.error('Este grupo está cheio');
        return false;
      }

      // Adicionar como membro
      const { error: memberError } = await supabase
        .from('shared_group_members')
        .insert({
          group_id: groupData.id,
          user_id: user.id,
          role: 'member',
        });

      if (memberError) throw memberError;

      toast.success(`Você entrou no grupo "${groupData.name}"!`);
      
      // Atualizar lista e mudar contexto
      await fetchGroups();
      setGroupContext(groupData.id);

      return true;
    } catch (error: any) {
      console.error('Erro ao entrar no grupo:', error);
      toast.error(error.message || 'Erro ao entrar no grupo');
      return false;
    }
  }, [user, fetchGroups, setGroupContext]);

  // Sair de grupo
  const leaveGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!user) return false;

    const group = groups.find(g => g.id === groupId);
    if (!group) return false;

    // Owner não pode sair, deve deletar
    if (group.my_role === 'owner') {
      toast.error('O dono não pode sair do grupo. Delete o grupo se quiser removê-lo.');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shared_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', user.id);

      if (error) throw error;

      toast.success('Você saiu do grupo');
      
      // Se estava no contexto deste grupo, voltar para pessoal
      if (currentContext.groupId === groupId) {
        setPersonalContext();
      }
      
      await fetchGroups();
      return true;
    } catch (error: any) {
      console.error('Erro ao sair do grupo:', error);
      toast.error(error.message || 'Erro ao sair do grupo');
      return false;
    }
  }, [user, groups, currentContext.groupId, setPersonalContext, fetchGroups]);

  // Deletar grupo (apenas owner)
  const deleteGroup = useCallback(async (groupId: string): Promise<boolean> => {
    if (!user) return false;

    const group = groups.find(g => g.id === groupId);
    if (!group || group.my_role !== 'owner') {
      toast.error('Apenas o dono pode excluir o grupo');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shared_groups')
        .delete()
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Grupo excluído com sucesso');
      
      if (currentContext.groupId === groupId) {
        setPersonalContext();
      }
      
      await fetchGroups();
      return true;
    } catch (error: any) {
      console.error('Erro ao excluir grupo:', error);
      toast.error(error.message || 'Erro ao excluir grupo');
      return false;
    }
  }, [user, groups, currentContext.groupId, setPersonalContext, fetchGroups]);

  // Atualizar grupo
  const updateGroup = useCallback(async (groupId: string, data: Partial<CreateGroupInput>): Promise<boolean> => {
    if (!user) return false;

    const group = groups.find(g => g.id === groupId);
    if (!group || !['owner', 'admin'].includes(group.my_role || '')) {
      toast.error('Você não tem permissão para editar este grupo');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shared_groups')
        .update({
          name: data.name,
          description: data.description,
          color: data.color,
          updated_at: new Date().toISOString(),
        })
        .eq('id', groupId);

      if (error) throw error;

      toast.success('Grupo atualizado');
      await fetchGroups();
      
      // Atualizar contexto se estiver no grupo
      if (currentContext.groupId === groupId && data.name) {
        setCurrentContext(prev => ({
          ...prev,
          groupName: data.name,
          groupColor: data.color || prev.groupColor,
        }));
      }
      
      return true;
    } catch (error: any) {
      console.error('Erro ao atualizar grupo:', error);
      toast.error(error.message || 'Erro ao atualizar grupo');
      return false;
    }
  }, [user, groups, currentContext.groupId, fetchGroups]);

  // Buscar membros do grupo
  const getGroupMembers = useCallback(async (groupId: string): Promise<SharedGroupMember[]> => {
    try {
      const { data, error } = await supabase
        .from('shared_group_members')
        .select('*')
        .eq('group_id', groupId)
        .order('joined_at', { ascending: true });

      if (error) throw error;

      return (data || []) as SharedGroupMember[];
    } catch (error) {
      console.error('Erro ao buscar membros:', error);
      return [];
    }
  }, []);

  // Remover membro (apenas owner)
  const removeMember = useCallback(async (groupId: string, userId: string): Promise<boolean> => {
    if (!user) return false;

    const group = groups.find(g => g.id === groupId);
    if (!group || group.my_role !== 'owner') {
      toast.error('Apenas o dono pode remover membros');
      return false;
    }

    if (userId === user.id) {
      toast.error('Você não pode remover a si mesmo');
      return false;
    }

    try {
      const { error } = await supabase
        .from('shared_group_members')
        .delete()
        .eq('group_id', groupId)
        .eq('user_id', userId);

      if (error) throw error;

      toast.success('Membro removido');
      await fetchGroups();
      return true;
    } catch (error: any) {
      console.error('Erro ao remover membro:', error);
      toast.error(error.message || 'Erro ao remover membro');
      return false;
    }
  }, [user, groups, fetchGroups]);

  // Obter role do usuário em um grupo específico
  const getMyRoleInGroup = useCallback((groupId: string): GroupMemberRole | undefined => {
    const group = groups.find(g => g.id === groupId);
    return group?.my_role;
  }, [groups]);

  const value: SharedGroupsContextType = {
    groups,
    currentContext,
    isLoading,
    canCreateGroup,
    maxGroups,
    groupsCreatedCount,
    setContext,
    setPersonalContext,
    setGroupContext,
    createGroup,
    joinGroup,
    leaveGroup,
    deleteGroup,
    updateGroup,
    getGroupMembers,
    removeMember,
    getMyRoleInGroup,
    refreshGroups: fetchGroups,
  };

  return (
    <SharedGroupsContext.Provider value={value}>
      {children}
    </SharedGroupsContext.Provider>
  );
}

export function useSharedGroups() {
  const context = useContext(SharedGroupsContext);
  if (context === undefined) {
    throw new Error('useSharedGroups must be used within a SharedGroupsProvider');
  }
  return context;
}
