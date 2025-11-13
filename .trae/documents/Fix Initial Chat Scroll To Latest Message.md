## Problem Summary
- Clicking a conversation opens `app/messages/[id].tsx` but the list shows the first (oldest) message instead of the latest.
- Root cause: the initial "scroll to bottom" depends on `contentHeightRef.current > 0`, but the effect that performs the scroll only re-runs when `state.messages.length` or `loading` changes. When the list’s content height is set later by `onContentSizeChange`, the effect doesn’t re-run, so the initial scroll never happens and the user lands at the top.

## Files To Update
- `app/messages/[id].tsx` (FlatList and scroll logic)

## Implementation Steps
### 1) Perform initial scroll inside `onContentSizeChange`
- In the existing `onContentSizeChange` handler (lines ~767–779), after updating `contentHeightRef.current`, add a one-time initial scroll to bottom when:
  - `!initialScrollDoneRef.current`
  - `state.messages.length > 0`
  - `!loading`
- Set the same flags used elsewhere to avoid repeated scrolling:
  - `programmaticScrollRef.current = true`
  - `listRef.current?.scrollToEnd({ animated: false })`
  - `initialScrollDoneRef.current = true`
  - `hasMountedRef.current = true`
  - `isAtBottomRef.current = true`
  - Reset `programmaticScrollRef.current` after a short timeout
- Keep current prepend handling (maintain position after loading older messages) intact.

### 2) Simplify/guard the existing initial scroll effect
- Optionally keep the existing effect as a secondary safety net (lines ~345–374). It can remain, but with the new `onContentSizeChange` trigger, the first scroll will be reliably executed.
- Ensure no double-run: the new early exit via `initialScrollDoneRef.current` prevents redundant scrolling.

### 3) Verification
- Open a thread with historical messages (e.g., messages on Jan 1 and Jan 10). Clicking the thread should land at the latest message.
- Send a new message: auto-scroll remains to bottom (`scrollToEnd` after optimistic append).
- Pull to load older messages: position is preserved via the existing prepend offset logic.
- Check read-marking behavior: when arriving at bottom, the code marks messages as read (`markThreadRead`) only once and remains correct.

## Rollback/Alternative
- If needed, consider `initialScrollIndex={data.length - 1}` with `getItemLayout` for fixed-height rows; however, due to variable heights and dividers, the `onContentSizeChange` approach is safer.

## Expected Outcome
- Opening any conversation shows the latest message immediately, resolving the current UX issue of landing at the oldest message.

## What I Will Change
- Add a one-time initial scroll in `onContentSizeChange` and set the appropriate refs/flags.
- Keep all existing behaviors (typing indicator, read marking, prepend offset preservation) unaffected.