# Push Notifications Implementation Guide

This document describes the complete push notification system implemented in Zenlit, including setup, architecture, and usage.

---

## Overview

Zenlit uses **Expo Push Notification Service** to send notifications to users on both iOS and Android platforms. The system is fully integrated with Supabase and requires **no Firebase configuration** on your end.

### Key Features

✅ Message notifications when users receive new messages
✅ App update notifications for new versions
✅ Proximity notifications (ready to implement)
✅ Granular user preferences and quiet hours
✅ Automatic token management and registration
✅ Database triggers for real-time notifications
✅ Web platform gracefully handled (no notifications)

---

## Architecture

### Components

1. **Client Side**
   - `useNotifications` hook - Manages token registration and permissions
   - Notification handler in `app/_layout.tsx` - Routes users to correct screen
   - Notification settings screen - User preferences UI

2. **Backend**
   - Supabase Edge Function: `send-push-notification` - Sends notifications via Expo API
   - Database triggers - Automatically sends notifications on message insert
   - Database schema - Tracks tokens, preferences, notification history

3. **Database Tables**
   - `profiles` - Extended with push token and preferences columns
   - `push_notifications` - Logs all sent notifications
   - `app_versions` - Tracks app version releases
   - `user_app_updates` - Tracks which users have been notified about updates

---

## Setup Instructions

### 1. Install Dependencies

Already installed:
```bash
npm install expo-notifications expo-device
```

### 2. Configure Environment Variables

The following environment variables are **automatically configured** in Supabase:

- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key for backend operations
- `EXPO_ACCESS_TOKEN` - Your Expo push notification access token

**Important:** You need to set `EXPO_ACCESS_TOKEN` in your Supabase project settings:

1. Go to https://expo.dev/accounts/[your-account]/settings/access-tokens
2. Create a new access token
3. In Supabase Dashboard:
   - Go to Project Settings → Edge Functions → Secrets
   - Add `EXPO_ACCESS_TOKEN` with your token value

### 3. Database Migration

The database schema has been automatically created with the following migration:
- `add_push_notification_schema.sql` - Adds all required tables and columns
- `add_message_notification_trigger.sql` - Creates automatic notification triggers

### 4. Build the App

For push notifications to work, you must create a **development build** (not Expo Go):

```bash
# Create development build
eas build --profile development --platform ios
eas build --profile development --platform android

# Or run locally with expo-dev-client
npx expo run:ios
npx expo run:android
```

**Note:** Push notifications do NOT work in Expo Go or web browsers.

---

## Usage

### Client Side - Getting Started

The notification system is automatically initialized in the app root layout. No additional setup required!

```typescript
// The useNotifications hook is already integrated in app/_layout.tsx
const { expoPushToken, permissionStatus } = useNotifications();
```

### Sending Notifications Programmatically

You can send notifications from any authenticated context:

```typescript
import { supabase } from '../lib/supabase';

// Send notification to a single user
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/send-push-notification`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      userId: 'user-uuid-here',
      type: 'message',
      title: 'New Message',
      body: 'You have a new message from John',
      data: {
        senderId: 'sender-uuid',
        conversationId: 'conversation-uuid',
      },
      priority: 'high',
    }),
  }
);
```

### Sending to Multiple Users

```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/send-push-notification`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify({
      userIds: ['user-1-uuid', 'user-2-uuid', 'user-3-uuid'],
      type: 'system',
      title: 'Maintenance Notice',
      body: 'Zenlit will be under maintenance tonight',
      priority: 'default',
    }),
  }
);
```

---

## Notification Types

### 1. Message Notifications

**Automatically sent when:**
- A user receives a new message
- Recipient has notifications enabled
- Recipient is not currently viewing the conversation

**Handled by:**
- Database trigger on `messages` table
- Edge function `send-push-notification`

### 2. App Update Notifications

**Sent when:**
- A new version is released
- Admin creates entry in `app_versions` table
- Can be critical (forced) or optional

**Usage:**
```typescript
import { sendAppUpdateNotificationToAllUsers } from '../services/appVersionService';

// After creating a new app_versions record
await sendAppUpdateNotificationToAllUsers(versionId);
```

### 3. Proximity Notifications (Ready to Implement)

**To implement:**
1. Add logic in your radar/location update code
2. Call the edge function with `type: 'proximity'`
3. Users will be routed to `/radar` when tapped

### 4. System Notifications

**Use for:**
- Maintenance announcements
- Terms of service updates
- Security alerts
- Feature announcements

---

## User Preferences

Users can control their notification settings at `/notification-settings`:

### Available Settings

- **Master Toggle** - Enable/disable all notifications
- **Message Notifications** - New message alerts
- **Nearby Users** - Proximity alerts on Radar
- **App Updates** - Version and feature announcements
- **System Notifications** - Important announcements
- **Quiet Hours** - Silence notifications during specified times

### Accessing Preferences

```typescript
import { supabase } from '../lib/supabase';

// Get user's notification preferences
const { data } = await supabase
  .from('profiles')
  .select('notification_enabled, notification_preferences')
  .eq('id', userId)
  .single();

// Update preferences
await supabase
  .from('profiles')
  .update({
    notification_preferences: {
      messages: true,
      proximity: false,
      quiet_hours_enabled: true,
      quiet_hours_start: '22:00',
      quiet_hours_end: '08:00',
    }
  })
  .eq('id', userId);
```

