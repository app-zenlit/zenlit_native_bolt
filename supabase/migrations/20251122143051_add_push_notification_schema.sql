/*
  # Push Notification System Setup

  1. Profile Extensions
    - Add `expo_push_token` (text, nullable) - Stores Expo push notification token
    - Add `notification_enabled` (boolean, default true) - Master notification toggle
    - Add `notification_preferences` (jsonb) - Granular notification settings
    - Add `last_token_update` (timestamptz) - Token registration timestamp

  2. New Tables
    - `push_notifications` - Log all sent notifications
      - `id` (uuid, primary key)
      - `user_id` (uuid, foreign key to profiles)
      - `notification_type` (text) - Type: message, proximity, app_update, system
      - `title` (text) - Notification title
      - `body` (text) - Notification body
      - `data` (jsonb) - Additional data payload
      - `sent_at` (timestamptz) - When notification was sent
      - `delivered` (boolean) - Whether Expo confirmed delivery
      - `error` (text, nullable) - Error message if failed
    
    - `app_versions` - Track app versions for update notifications
      - `id` (uuid, primary key)
      - `version` (text, unique) - Version number (e.g., "1.0.0")
      - `build_number` (integer) - Build number
      - `platform` (text) - Platform: ios, android, all
      - `is_critical` (boolean) - Force update required
      - `min_required_version` (text) - Minimum version users must have
      - `release_notes` (text) - What's new in this version
      - `download_url` (text, nullable) - Direct download link
      - `released_at` (timestamptz) - Release timestamp
    
    - `user_app_updates` - Track which users have been notified about updates
      - `user_id` (uuid, foreign key to profiles)
      - `version_id` (uuid, foreign key to app_versions)
      - `notified_at` (timestamptz) - When user was notified
      - `dismissed_at` (timestamptz, nullable) - When user dismissed notification
      - `updated_at` (timestamptz, nullable) - When user actually updated
      - Primary key (user_id, version_id)

  3. Security
    - Enable RLS on all new tables
    - Users can only view their own notification logs
    - Users can only update their own notification preferences
    - App versions are publicly readable
    - Only admins can insert app versions (via service role)

  4. Indexes
    - Index on profiles.expo_push_token for lookups
    - Index on push_notifications.user_id for user history
    - Index on push_notifications.sent_at for time-based queries
    - Index on app_versions.platform and version for filtering

  5. Important Notes
    - Notification preferences stored as JSONB for flexibility
    - Push token can be null (user hasn't granted permission)
    - Notification log helps track delivery issues
    - App version system supports platform-specific updates
*/

-- Add push notification columns to profiles table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'expo_push_token'
  ) THEN
    ALTER TABLE profiles ADD COLUMN expo_push_token TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'notification_enabled'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_enabled BOOLEAN DEFAULT true;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'notification_preferences'
  ) THEN
    ALTER TABLE profiles ADD COLUMN notification_preferences JSONB DEFAULT jsonb_build_object(
      'messages', true,
      'proximity', true,
      'app_updates', true,
      'system', true,
      'quiet_hours_enabled', false,
      'quiet_hours_start', '22:00',
      'quiet_hours_end', '08:00',
      'muted_conversations', '[]'::jsonb
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'last_token_update'
  ) THEN
    ALTER TABLE profiles ADD COLUMN last_token_update TIMESTAMPTZ;
  END IF;
END $$;

-- Create push_notifications log table
CREATE TABLE IF NOT EXISTS push_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL CHECK (notification_type IN ('message', 'proximity', 'app_update', 'system')),
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  sent_at TIMESTAMPTZ DEFAULT now(),
  delivered BOOLEAN DEFAULT false,
  error TEXT,
  CONSTRAINT push_notifications_user_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Create app_versions table
CREATE TABLE IF NOT EXISTS app_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  version TEXT NOT NULL UNIQUE,
  build_number INTEGER NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'all')),
  is_critical BOOLEAN DEFAULT false,
  min_required_version TEXT,
  release_notes TEXT,
  download_url TEXT,
  released_at TIMESTAMPTZ DEFAULT now()
);

-- Create user_app_updates tracking table
CREATE TABLE IF NOT EXISTS user_app_updates (
  user_id UUID NOT NULL,
  version_id UUID NOT NULL,
  notified_at TIMESTAMPTZ DEFAULT now(),
  dismissed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  CONSTRAINT user_app_updates_pkey PRIMARY KEY (user_id, version_id),
  CONSTRAINT user_app_updates_user_fkey FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
  CONSTRAINT user_app_updates_version_fkey FOREIGN KEY (version_id) REFERENCES app_versions(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token 
  ON profiles(expo_push_token) WHERE expo_push_token IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_notification_enabled 
  ON profiles(notification_enabled) WHERE notification_enabled = true;

CREATE INDEX IF NOT EXISTS idx_push_notifications_user_id 
  ON push_notifications(user_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_push_notifications_type 
  ON push_notifications(notification_type, sent_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_versions_platform 
  ON app_versions(platform, released_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_app_updates_user 
  ON user_app_updates(user_id, notified_at DESC);

-- Enable Row Level Security
ALTER TABLE push_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_app_updates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for push_notifications
CREATE POLICY "Users can view own notification history"
  ON push_notifications
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- RLS Policies for app_versions (public read)
CREATE POLICY "Anyone can view app versions"
  ON app_versions
  FOR SELECT
  TO authenticated
  USING (true);

-- RLS Policies for user_app_updates
CREATE POLICY "Users can view own update history"
  ON user_app_updates
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own update tracking"
  ON user_app_updates
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own update tracking"
  ON user_app_updates
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Update existing RLS policies for profiles to allow token updates
CREATE POLICY "Users can update own notification settings"
  ON profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);