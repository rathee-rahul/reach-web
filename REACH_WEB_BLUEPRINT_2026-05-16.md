# REACH Web App Blueprint

Last updated: 2026-05-16

This file is a handoff document for continuing the REACH web app in a new Codex/Claude chat. It explains what exists, how it is wired, what has been deployed, and what still needs attention.

## Project Summary

REACH Web is a static browser version of the Android REACH messaging app. It is designed to look and behave close to the Android app, while keeping device-only features visible but locked when they cannot be safely supported on web/iOS yet.

Main goals:

- Same REACH ID login/signup flow as Android.
- Android-like UI, icon-first controls, simple mobile-first screens.
- Supabase Edge Functions for backend actions.
- Browser local cache for saved chat messages, similar in purpose to Android local SQLite.
- App-only features should still be visible, but tapping them should explain that they are available in the REACH Android app.

## Repo And URLs

Local folder:

```txt
C:\Users\Dell\Downloads\reach\reach-web
```

GitHub repo:

```txt
https://github.com/rathee-rahul/reach-web.git
```

Live site:

```txt
https://rathee-rahul.github.io/reach-web/
```

Recommended live test URL after latest cache updates:

```txt
https://rathee-rahul.github.io/reach-web/index.html?v=10
```

Local preview server used during development:

```powershell
cd C:\Users\Dell\Downloads\reach\reach-web
python -m http.server 8766 --bind 127.0.0.1
```

Local preview URL:

```txt
http://127.0.0.1:8766/index.html?v=10&preview=1#chats
```

Important: `preview=1` only works on `localhost` or `127.0.0.1`. It does not work on the live GitHub Pages URL.

## Technology

- Plain static HTML/CSS/JavaScript.
- No build step.
- GitHub Pages hosting.
- Supabase Edge Functions for API calls.
- Supabase Realtime for chat updates.
- IndexedDB for local browser message/chat-list cache.
- `localStorage` for session, profile, and simple account data.

## Main Files

```txt
index.html
style.css
js/api.js
js/auth.js
js/localCache.js
js/realtime.js
js/router.js
js/utils.js
js/viewport.js
components/avatar.js
components/bottomNav.js
components/downloadModal.js
components/toast.js
screens/landing.js
screens/chats.js
screens/chat.js
screens/contacts.js
screens/requests.js
screens/groups.js
screens/profile.js
```

## App Loading Order

`index.html` loads scripts in this order:

1. Supabase JS CDN
2. `js/viewport.js`
3. `js/api.js`
4. `js/utils.js`
5. `js/localCache.js`
6. `js/auth.js`
7. `js/realtime.js`
8. components
9. screens
10. `js/router.js`

The order matters. `localCache.js` depends on `Utils.normalizeMessage`, so it must load after `utils.js`.

## Routing

Routing is hash-based and handled in:

```txt
js/router.js
```

Current routes:

```txt
#landing
#login
#create
#vid-ready
#chats
#chat/:id/:name/:vid
#requests
#contacts
#groups
#group/:id/:name
#profile
#settings
#blocked
```

If user is not logged in, router sends them to `#landing`, except in local preview mode.

## Supabase Project

Active Supabase project ref:

```txt
eqocgylkivhkyqeqggff
```

Supabase URL used by web:

```txt
https://eqocgylkivhkyqeqggff.supabase.co
```

The public anon/publishable key is stored in:

```txt
js/api.js
```

## Edge Function API Layer

All web API calls go through:

```txt
js/api.js
```

The helper:

```js
callFunction(name, body)
```

calls:

```txt
https://eqocgylkivhkyqeqggff.supabase.co/functions/v1/<function-name>
```

Headers include:

```txt
apikey: SUPABASE_ANON_KEY
Authorization: Bearer SUPABASE_ANON_KEY
Content-Type: application/json
```

Several functions had to be deployed with `--no-verify-jwt` because this web app uses custom session tokens, not Supabase Auth JWTs.

Known deployed commands already used:

```powershell
npx supabase functions deploy login --no-verify-jwt --project-ref eqocgylkivhkyqeqggff
npx supabase functions deploy generate-vid --no-verify-jwt --project-ref eqocgylkivhkyqeqggff
npx supabase functions deploy update-profile --no-verify-jwt --project-ref eqocgylkivhkyqeqggff
```

If any other action says `Invalid JWT`, deploy that function the same way:

```powershell
cd C:\Users\Dell\Downloads\reach
npx supabase functions deploy FUNCTION_NAME --no-verify-jwt --project-ref eqocgylkivhkyqeqggff
```

## Current API Methods

Defined in `js/api.js`:

