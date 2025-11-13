# Supabase Backend Structure

## Schemas
- public

## Tables

### profiles
- Columns: id uuid default gen_random_uuid() not null; display_name text not null; user_name text not null; date_of_birth date null; gender text null; email text not null; account_created_at timestamptz default now() not null
- Primary Key: id
- Unique: email, user_name
- Indexes: idx_profiles_user_name; idx_profiles_username_lower (partial); profiles_email_key; profiles_pkey; profiles_user_name_key
- RLS Policies: Anonymous users can check username availability (read); Authenticated users can view all profiles (read); Users can create own profile (insert with check id = auth.uid()); Users can update own profile (update using/with check id = auth.uid())

### social_links
- Columns: id uuid not null; profile_pic_url text default 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png' null; banner_url text default 'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1200&q=60' null; bio text null; instagram text null; x_twitter text null; linkedin text null; created_at timestamptz default now() not null; updated_at timestamptz default now() not null
- Primary Key: id
- Foreign Keys: social_links.id → profiles.id
- Indexes: idx_social_links_id; social_links_pkey
- RLS Policies: Anyone can view social links (read); Users can create/update/delete own social links (insert/update/delete with id = auth.uid())

### posts
- Columns: id uuid default gen_random_uuid() not null; user_id uuid not null; content text not null; image_url text null; created_at timestamptz default now() not null; updated_at timestamptz default now() not null
- Primary Key: id
- Foreign Keys: posts.user_id → profiles.id
- Indexes: idx_posts_created_at; idx_posts_user_id; posts_pkey
- RLS Policies: Anyone can view posts (read); Users can create/update/delete own posts (insert/update/delete with user_id = auth.uid())

### feedback
- Columns: id uuid default gen_random_uuid() not null; user_id uuid not null; message text not null; image_url text null; created_at timestamptz default now() not null
- Primary Key: id
- Foreign Keys: feedback.user_id → profiles.id
- Indexes: feedback_pkey
- RLS Policies: Users can create their own feedback (insert with user_id = auth.uid()); Users can view their own feedback (read using user_id = auth.uid())

### locations
- Columns: id uuid not null; lat_full numeric null; long_full numeric null; lat_short numeric null; long_short numeric null; updated_at timestamptz default now() not null
- Primary Key: id
- Foreign Keys: locations.id → profiles.id
- Indexes: locations_pkey; idx_locations_short_coords; idx_locations_proximity (partial)
- RLS Policies: Users can insert/update own location (id = auth.uid()); Users can view nearby locations (read)

### messages
- Columns: id uuid default gen_random_uuid() not null; sender_id uuid not null; text text check length(trim(both from text)) > 0 not null; created_at timestamptz default now() null; delivered_at timestamptz null; read_at timestamptz null; receiver_id uuid not null
- Primary Key: id
- Foreign Keys: messages.sender_id → profiles.id; messages.receiver_id → profiles.id
- Indexes: messages_pkey; idx_messages_conversation_created; idx_messages_conversation_created_reverse; idx_messages_unread_counts (partial)
- Comment: Direct messages between users with realtime updates via postgres_changes
- RLS Policies: Users can send messages (insert with sender_id = auth.uid()); Users can update message status (update using/with check sender_id = auth.uid() OR receiver_id = auth.uid()); Users can view their own messages (read using sender_id = auth.uid() OR receiver_id = auth.uid())

## Functions (public)
- authorize_chat_channel(channel_name text, user_id uuid) returns boolean
- check_email_available(email_to_check text) returns boolean
- check_username_available(username_to_check text) returns boolean
- generate_username_suggestions(base_username text, max_suggestions int default) returns text[]
- get_unread_counts_direct() returns rows (peer_id uuid, unread_count int)
- get_unread_message_counts() returns rows (sender_id uuid, unread_count int)
- mark_direct_delivered(peer_id uuid) void
- mark_direct_read(peer_id uuid) void
- mark_messages_delivered(other_user_id uuid) void
- mark_messages_read(other_user_id uuid) void

## Extensions (installed)
- uuid-ossp 1.1
- pg_graphql 1.5.11
- pg_stat_statements 1.11
- pgcrypto 1.3
- supabase_vault 0.3.1
- plpgsql 1.0

## Notes
- All tables reside in schema public and have RLS enabled.
- Unique constraints exist on profiles.email and profiles.user_name.
- Conversation querying is optimized by compound indexes on messages.
