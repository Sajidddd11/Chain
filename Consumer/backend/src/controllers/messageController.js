import { supabase } from '../config/supabaseClient.js';

const ensureSupabase = (res) => {
  if (!supabase) {
    res.status(500).json({ message: 'Supabase client is not configured' });
    return false;
  }
  return true;
};

export const createMessage = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { conversation_id, content } = req.body;

  try {
    const { data, error } = await supabase
      .from('messages')
      .insert([
        {
          conversation_id,
          sender_id: req.user.id,
          content,
        },
      ])
      .select('*, sender:users(id, full_name)')
      .single();

    if (error) throw error;

    return res.status(201).json({ message: 'Message sent', data });
  } catch (err) {
    console.error('createMessage error', err);
    return res.status(500).json({ message: 'Failed to send message', error: err.message });
  }
};

export const getConversations = async (req, res) => {
  if (!ensureSupabase(res)) return;

  try {
    // Get conversations with enhanced data
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select(`
        *,
        messages(
          id,
          content,
          created_at,
          sender:users(id, full_name),
          message_reads(user_id, read_at)
        ),
        donations(*)
      `)
      .or(`participants.cs.{${req.user.id}}`)
      .order('updated_at', { ascending: false });

    if (error) throw error;

    // Get participant information separately
    const conversationsWithParticipants = await Promise.all(
      conversations.map(async (conv) => {
        // Get participants info
        const { data: participantsData, error: participantsError } = await supabase
          .from('users')
          .select('id, full_name')
          .in('id', conv.participants);

        if (participantsError) {
          console.error('Error fetching participants:', participantsError);
          return { ...conv, participants_info: [] };
        }

        return { ...conv, participants_info: participantsData || [] };
      })
    );

    // Enhance conversations with additional metadata
    const enhancedConversations = conversationsWithParticipants.map(conv => {
      const messages = conv.messages || [];
      const lastMessage = messages.length > 0 ? messages[messages.length - 1] : null;

      // Calculate unread count for current user
      const unreadCount = messages.filter(msg => {
        // Message is unread if current user hasn't read it and it's not sent by current user
        if (msg.sender.id === req.user.id) return false;
        return !msg.message_reads?.some(read => read.user_id === req.user.id);
      }).length;

      // Get other participants (excluding current user)
      const otherParticipants = conv.participants_info?.filter(p => p.id !== req.user.id) || [];

      return {
        ...conv,
        lastMessage,
        unreadCount,
        otherParticipants,
        lastActivity: lastMessage?.created_at || conv.updated_at,
        messagePreview: lastMessage ? {
          content: lastMessage.content.length > 100
            ? lastMessage.content.substring(0, 100) + '...'
            : lastMessage.content,
          sender: lastMessage.sender,
          time: lastMessage.created_at
        } : null
      };
    });

    return res.status(200).json({ conversations: enhancedConversations });
  } catch (err) {
    console.error('getConversations error', err);
    return res.status(500).json({ message: 'Failed to fetch conversations', error: err.message });
  }
};

export const getMessages = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { id: conversationId } = req.params;

  try {
    const { data, error } = await supabase
      .from('messages')
      .select(`
        *,
        sender:users(id, full_name),
        message_reads(user_id, read_at)
      `)
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;

    // Mark messages as read for current user
    const unreadMessages = data.filter(msg =>
      msg.sender_id !== req.user.id &&
      !msg.message_reads?.some(read => read.user_id === req.user.id)
    );

    if (unreadMessages.length > 0) {
      const readInserts = unreadMessages.map(msg => ({
        message_id: msg.id,
        user_id: req.user.id
      }));

      // Insert read status (ignore conflicts if already marked as read)
      await supabase
        .from('message_reads')
        .upsert(readInserts, { onConflict: 'message_id,user_id' });
    }

    return res.status(200).json({ messages: data });
  } catch (err) {
    console.error('getMessages error', err);
    return res.status(500).json({ message: 'Failed to fetch messages', error: err.message });
  }
};

export const markMessagesAsRead = async (req, res) => {
  if (!ensureSupabase(res)) return;

  const { conversationId } = req.params;

  try {
    // Get unread messages for this conversation
    const { data: unreadMessages, error: fetchError } = await supabase
      .from('messages')
      .select('id')
      .eq('conversation_id', conversationId)
      .neq('sender_id', req.user.id)
      .not('read_by', 'cs', `{${req.user.id}}`);

    if (fetchError) throw fetchError;

    if (unreadMessages && unreadMessages.length > 0) {
      // Mark as read using the read_by array approach
      const messageIds = unreadMessages.map(msg => msg.id);

      for (const messageId of messageIds) {
        await supabase.rpc('mark_message_read', {
          message_id: messageId,
          user_id: req.user.id
        });
      }
    }

    return res.status(200).json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error('markMessagesAsRead error', err);
    return res.status(500).json({ message: 'Failed to mark messages as read', error: err.message });
  }
};

export default {
  createMessage,
  getConversations,
  getMessages,
  markMessagesAsRead,
};
