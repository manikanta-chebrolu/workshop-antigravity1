-- =========================================================================
-- SUPABASE MIGRATION: 20261014000000_create_nexus_tables.sql
-- Description: Complete schema setup for Nexus AI Chatbot Studio
-- Idempotent script: Safe to execute multiple times without errors.
-- =========================================================================

-- 1. Create Chats Table
create table if not exists public.chats (
  id text primary key,
  title text not null default 'New Conversation',
  persona text default 'core',
  pinned boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Messages Table
create table if not exists public.messages (
  id text primary key,
  chat_id text not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Performance Indexes
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_messages_created_at on public.messages(created_at asc);
create index if not exists idx_chats_updated_at on public.chats(updated_at desc);

-- 4. Automatic 'updated_at' Timestamp Trigger
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc'::text, now());
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_chats_updated_at on public.chats;
create trigger set_chats_updated_at
  before update on public.chats
  for each row
  execute function public.handle_updated_at();

-- 5. Enable Row Level Security (RLS)
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- 6. Configure RLS Access Policies
do $$
begin
  -- Policy for Chats
  if not exists (
    select 1 from pg_policies where tablename = 'chats' and policyname = 'Allow full access to chats'
  ) then
    create policy "Allow full access to chats"
      on public.chats for all
      using (true) with check (true);
  end if;

  -- Policy for Messages
  if not exists (
    select 1 from pg_policies where tablename = 'messages' and policyname = 'Allow full access to messages'
  ) then
    create policy "Allow full access to messages"
      on public.messages for all
      using (true) with check (true);
  end if;
end $$;

-- 7. Enable Realtime Publications (Optional: enables instant UI socket sync)
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    alter publication supabase_realtime add table public.chats;
    alter publication supabase_realtime add table public.messages;
  end if;
exception
  when others then null; -- Safe ignore if publication is already subscribed
end $$;
