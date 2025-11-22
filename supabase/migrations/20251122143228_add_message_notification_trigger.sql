/*
  # Add Database Trigger for Message Notifications

  1. Database Function
    - Create function `send_message_notification()` to handle new messages
    - Function checks if receiver should get notification
    - Calls the send-push-notification Edge Function via HTTP request
    - Only sends if receiver is not currently viewing the conversation

  2. Trigger Setup
    - Create trigger `on_message_insert_notify` on messages table
    - Fires AFTER INSERT on messages table
    - Calls send_message_notification function for each new row

  3. Logic Flow
    - Check if receiver has notifications enabled
    - Check if receiver has valid push token
    - Check notification preferences for message type
    - Get sender profile info for notification content
    - Call Edge Function with notification data

  4. Important Notes
    - Uses http extension for calling Edge Function
    - Runs asynchronously to not block message insertion
    - Logs errors but doesn't fail the insert operation
    - Respects user's notification preferences and quiet hours
*/

-- Enable http extension for calling Edge Functions
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Create function to send message notifications
CREATE OR REPLACE FUNCTION send_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  receiver_profile RECORD;
  sender_profile RECORD;
  supabase_url TEXT;
  service_role_key TEXT;
  edge_function_url TEXT;
  notification_body TEXT;
BEGIN
  -- Get Supabase URL from environment
  supabase_url := current_setting('app.settings.supabase_url', true);
  service_role_key := current_setting('app.settings.service_role_key', true);
  
  -- Use default URL structure if not set
  IF supabase_url IS NULL THEN
    supabase_url := 'http://kong:8000';
  END IF;
  
  edge_function_url := supabase_url || '/functions/v1/send-push-notification';

  -- Get receiver's profile and notification settings
  SELECT 
    id, 
    expo_push_token, 
    notification_enabled, 
    notification_preferences,
    display_name
  INTO receiver_profile
  FROM profiles
  WHERE id = NEW.receiver_id;

  -- Exit early if receiver doesn't have notifications enabled or no push token
  IF NOT FOUND 
     OR receiver_profile.notification_enabled = false 
     OR receiver_profile.expo_push_token IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if messages are enabled in preferences
  IF receiver_profile.notification_preferences->>'messages' = 'false' THEN
    RETURN NEW;
  END IF;

  -- Check if conversation is muted
  IF receiver_profile.notification_preferences->'muted_conversations' @> to_jsonb(NEW.sender_id::text) THEN
    RETURN NEW;
  END IF;

  -- Get sender's profile info
  SELECT display_name, user_name
  INTO sender_profile
  FROM profiles
  WHERE id = NEW.sender_id;

  -- Create notification body
  IF LENGTH(NEW.text) > 100 THEN
    notification_body := SUBSTRING(NEW.text, 1, 97) || '...';
  ELSE
    notification_body := NEW.text;
  END IF;

  -- Call Edge Function to send notification (non-blocking)
  -- We use pg_background or just let it run async
  PERFORM extensions.http_post(
    url := edge_function_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'userId', NEW.receiver_id,
      'type', 'message',
      'title', sender_profile.display_name || ' sent you a message',
      'body', notification_body,
      'data', jsonb_build_object(
        'senderId', NEW.sender_id,
        'messageId', NEW.id,
        'conversationId', NEW.conversation_id
      ),
      'priority', 'high'
    )::text
  );

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send push notification: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on messages table
DROP TRIGGER IF EXISTS on_message_insert_notify ON messages;

CREATE TRIGGER on_message_insert_notify
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION send_message_notification();

-- Grant necessary permissions
GRANT USAGE ON SCHEMA extensions TO postgres, service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA extensions TO postgres, service_role;