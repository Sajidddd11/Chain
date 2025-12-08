-- Chatbot conversations table
create table if not exists public.chatbot_conversations (
    id uuid primary key default uuid_generate_v4(),
    user_id uuid references public.users (id) on delete cascade,
    title text default 'NourishBot Chat',
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

-- Chatbot messages table
create table if not exists public.chatbot_messages (
    id uuid primary key default uuid_generate_v4(),
    conversation_id uuid references public.chatbot_conversations (id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_chatbot_conversations_user_id on public.chatbot_conversations (user_id);
create index if not exists idx_chatbot_conversations_updated_at on public.chatbot_conversations (updated_at desc);
create index if not exists idx_chatbot_messages_conversation_id on public.chatbot_messages (conversation_id);
create index if not exists idx_chatbot_messages_created_at on public.chatbot_messages (created_at);

-- Function to update updated_at timestamp
create or replace function update_chatbot_conversation_timestamp()
returns trigger as $$
begin
    update public.chatbot_conversations
    set updated_at = now()
    where id = new.conversation_id;
    return new;
end;
$$ language plpgsql;

-- Trigger to auto-update conversation timestamp
create trigger update_chatbot_conversation_updated_at
    after insert on public.chatbot_messages
    for each row
    execute function update_chatbot_conversation_timestamp();

