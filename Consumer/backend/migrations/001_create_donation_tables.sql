-- Migration: Create donation-related tables
-- Run this in your Supabase SQL editor or database console

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create donations table
CREATE TABLE IF NOT EXISTS donations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    quantity DECIMAL(10,2),
    unit VARCHAR(50),
    pickup_instructions TEXT,
    location_lat DECIMAL(10,8),
    location_lng DECIMAL(11,8),
    available_from TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    status VARCHAR(20) DEFAULT 'available' CHECK (status IN ('available', 'pending', 'claimed')),
    donation_type VARCHAR(20) DEFAULT 'human' CHECK (donation_type IN ('human', 'animal')),
    accepted_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create donation_requests table
CREATE TABLE IF NOT EXISTS donation_requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    message TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- Ensure one request per user per donation
    UNIQUE(donation_id, user_id)
);

-- Create conversations table
CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    donation_id UUID REFERENCES donations(id) ON DELETE CASCADE,
    participants UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_by UUID[] DEFAULT '{}'
);

-- Add read_by column to existing messages table if it doesn't exist
ALTER TABLE messages ADD COLUMN IF NOT EXISTS read_by UUID[] DEFAULT '{}';

-- Create message read status table for better tracking
CREATE TABLE IF NOT EXISTS message_reads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(message_id, user_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_donations_user_id ON donations(user_id);
CREATE INDEX IF NOT EXISTS idx_donations_status ON donations(status);
CREATE INDEX IF NOT EXISTS idx_donations_donation_type ON donations(donation_type);
CREATE INDEX IF NOT EXISTS idx_donations_created_at ON donations(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_donation_requests_donation_id ON donation_requests(donation_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_user_id ON donation_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_donation_requests_status ON donation_requests(status);

CREATE INDEX IF NOT EXISTS idx_conversations_donation_id ON conversations(donation_id);
CREATE INDEX IF NOT EXISTS idx_conversations_participants ON conversations USING GIN(participants);

CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_read_by ON messages USING GIN(read_by);

CREATE INDEX IF NOT EXISTS idx_message_reads_message_id ON message_reads(message_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_user_id ON message_reads(user_id);
CREATE INDEX IF NOT EXISTS idx_message_reads_read_at ON message_reads(read_at);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
DROP TRIGGER IF EXISTS update_donations_updated_at ON donations;
CREATE TRIGGER update_donations_updated_at BEFORE UPDATE ON donations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_donation_requests_updated_at ON donation_requests;
CREATE TRIGGER update_donation_requests_updated_at BEFORE UPDATE ON donation_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_conversations_updated_at ON conversations;
CREATE TRIGGER update_conversations_updated_at BEFORE UPDATE ON conversations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) for security
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE donation_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE message_reads ENABLE ROW LEVEL SECURITY;

-- RLS Policies for donations table
-- Users can view all available donations
DROP POLICY IF EXISTS "Users can view available donations" ON donations;
CREATE POLICY "Users can view available donations" ON donations
    FOR SELECT USING (status = 'available');

-- Users can view their own donations
DROP POLICY IF EXISTS "Users can view own donations" ON donations;
CREATE POLICY "Users can view own donations" ON donations
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create their own donations
DROP POLICY IF EXISTS "Users can create donations" ON donations;
CREATE POLICY "Users can create donations" ON donations
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own donations
DROP POLICY IF EXISTS "Users can update own donations" ON donations;
CREATE POLICY "Users can update own donations" ON donations
    FOR UPDATE USING (auth.uid() = user_id);

-- RLS Policies for donation_requests table
-- Users can view requests for their donations
DROP POLICY IF EXISTS "Users can view requests for own donations" ON donation_requests;
CREATE POLICY "Users can view requests for own donations" ON donation_requests
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM donations
            WHERE donations.id = donation_requests.donation_id
            AND donations.user_id = auth.uid()
        )
    );

-- Users can view their own requests
DROP POLICY IF EXISTS "Users can view own requests" ON donation_requests;
CREATE POLICY "Users can view own requests" ON donation_requests
    FOR SELECT USING (auth.uid() = user_id);

-- Users can create requests
DROP POLICY IF EXISTS "Users can create requests" ON donation_requests;
CREATE POLICY "Users can create requests" ON donation_requests
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update requests for their donations (accept/reject)
DROP POLICY IF EXISTS "Users can update requests for own donations" ON donation_requests;
CREATE POLICY "Users can update requests for own donations" ON donation_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM donations
            WHERE donations.id = donation_requests.donation_id
            AND donations.user_id = auth.uid()
        )
    );

-- RLS Policies for conversations table
-- Users can view conversations they're participating in
DROP POLICY IF EXISTS "Users can view own conversations" ON conversations;
CREATE POLICY "Users can view own conversations" ON conversations
    FOR SELECT USING (auth.uid() = ANY(participants));

-- Users can create conversations
DROP POLICY IF EXISTS "Users can create conversations" ON conversations;
CREATE POLICY "Users can create conversations" ON conversations
    FOR INSERT WITH CHECK (auth.uid() = ANY(participants));

-- RLS Policies for messages table
-- Users can view messages in conversations they're participating in
DROP POLICY IF EXISTS "Users can view messages in own conversations" ON messages;
CREATE POLICY "Users can view messages in own conversations" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND auth.uid() = ANY(conversations.participants)
        )
    );

-- Users can create messages in conversations they're participating in
DROP POLICY IF EXISTS "Users can create messages in own conversations" ON messages;
CREATE POLICY "Users can create messages in own conversations" ON messages
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM conversations
            WHERE conversations.id = messages.conversation_id
            AND auth.uid() = ANY(conversations.participants)
        )
        AND auth.uid() = sender_id
    );

-- RLS Policies for message_reads table
-- Users can view read status for messages in conversations they're participating in
DROP POLICY IF EXISTS "Users can view message reads in own conversations" ON message_reads;
CREATE POLICY "Users can view message reads in own conversations" ON message_reads
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.id = message_reads.message_id
            AND auth.uid() = ANY(c.participants)
        )
    );

-- Users can mark messages as read in conversations they're participating in
DROP POLICY IF EXISTS "Users can mark messages as read in own conversations" ON message_reads;
CREATE POLICY "Users can mark messages as read in own conversations" ON message_reads
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM messages m
            JOIN conversations c ON c.id = m.conversation_id
            WHERE m.id = message_reads.message_id
            AND auth.uid() = ANY(c.participants)
        )
        AND auth.uid() = user_id
    );

-- Users can update their own read status
DROP POLICY IF EXISTS "Users can update own message reads" ON message_reads;
CREATE POLICY "Users can update own message reads" ON message_reads
    FOR UPDATE USING (auth.uid() = user_id);

-- Function to mark a message as read
CREATE OR REPLACE FUNCTION mark_message_read(message_id UUID, user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Update the read_by array in messages table
  UPDATE messages
  SET read_by = array_append(COALESCE(read_by, '{}'), user_id)
  WHERE id = message_id AND NOT (read_by @> ARRAY[user_id]);

  -- Insert into message_reads table for detailed tracking
  INSERT INTO message_reads (message_id, user_id, read_at)
  VALUES (message_id, user_id, NOW())
  ON CONFLICT (message_id, user_id) DO NOTHING;
END;
$$;