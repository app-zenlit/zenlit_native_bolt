# Zenlit Project Overview

## 1. Introduction
**Zenlit** is a location-first networking app designed to help users discover and connect with real people nearby in real-time. The core principle is to prioritize people within a 1.5 km radius, ensuring consent, safety, and clarity.

## 2. Tech Stack
- **Frontend**: React Native with Expo (Managed Workflow)
- **Backend**: Supabase (Auth, Database, Storage, Realtime)
- **Routing**: Expo Router (File-based routing in `app/` directory)
- **Styling**: Likely custom styles or utility-based (needs verification, but `src/styles` exists)
- **Language**: TypeScript

## 3. Core Features
- **Radar**: Discover nearby users (within 1.5km).
- **Feed**: Browse posts from nearby users.
- **Create Post**: Share updates with the nearby feed.
- **Chat**: 1:1 conversations. Identity is revealed only when in range; otherwise, it switches to "Anonymous".
- **Profile**: User profiles with visibility controls.

## 4. Project Structure
- **`app/`**: Expo Router screens and navigation.
- **`src/`**: Core application logic.
  - **`components/`**: Reusable UI components.
  - **`contexts/`**: React Contexts (likely for Auth, etc.).
  - **`services/`**: API calls and backend interactions (Supabase).
  - **`lib/`**: Third-party library configurations (e.g., Supabase client).
  - **`types/`**: TypeScript type definitions.
  - **`utils/`**: Helper functions.
- **`supabase/`**: Supabase related configurations (migrations, etc.).

## 5. Current Status & Known Issues
- **Build Status**:
  - ✅ TypeScript compilation passes.
  - ✅ Native builds (Android/iOS via EAS) work.
  - ✅ Development server (`npm start`) works.
  - ⚠️ **Web Build Issue**: `npm run build` fails due to a Jimp/MIME error (Expo web bundler issue). This does not affect native apps.
- **Recent Changes**: Authentication fixes (OTP) have been implemented and verified.

## 6. Getting Started
### Prerequisites
- Node.js
- Expo CLI

### Installation
```bash
npm install
```

### Running the App
- **Development**: `npm start` (or `npm run android` / `npm run ios`)
- **Production Build (Native)**: `eas build --platform android --profile preview` (or ios)

## 7. Key Documentation
- `zenlit_app_vision.md`: Detailed product vision and UI/UX requirements.
- `BUILD_NOTES.md`: Latest build status and known issues.
