# TODO: Tauri Desktop Notifications

## Current State
- Web app: Browser Notification API implemented (messages, calls, participant joins)
- Tauri desktop: NOT YET IMPLEMENTED

## What to implement for Tauri
1. Use `tauri-plugin-notification` for native macOS notifications
2. Hook into the same WS events that trigger browser notifications
3. Events to notify:
   - New message in channel/DM (when not focused on that channel)
   - Call started in a channel
   - Participant joined a call
4. Badge the dock icon with unread count
5. Play system notification sound

## Dependencies needed
- `tauri-plugin-notification = "2"` in `src-tauri/Cargo.toml`
- `.plugin(tauri_plugin_notification::init())` in main.rs
- Frontend: `@tauri-apps/plugin-notification` npm package

## Notes
- Browser notifications already skip when the window is focused (`document.hasFocus()`)
- Tauri should do the same — only notify when window is not focused
- APNs push notifications (for Swift native app) are a separate system
