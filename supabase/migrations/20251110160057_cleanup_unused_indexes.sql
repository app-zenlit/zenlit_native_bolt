/*
  # Cleanup Unused Indexes and Create Optimized Ones

  ## Summary
  Removes unused indexes and creates new indexes optimized for actual query patterns.

  ## Changes
  1. Remove 8 unused indexes
  2. Create 4 new optimized indexes aligned with application queries

  ## Removed Indexes
  - Messages: 4 unused indexes
  - Feedback: 2 unused indexes
  - Profiles: 1 unused index
  - Locations: 1 unused index

  ## New Optimized Indexes
  - Messages: conversation queries and unread counts
  - Profiles: username lookup
  - Locations: proximity queries
*/

-- ============================================================================
-- PART 1: Remove unused indexes
-- ============================================================================

-- Messages table: Remove unused indexes
DROP INDEX IF EXISTS public.idx_messages_sender_created;
DROP INDEX IF EXISTS public.idx_messages_receiver_created;
DROP INDEX IF EXISTS public.idx_messages_conversation_pair;
DROP INDEX IF EXISTS public.idx_messages_unread;

-- Feedback table: Remove unused indexes
DROP INDEX IF EXISTS public.feedback_user_id_idx;
DROP INDEX IF EXISTS public.feedback_created_at_idx;

-- Profiles table: Remove unused indexes
DROP INDEX IF EXISTS public.idx_profiles_email;

-- Locations table: Remove unused indexes
DROP INDEX IF EXISTS public.idx_locations_updated_at;

-- ============================================================================
-- PART 2: Create optimized indexes for actual query patterns
-- ============================================================================

-- Messages: Optimize for conversation queries (getMessagesBetweenUsers)
-- This index supports: WHERE (sender_id=X AND receiver_id=Y) OR (sender_id=Y AND receiver_id=X)
-- ORDER BY created_at DESC with pagination
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages (sender_id, receiver_id, created_at DESC);

-- Also create reverse for efficient OR queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created_reverse
  ON public.messages (receiver_id, sender_id, created_at DESC);

-- Messages: Optimize for unread counts (get_unread_message_counts RPC)
-- Partial index only for unread messages
CREATE INDEX IF NOT EXISTS idx_messages_unread_counts
  ON public.messages (receiver_id, sender_id)
  WHERE read_at IS NULL;

-- Profiles: Optimize for username lookup (used in profile search/validation)
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower
  ON public.profiles (LOWER(user_name))
  WHERE user_name IS NOT NULL;

-- Locations: Optimize for proximity queries (getNearbyUsers)
-- Composite index for lat/long range queries
CREATE INDEX IF NOT EXISTS idx_locations_proximity
  ON public.locations (lat_short, long_short)
  WHERE lat_short IS NOT NULL AND long_short IS NOT NULL;

-- ============================================================================
-- PART 3: Add helpful comments
-- ============================================================================

COMMENT ON INDEX idx_messages_conversation_created IS
  'Optimized for fetching conversation history between two users, ordered by time descending';

COMMENT ON INDEX idx_messages_conversation_created_reverse IS
  'Reverse composite to support OR queries in both directions efficiently';

COMMENT ON INDEX idx_messages_unread_counts IS
  'Partial index for fast unread message count calculations';

COMMENT ON INDEX idx_profiles_username_lower IS
  'Case-insensitive username lookup for profile search and validation';

COMMENT ON INDEX idx_locations_proximity IS
  'Composite index for efficient proximity-based user discovery within range';
