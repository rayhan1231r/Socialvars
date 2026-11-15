# SocialVerse — Firebase Setup, Cloud Functions, & Android Build Guide

## 1. Provisioned Firebase Project
- **Project ID**: `socialvars`
- **Package ID**: `Com.social.vrs`
- **Firestore Database ID**: `ai-studio-socialvars-97ff1f90-9f9c-4f3f-9c56-da1a6eacb55e`

## 2. Firebase Console Configuration
1. **Authentication**:
   - Enable **Email/Password** provider and customize Email Verification & Password Reset templates if using Firebase Auth directly on Android.
2. **Android App Registration**:
   - `android/app/google-services.json` is configured for `Com.social.vrs` under Firebase project `socialvars`.
3. **App Check**:
   - Enable **Play Integrity** in Firebase App Check for `Com.social.vrs`.
4. **Security Rules Deployment**:
   ```bash
   firebase deploy --only firestore:rules,storage
   ```
5. **Cloud Functions & Gemini Secret**:
   ```bash
   cd functions
   npm install
   firebase functions:secrets:set GEMINI_API_KEY
   npm run deploy
   ```
   All endpoints on `socialverseApi` enforce Firebase ID Token verification (`Authorization: Bearer <token>`), keeping `GEMINI_API_KEY` strictly server-side.

## 3. Release-Ready APK / AAB Build Instructions
1. Create `android/keystore.properties`:
   ```properties
   storeFile=../release-keystore.jks
   storePassword=YOUR_STORE_PASSWORD
   keyAlias=socialverse
   keyPassword=YOUR_KEY_PASSWORD
   ```
2. Build release APK & App Bundle:
   ```bash
   cd android
   ./gradlew clean assembleRelease bundleRelease
   ```
   - Signed Release APK: `android/app/build/outputs/apk/release/app-release.apk`
   - Play Store App Bundle: `android/app/build/outputs/bundle/release/app-release.aab`