```txt
generateVid
login
deleteAccount
findContact
sendRequest
listContacts
setContactName
listRequests
respondRequest
listMessages
sendMessage
markSeen
editMessage
deleteMessage
listGroups
listGroupMessages
getGroupInfo
getContactPresence
touchLastSeen
setOffline
setTyping
getTyping
getPrivacySettings
updatePrivacySettings
requestEmailVerification
verifyRecoveryEmail
blockUser
reportUser
listBlockedUsers
unblockUser
updateProfileName
updateProfilePhoto
```

## Auth And Session Storage

Handled in:

```txt
js/auth.js
```

`localStorage` keys:

```txt
reach_session_token
reach_vid
reach_display_name
reach_avatar_id
reach_profile_photo
reach_recovery_email
```

Important fix already made:

- Login returns account data nested under `user` plus top-level `session_token`.
- `Auth.saveAccount()` now normalizes both shapes.
- This fixed sent messages appearing on the left because VID was blank or wrong.

If a user still sees old behavior, ask them to sign out and sign in again so localStorage is refreshed.

## Local Hybrid Message Cache

Implemented in:

```txt
js/localCache.js
```

Storage:

```txt
IndexedDB database: reach_web_cache
Object store: chat_messages
Object store: chat_lists
```

Message cache behavior:

- Personal chat opens and first reads cached messages from IndexedDB.
- Cached messages render immediately if present.
- Then the app fetches latest messages from Supabase.
- Fresh messages are saved back to IndexedDB.
- If server/network fails, cached messages remain visible and a toast says saved messages are being shown.

Chat list cache behavior:

- Chats screen reads cached contact/chat list first.
- Then it fetches the latest list from Supabase.
- Fresh list is saved back to IndexedDB.
- If server/network fails, cached list remains visible.

Cache separation:

```txt
owner REACH ID + chat ID
```

This prevents two different REACH accounts in the same browser from mixing cached messages.

Current message cache limit:

```txt
300 messages per chat
```

Important limitation:

- Browser cache is per browser/device.
- It can be removed if user clears browser data, uses private browsing, or changes browser/phone.
- Supabase remains the source of truth.

## Screens

### Landing / Signup / Login

File:

```txt
screens/landing.js
```

Current design:

- Android-like white/green REACH landing screen.
- Signup includes display name, DOB, gender, password, optional recovery email.
- Google button uses a multicolor Google-style `G`.
- Google sign-in is still a visible app-style option, but the exact auth flow is not fully implemented as real Google OAuth in web yet.

### Chats

File:

```txt
screens/chats.js
```

Current behavior:

- Header title `Chats`.
- Plus icon opens Contacts/New Chat.
- Android download banner shown for app-only features.
- Reads cached chat list first, then refreshes from Supabase.
- Displays avatar/photo, name, latest message, time, unread badge.

### Personal Chat

File:

```txt
screens/chat.js
```

Current behavior:

- Header with back icon, contact name, presence/last seen, more menu.
- Messages render as incoming/outgoing bubbles.
- Sent message status:
  - one tick = sent
  - two ticks = delivered
  - blue two ticks = seen
- Time is inside bubble meta.
- Tap bubble opens action sheet:
  - Copy
  - Info
  - Edit
  - Delete for Everyone
  - Delete for Me
- Chat reads IndexedDB cache first, then Supabase.
- Send input has text field and send icon only.
- Mic/voice note icon removed because voice notes are not provided yet.

Presence behavior:

- Polls `get-contact-presence`.
- Shows `Online` or `Last seen <date> <time>`.

Typing behavior:

- Calls `set-chat-typing`.
- Typing label is below message area, not in header.

### Contacts

File:

```txt
screens/contacts.js
```

Current behavior:

- Contact list screen.
- Plus icon opens Add Contact flow.
- Add Contact does not use a back button because Android app screen did not have it.
- Search by VID and send request.

### Requests

File:

```txt
screens/requests.js
```

Current behavior:

- Android-style incoming request screen.
- Accept and decline actions.
- Uses `list-requests` and `respond-request`.

### Groups

File:

```txt
screens/groups.js
```

Current state:

- Placeholder/basic screen.
- Group feature is not fully built on web yet.

### Profile

File:

```txt
screens/profile.js
```

Current behavior:

- Shows avatar/photo, display name, REACH ID.
- Copy REACH ID icon.
- Edit display name from web.
- Change profile photo from web.
- Profile photo is compressed/resized in browser before upload.
- Recovery email add/verify flow.
- Privacy & Security row.
- Blocked Users row.
- App Lock row.
- Sign Out.

Profile update backend:

- New function source added at:

