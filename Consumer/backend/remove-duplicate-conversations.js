#!/usr/bin/env node

/**
 * Script to remove duplicate conversations
 *
 * This script identifies and removes duplicate conversations between the same users.
 * It keeps the oldest conversation and removes the newer duplicates.
 */

import { supabase } from './src/config/supabaseClient.js';

async function removeDuplicateConversations() {
  console.log('🔍 Finding duplicate conversations...\n');

  try {
    // Get all conversations
    const { data: conversations, error } = await supabase
      .from('conversations')
      .select('id, participants, created_at')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('❌ Error fetching conversations:', error.message);
      return;
    }

    if (!conversations || conversations.length === 0) {
      console.log('ℹ️ No conversations found.');
      return;
    }

    console.log(`📊 Found ${conversations.length} total conversations`);

    // Group conversations by their participant pairs
    const conversationGroups = new Map();

    conversations.forEach(conv => {
      if (!conv.participants || conv.participants.length !== 2) {
        console.log(`⚠️ Skipping conversation ${conv.id} - invalid participants:`, conv.participants);
        return;
      }

      // Sort participants to create a consistent key
      const participantKey = conv.participants.sort().join('-');

      if (!conversationGroups.has(participantKey)) {
        conversationGroups.set(participantKey, []);
      }

      conversationGroups.get(participantKey).push(conv);
    });

    console.log(`\n🔍 Found ${conversationGroups.size} unique participant pairs`);

    let totalDuplicates = 0;
    let conversationsToDelete = [];

    // Find duplicates for each participant pair
    for (const [participantKey, convs] of conversationGroups.entries()) {
      if (convs.length > 1) {
        console.log(`\n👥 Participant pair ${participantKey}:`);
        convs.forEach((conv, index) => {
          const marker = index === 0 ? '✅ KEEP' : '🗑️ DELETE';
          console.log(`  ${marker} ${conv.id} (created: ${conv.created_at})`);
        });

        // Keep the first (oldest) conversation, delete the rest
        const duplicates = convs.slice(1);
        conversationsToDelete.push(...duplicates);
        totalDuplicates += duplicates.length;
      }
    }

    if (conversationsToDelete.length === 0) {
      console.log('\n✅ No duplicate conversations found!');
      return;
    }

    console.log(`\n🗑️ Found ${totalDuplicates} duplicate conversations to remove`);

    // Confirm before deletion
    console.log('\n⚠️ This will permanently delete the duplicate conversations and all their messages.');
    console.log('Are you sure you want to continue? (This action cannot be undone)');

    // For safety, let's require explicit confirmation
    const shouldProceed = process.argv.includes('--confirm');

    if (!shouldProceed) {
      console.log('\n❌ Operation cancelled. Run with --confirm to proceed.');
      console.log('Example: node remove-duplicate-conversations.js --confirm');
      return;
    }

    console.log('\n🗑️ Deleting duplicate conversations...');

    // Delete conversations (this will cascade delete messages due to foreign key constraints)
    const { error: deleteError } = await supabase
      .from('conversations')
      .delete()
      .in('id', conversationsToDelete.map(conv => conv.id));

    if (deleteError) {
      console.error('❌ Error deleting conversations:', deleteError.message);
      return;
    }

    console.log(`✅ Successfully deleted ${conversationsToDelete.length} duplicate conversations`);

    // Also clean up any orphaned message_reads entries
    console.log('\n🧹 Cleaning up orphaned message_reads entries...');
    const { error: cleanupError } = await supabase.rpc('cleanup_orphaned_message_reads');

    if (cleanupError) {
      console.log('⚠️ Could not run cleanup function (this is optional):', cleanupError.message);
    } else {
      console.log('✅ Cleaned up orphaned message_reads entries');
    }

  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
  }
}

// Optional: Create a cleanup function for orphaned message_reads
async function createCleanupFunction() {
  console.log('🔧 Creating cleanup function for orphaned message_reads...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE OR REPLACE FUNCTION cleanup_orphaned_message_reads()
      RETURNS void
      LANGUAGE plpgsql
      AS $$
      BEGIN
        DELETE FROM message_reads
        WHERE message_id NOT IN (
          SELECT id FROM messages
        );
      END;
      $$;
    `
  });

  if (error) {
    console.log('⚠️ Could not create cleanup function:', error.message);
  } else {
    console.log('✅ Cleanup function created');
  }
}

async function main() {
  console.log('🚀 Remove Duplicate Conversations Script\n');

  // Create cleanup function first
  await createCleanupFunction();

  // Remove duplicates
  await removeDuplicateConversations();

  console.log('\n✨ Script completed!');
}

main().catch(console.error);