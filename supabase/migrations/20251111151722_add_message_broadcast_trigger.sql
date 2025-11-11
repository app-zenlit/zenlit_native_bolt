/*
  # Real-Time Broadcast Trigger for Direct Messaging

  ## Summary
  Implements a database trigger to broadcast new message events to private user channels.
  This enables true real-time messaging using Supabase's broadcast feature instead of polling.

  ## Changes
  1. Creates `notify_new_message()` trigger function
     - Broadcasts to both sender and receiver private channels
     - Channel format: 'chat:{user_id}'
     - Payload includes all message fields for client consumption
  
  2. Attaches trigger to `messages` table
     - Fires AFTER INSERT for each new message
     - Automatically broadcasts to both participants

  ## Architecture
  - Uses broadcast for INSERT events (real-time message delivery)
  - postgres_changes still used for UPDATE events (status changes)
  - Private channels provide secure, scalable messaging
  - Event-driven architecture replaces database polling

  ## Security
  - Private channels require authentication via supabase.realtime.setAuth()
  - Channel authorization validated by Supabase Realtime service
  - Complements existing messages RLS policies
*/

-- ============================================================================
-- Step 1: Create the broadcast trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  payload json;
BEGIN
  -- Construct the payload with all message fields
  -- This matches the Message type expected by the client
  payload := json_build_object(
    'id', NEW.id,
    'sender_id', NEW.sender_id,
    'receiver_id', NEW.receiver_id,
    'text', NEW.text,
    'created_at', NEW.created_at,
    'delivered_at', NEW.delivered_at,
    'read_at', NEW.read_at
  );

  -- Broadcast to the receiver's private channel
  -- Format: 'chat:{receiver_id}'
  PERFORM pg_notify(
    'chat:' || NEW.receiver_id,
    payload::text
  );

  -- Broadcast to the sender's private channel
  -- This updates the sender's UI with confirmation
  PERFORM pg_notify(
    'chat:' || NEW.sender_id,
    payload::text
  );

  RETURN NEW;
END;
$$;

-- Add comment explaining the function
COMMENT ON FUNCTION public.notify_new_message() IS 
  'Broadcasts new message events to private user channels for real-time chat updates';

-- ============================================================================
-- Step 2: Attach the trigger to messages table
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_new_message ON public.messages;

-- Create the trigger
CREATE TRIGGER on_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

COMMENT ON TRIGGER on_new_message ON public.messages IS
  'Fires after message insert to broadcast to both sender and receiver channels';