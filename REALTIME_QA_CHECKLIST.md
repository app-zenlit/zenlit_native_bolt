# Real-Time Messaging QA Checklist

## Implementation Summary

### Features Implemented

1. **Stable Realtime Subscription in Chat Thread**
   - ✅ Single Supabase Realtime channel per conversation
   - ✅ Filtered subscriptions: `(sender_id = otherUserId AND receiver_id = currentUserId) OR (sender_id = currentUserId AND receiver_id = otherUserId)`
   - ✅ Subscribe on focus, unsubscribe on blur using `useFocusEffect`
   - ✅ Event batching with 50ms debounce to prevent jank
   - ✅ Idempotent message upsert by ID
   - ✅ Maintains scroll position during pagination
   - ✅ "Stick to bottom" behavior for new messages
   - ✅ AppState listener for background/foreground transitions

2. **Incremental Chat List Updates**
   - ✅ Removed full-screen spinner on realtime events
   - ✅ Reducer-based state management for atomic updates
   - ✅ Upsert only affected conversation rows
   - ✅ Automatic resort by timestamp
   - ✅ Event batching with 100ms debounce
   - ✅ Full-screen spinner only on initial load or explicit refresh

3. **Pagination**
   - ✅ Loads 50 messages initially
   - ✅ Infinite scroll on pull-up for older messages
   - ✅ Filters with `created_at < oldestLoadedCreatedAt`
   - ✅ Maintains scroll anchor when prepending older messages
   - ✅ Loading indicator at top during pagination

4. **Realtime Helper Utility**
   - ✅ `RealtimeManager` class for channel management
   - ✅ Automatic retry with exponential backoff (max 4 retries)
   - ✅ Status change callbacks
   - ✅ Tagged logging for debugging (`RT:Thread`, `RT:List`)

5. **Anonymous Mode (Preserved)**
   - ✅ Shows "Anonymous" when users are > 1.5 km apart
   - ✅ Disables composer in anonymous mode
   - ✅ Hides profile avatar and navigation
   - ✅ Preserves continuous chat history
   - ✅ Automatically re-enables when back in range

## Acceptance Tests

### Test 1: Real-Time Message Delivery in Thread
**Goal:** Verify messages appear instantly without leaving the screen

**Steps:**
1. Open a chat thread with another user
2. Have the other user send a message
3. Verify the message appears within 1 second
4. Do not leave the screen or navigate away

**Expected Result:** ✅ Message appears in < 1s without any navigation

### Test 2: Chat List Updates While on Feed
**Goal:** Verify chat list updates without flicker when navigating from another screen

**Steps:**
1. Navigate to Feed screen
2. Have another user send you a message
3. Navigate to Messages screen
4. Verify the message is visible in the chat list

**Expected Result:** ✅ Message visible, no full-screen spinner, no flicker

### Test 3: New Conversation Appears Incrementally
**Goal:** Verify new conversations don't cause full-screen reload

**Steps:**
1. Be on Messages screen with existing conversations
2. Have a new user (never messaged before) send you a message
3. Observe the chat list update

**Expected Result:** ✅ New conversation row appears smoothly, no blank screen + spinner

### Test 4: Pagination Preserves Scroll Position
**Goal:** Verify infinite scroll loads older messages without jumping

**Steps:**
1. Open a chat with > 50 messages
2. Scroll to the top of the chat
3. Wait for pagination to trigger
4. Observe scroll position

**Expected Result:** ✅ Older messages load at top, scroll position stays anchored

### Test 5: Anonymous Mode Proximity Toggle
**Goal:** Verify anonymous mode works without breaking realtime

**Steps:**
1. Open a chat with a user within 1.5 km (normal mode)
2. Move > 1.5 km away (or simulate location change)
3. Verify chat switches to anonymous mode (name shows "Anonymous", composer disabled)
4. Have the other user send a message
5. Move back within 1.5 km
6. Verify chat switches back to normal mode

**Expected Result:**
- ✅ Anonymous mode activates correctly
- ✅ Messages still received in anonymous mode
- ✅ Normal mode restores when back in range
- ✅ Chat history preserved throughout