```txt
C:\Users\Dell\Downloads\reach\supabase\functions\update-profile\index.ts
```

- Already deployed with:

```powershell
npx supabase functions deploy update-profile --no-verify-jwt --project-ref eqocgylkivhkyqeqggff
```

Photo upload:

- Existing function:

```txt
supabase/functions/update-profile-photo/index.ts
```

- Web API now sends `profile_photo`, not the old wrong `photo_base64` field.

### Privacy & Security

Route:

```txt
#settings
```

Current behavior:

- Shows locked rows:
  - Read Receipts: On
  - Last Seen: On
  - Direct Messages: On
  - App Lock: On
- Tapping locked rows shows:

```txt
This can be changed using REACH Android app. Not available for iOS at present.
```

Reason:

- User wanted these visible and on, but not changeable from web/iOS at present.

### Blocked Users

Route:

```txt
#blocked
```

Current behavior:

- Attempts to show blocked list.
- Management actions are locked.
- Tapping locked action shows Android-app-only message.

## UI Rules We Have Been Following

- Match Android app more than generic web style.
- Use icons instead of text labels where possible.
- No big marketing landing page when user expects app UI.
- Use mobile-first layout.
- Avoid app-only hidden features. Show them locked with explanation.
- Keep profile/privacy features visible even if web cannot change them.
- Chat header and footer should remain stable.
- New messages should affect message area, not flash the whole screen.

## Mobile And Safari/iOS Support

Already added:

- `viewport-fit=cover`
- safe-area-aware CSS
- `100svh` / `100dvh` support
- `js/viewport.js`
- 16px inputs to avoid iOS zoom
- touch-friendly button sizes
- Android and Safari browser support target

## Deployment Workflow

For web file changes:

```powershell
cd C:\Users\Dell\Downloads\reach\reach-web
git status --short
git add .
git commit -m "Your commit message"
git push
```

Live site usually updates in 1-3 minutes.

For cache busting after JS/CSS changes:

- Update query version in `index.html`, for example `?v=10` to `?v=11`.
- Test with the matching URL:

```txt
https://rathee-rahul.github.io/reach-web/index.html?v=11
```

## Recent Git Commits

```txt
70adace Add web local message cache
bd9ddf8 Compress web profile photos
1fec8dd Lock web profile settings
53bc26c Fix web account session parsing
b00771f Improve Google sign-in button icon
d8a4094 Tune landing page to match Android
7c4fe92 Initial REACH web app
```

## Verification Commands

Syntax-check JS:

```powershell
cd C:\Users\Dell\Downloads\reach
node --check reach-web\js\api.js
node --check reach-web\js\utils.js
node --check reach-web\js\localCache.js
node --check reach-web\screens\chats.js
node --check reach-web\screens\chat.js
node --check reach-web\screens\profile.js
```

Local preview:

```powershell
cd C:\Users\Dell\Downloads\reach\reach-web
python -m http.server 8766 --bind 127.0.0.1
```

Open:

```txt
http://127.0.0.1:8766/index.html?v=10&preview=1#chats
```

## Known Caveats

- Web cache is not encrypted at rest by the app. It is normal browser IndexedDB storage.
- Browser storage can be cleared by the user/browser.
- Push notification badge on app icon is Android/native territory, not supported in static web in the same way.
- Google sign-in UI exists, but true Google OAuth integration still needs final product decision and setup.
- Groups web screen is not complete.
- Some app-only controls intentionally show a lock prompt instead of changing settings.
- If an Edge Function returns `Invalid JWT`, deploy it with `--no-verify-jwt`.

## Recommended Next Steps

1. Add a visible "Saved on this device" or subtle offline status indicator when cached messages are being shown.
2. Build real Google OAuth for web, or mark Google button as coming soon if not ready.
3. Finish Groups web screen using existing group Edge Functions.
4. Add media upload/view support to web chat if needed.
5. Add a cache cleanup policy in `localCache.js`, for example delete old chats after 30 days or keep only last N chats.
6. Add encrypted local cache later if privacy requirements demand it.
7. Add web notification support separately using browser Notification API and service worker, but do not expect native Android badge behavior on every browser.

## Quick Mental Model

Supabase is the server source of truth.

Android uses SQLite for local saved messages.

Web now uses IndexedDB for local saved messages.

On web chat open:

```txt
IndexedDB cache -> render instantly -> Supabase fetch -> save fresh copy -> render updated messages
```

On web chats screen:

```txt
IndexedDB chat list -> render instantly -> Supabase contacts fetch -> save fresh list -> render updated list
```

This gives the web app the same practical feeling as Android local storage while still keeping Supabase as the real sync backend.
