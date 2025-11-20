# Zenlit Messaging Feature Documentation

## 1. Overview
The messaging feature in Zenlit is designed to facilitate 1:1 conversations between users who have discovered each other via the Radar. It is deeply integrated with the location-first principle of the app, where proximity determines identity visibility.

## 2. Core UX Rules (from Vision)
- **Initiation**: New conversations can **ONLY** be started from the **Radar** user card. The Chat list does not support creating new threads.
- **Radius & Anonymity**:
  - **In Range (≤ 1.5 km)**: Real identity (Avatar, Name, Socials) is visible.
  - **Out of Range (> 1.5 km)**: Identity switches to **"Anonymous"**. Avatars and social links are hidden.
  - **Transitions**: Changes happen in real-time. If a user moves out of range during a chat, their identity updates to Anonymous immediately, but the **chat history persists**.
- **History**: Chat history is never deleted or altered based on location. Only the *current* identity presentation changes.

## 3. Architecture & Code Flow
### Key Components
- **Screens**:
  - `app/messages/index.tsx`: The Chat List.
  - `app/messages/[id].tsx`: The individual Chat Thread.
- **State Management**:
  - `src/contexts/MessagingContext.tsx`: Manages global messaging state, unread counts, and active threads.
- **Services**:
  - `src/services/messagingService.ts`: Handles Supabase DB interactions (fetch threads, send messages).
  - `src/services/locationDbService.ts`: Handles proximity checks to determine if a user is "in range" (and thus if they should be Anonymous).
- **Realtime**:
  - `src/utils/realtime.ts`: Manages Supabase Realtime subscriptions for new messages and presence.
  - `src/utils/chatRealtimeSetup.ts`: Helper for setting up chat-specific subscriptions.

### Data Flow
1. **Initiation**: User taps "Message" on a Radar card -> `messagingService` checks for existing thread or creates a new one -> Navigates to `app/messages/[id]`.
2. **Sending**: User sends text -> `messagingService.sendMessage` inserts into `messages` table -> Supabase triggers realtime event.
3. **Receiving**: `realtime.ts` listens for `INSERT` on `messages` -> Updates `MessagingContext` -> UI updates.
4. **Anonymity Check**:
   - The UI (or context) calls `locationDbService` to check distance.
   - If distance > 1.5km, the UI renders the "Anonymous" header and placeholder avatar.

## 4. Data Model (Supabase)
### `messages` Table
- `id`: UUID (PK)
- `sender_id`: UUID (FK to profiles)
- `receiver_id`: UUID (FK to profiles)
- `text`: Text content
- `created_at`, `delivered_at`, `read_at`: Timestamps

### Security (RLS)
- Users can **insert** messages where `sender_id` is their own auth UID.
- Users can **read** messages where they are either the sender or receiver.

## 5. Pitfalls & "Don'ts"
- **Never** leak identity (initials, cached avatar) when out of range.
- **Never** allow thread creation from the Chat List.
- **Never** delete history when switching to Anonymous.
- **Do not** show social links when Anonymous.