---

## Testing

### Testing on Physical Devices

1. **Build the app:**
   ```bash
   eas build --profile development --platform ios
   # or
   eas build --profile development --platform android
   ```

2. **Install on device**

3. **Grant notification permissions** when prompted

4. **Send a test notification:**
   ```bash
   # Using curl
   curl -X POST \
     https://your-project.supabase.co/functions/v1/send-push-notification \
     -H "Authorization: Bearer YOUR_ANON_KEY" \
     -H "Content-Type: application/json" \
     -d '{
       "userId": "your-user-uuid",
       "type": "system",
       "title": "Test Notification",
       "body": "This is a test notification",
       "priority": "high"
     }'
   ```

### Common Issues

**Problem:** "Permission not granted"
**Solution:** Check device settings → Zenlit → Notifications → Allow

**Problem:** "Must use physical device"
**Solution:** Simulators/emulators don't support push notifications

**Problem:** "No push token"
**Solution:** Restart the app to re-register the token

**Problem:** "Notifications not received"
**Solution:** Check the `push_notifications` table for error messages

---

## App Version Management

### Creating a New Version Entry

```sql
INSERT INTO app_versions (
  version,
  build_number,
  platform,
  is_critical,
  release_notes
) VALUES (
  '1.1.0',
  2,
  'all',
  false,
  'New features: Dark mode, improved performance, bug fixes'
);
```

### Sending Update Notifications

After creating the version entry, send notifications to all users:

```typescript
import { sendAppUpdateNotificationToAllUsers } from '../services/appVersionService';

const { success, sent } = await sendAppUpdateNotificationToAllUsers(versionId);
console.log(`Sent notifications to ${sent} users`);
```

### Update Modal

The app automatically checks for updates on:
- App startup (when user is authenticated)
- When app update notification is received

Users will see:
- Optional update modal (can dismiss)
- Critical update modal (cannot dismiss, must update)

---

## Security Considerations

### Row Level Security (RLS)

All notification tables have RLS enabled:

- Users can only view their own notification history
- Users can only update their own preferences
- App versions are publicly readable
- Only service role can insert app versions

### Token Security

- Push tokens are stored securely in the database
- Tokens are never exposed to unauthorized users
- Service role key is used for backend operations
- All API calls require authentication

### Privacy

- Users control which notification types they receive
- Quiet hours prevent notifications during sleep
- Muted conversations stop notifications from specific users
- Notification history is private to each user

---

## Monitoring and Logs

### View Notification History

```sql
-- Check recent notifications for a user
SELECT *
FROM push_notifications
WHERE user_id = 'user-uuid'
ORDER BY sent_at DESC
LIMIT 20;

-- Check failed notifications
SELECT *
FROM push_notifications
WHERE delivered = false
ORDER BY sent_at DESC;
```

### Check Delivery Rates

```sql
-- Get delivery statistics
SELECT
  notification_type,
  COUNT(*) as total,
  SUM(CASE WHEN delivered THEN 1 ELSE 0 END) as delivered,
  ROUND(100.0 * SUM(CASE WHEN delivered THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM push_notifications
GROUP BY notification_type;
```

---

## Best Practices

### Do's

✅ Always check if user has notifications enabled before sending
✅ Respect user's quiet hours and preferences
✅ Use appropriate priority levels (high for urgent, default for others)
✅ Include meaningful data payloads for navigation
✅ Test on physical devices before deploying
✅ Monitor delivery rates and errors

### Don'ts

❌ Don't send notifications to web users
❌ Don't spam users with too many notifications
❌ Don't ignore user preferences
❌ Don't send notifications without proper authentication
❌ Don't test on simulators/emulators
❌ Don't use Expo Go for testing (use development builds)

---

## Troubleshooting

### No Notifications Received

1. Check if user granted permission
2. Verify expo_push_token is saved in database
3. Check notification_enabled is true
4. Verify notification_preferences allow that type
5. Check if quiet hours are enabled
6. Review push_notifications table for errors

### Token Not Registering

1. Ensure app is not running in Expo Go
2. Verify using physical device (not simulator)
3. Check network connection
4. Restart the app
5. Check console logs for errors

### Edge Function Errors

1. Verify EXPO_ACCESS_TOKEN is set in Supabase
2. Check Edge Function logs in Supabase Dashboard
3. Ensure database has http extension enabled
4. Verify service role key is correct

---

## Future Enhancements

### Planned Features

- [ ] Rich notifications with images
- [ ] Notification categories and grouping
- [ ] Scheduled notifications
- [ ] A/B testing for notification content
- [ ] Analytics dashboard for delivery metrics
- [ ] Custom notification sounds per type
- [ ] Notification action buttons

---

## Resources

- [Expo Push Notifications Documentation](https://docs.expo.dev/push-notifications/overview/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Expo Push Tool](https://expo.dev/notifications) - Test notification delivery
- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)

---

## Support

If you encounter issues with push notifications:

1. Check this documentation for common solutions
2. Review the Supabase Edge Function logs
3. Check the push_notifications table for error messages
4. Test with the Expo Push Tool
5. Verify all environment variables are set correctly

---

**Last Updated:** November 22, 2025
**Version:** 1.0.0
