export type GroupMemberRole = 'owner' | 'admin' | 'member';

export interface SharedGroup {
  id: string;
  name: string;
  description: string | null;
  created_by: string;
  invite_code: string;
  color: string;
  max_members: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Campos calculados (não vêm do banco diretamente)
  member_count?: number;
  my_role?: GroupMemberRole;
}

export interface SharedGroupMember {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupMemberRole;
  joined_at: string;
  // Campos de join (opcional)
  user_email?: string;
}

export interface SharedGroupContext {
  type: 'personal' | 'group';
  groupId?: string;
  groupName?: string;
  groupColor?: string;
}

export interface SharedGroupWithMembers extends SharedGroup {
  members: SharedGroupMember[];
}

// Para criar um novo grupo
export interface CreateGroupInput {
  name: string;
  description?: string;
  color?: string;
}

// Para entrar em um grupo
export interface JoinGroupInput {
  invite_code: string;
}
