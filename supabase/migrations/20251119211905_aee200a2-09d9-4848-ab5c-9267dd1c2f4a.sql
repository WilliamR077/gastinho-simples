-- Tabela para armazenar FCM tokens dos usuários
create table if not exists public.user_fcm_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  fcm_token text not null,
  device_info jsonb default '{}'::jsonb,
  created_at timestamp with time zone default now() not null,
  updated_at timestamp with time zone default now() not null,
  
  -- Um usuário pode ter múltiplos dispositivos, mas cada token é único
  unique(fcm_token)
);

-- Índice para buscar tokens por usuário rapidamente
create index if not exists idx_user_fcm_tokens_user_id 
  on public.user_fcm_tokens(user_id);

-- RLS Policies
alter table public.user_fcm_tokens enable row level security;

-- Usuários podem ver seus próprios tokens
create policy "Users can view their own FCM tokens"
  on public.user_fcm_tokens
  for select
  to authenticated
  using (auth.uid() = user_id);

-- Usuários podem inserir seus próprios tokens
create policy "Users can insert their own FCM tokens"
  on public.user_fcm_tokens
  for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Usuários podem atualizar seus próprios tokens
create policy "Users can update their own FCM tokens"
  on public.user_fcm_tokens
  for update
  to authenticated
  using (auth.uid() = user_id);

-- Usuários podem deletar seus próprios tokens
create policy "Users can delete their own FCM tokens"
  on public.user_fcm_tokens
  for delete
  to authenticated
  using (auth.uid() = user_id);

-- Trigger para atualizar updated_at automaticamente
create or replace function public.update_user_fcm_tokens_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer;

create trigger update_user_fcm_tokens_updated_at
  before update on public.user_fcm_tokens
  for each row
  execute function public.update_user_fcm_tokens_updated_at();