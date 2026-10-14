-- =========================================================================
-- NEXUS AI - SUPABASE DATABASE SCHEMA
-- Run this script in the Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)
-- =========================================================================

-- 1. Create Chats table
create table if not exists public.chats (
  id text primary key,
  title text not null default 'New Conversation',
  persona text default 'core',
  pinned boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Create Messages table
create table if not exists public.messages (
  id text primary key,
  chat_id text not null references public.chats(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Indexes for query performance
create index if not exists idx_messages_chat_id on public.messages(chat_id);
create index if not exists idx_chats_updated_at on public.chats(updated_at desc);

-- 4. Enable Row Level Security (RLS)
alter table public.chats enable row level security;
alter table public.messages enable row level security;

-- 5. Open access policy for development / service role
-- (You can restrict this to auth.uid() = user_id once Supabase Auth is enabled)
create policy "Allow all operations for public anon/service"
  on public.chats for all using (true) with check (true);

create policy "Allow all operations for messages anon/service"
  on public.messages for all using (true) with check (true);

-- Done! Tables 'chats' and 'messages' are ready for Nexus AI.