### Test 6: App Background/Foreground Transition
**Goal:** Verify realtime reconnects when app returns to foreground

**Steps:**
1. Open a chat thread
2. Minimize app (home button or app switcher)
3. Wait 5 seconds
4. Return to app
5. Have other user send a message
6. Verify message appears

**Expected Result:** ✅ Message appears within 1s, realtime reconnects automatically

### Test 7: Multiple Rapid Messages (Batching)
**Goal:** Verify event batching prevents jank

**Steps:**
1. Open a chat thread
2. Have other user send 5 messages rapidly (< 1 second apart)
3. Observe UI updates

**Expected Result:** ✅ All 5 messages appear smoothly, no visible lag or stuttering

### Test 8: Message Status Updates
**Goal:** Verify delivered_at and read_at updates work

**Steps:**
1. Send a message to another user
2. Observe message status (sent → delivered → read)
3. Verify status updates appear without refetching

**Expected Result:** ✅ Status updates from "sent" → "delivered" → "read" in real-time

## Console Logs to Monitor

When testing, watch for these console logs:

### Chat Thread (RT:Thread)
```
[RT:Thread] Screen focused
[RT:Thread] Setting up realtime subscription
[RT:Thread] Channel status changed: SUBSCRIBED
[RT:Thread] Received INSERT from other user
[RT:Thread] Processing N batched events
[RT:Thread] Loading older messages
[RT:Thread] App became active, resubscribing
[RT:Thread] Screen blurred
[RT:Thread] Cleaning up realtime subscription
```

### Chat List (RT:List)
```
[RT:List] Setting up message realtime subscription
[RT:List] Messages channel status: SUBSCRIBED
[RT:List] Setting up location realtime subscription
[RT:List] Location channel status: SUBSCRIBED
[RT:List] Processing N batched events
[RT:List] App became active, reloading threads
[RT:List] Cleaning up message subscription
[RT:List] Cleaning up location subscription
```

## Performance Metrics

### Chat Thread
- Initial load: < 2s
- Message insertion latency: < 100ms
- Pagination load: < 1s
- Scroll smoothness: 60 FPS

### Chat List
- Initial load: < 2s
- Incremental update latency: < 100ms
- No full-screen flicker on updates
- Smooth animations

## Known Limitations

1. **Binary File Issue:** ProfileAbout.tsx has compilation errors unrelated to messaging
2. **Web Platform:** Some React Native APIs may behave differently on web vs native
3. **Network Dependency:** Realtime features require stable internet connection
4. **Supabase Realtime:** Must be enabled on the messages and locations tables

## Technical Details

### Architecture

1. **State Management:**
   - Chat Thread: `useReducer` with `MessagesAction` types
   - Chat List: `useReducer` with `ThreadsAction` types
   - Idempotent updates using message/thread IDs

2. **Event Batching:**
   - Queue events in refs
   - Debounce with setTimeout (50ms thread, 100ms list)
   - Process batch atomically

3. **Realtime Channels:**
   - Thread: `chat-${otherUserId}` - scoped to one conversation
   - List: `messages-list-realtime` - listens to all user messages
   - Location: `messages-location-updates` - monitors proximity changes

4. **Retry Logic:**
   - Exponential backoff: 1s, 2s, 4s, 8s, 16s (max)
   - Max 4 retries before giving up
   - Logs all retry attempts

## Troubleshooting

### Messages Not Appearing in Real-Time
1. Check Supabase Realtime is enabled
2. Verify console shows `SUBSCRIBED` status
3. Check network tab for WebSocket connection
4. Look for `[RT:Thread]` logs showing received events

### Chat List Not Updating
1. Verify `[RT:List]` subscription logs
2. Check event batching is processing
3. Confirm reducer actions are dispatching

### Scroll Position Jumping
1. Check `prependingRef.current` logic
2. Verify `onContentSizeChange` calculations
3. Test with different message counts

### Anonymous Mode Issues
1. Verify location updates are triggering
2. Check `isUserNearby` function
3. Confirm 1.5 km distance calculation
4. Monitor location subscription logs
