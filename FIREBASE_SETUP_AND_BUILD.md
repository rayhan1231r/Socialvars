# SocialVerse — Firebase Setup, Cloud Functions, & Android Build Guide

## 1. Provisioned Firebase Project
- **Project ID**: `ai-studio-applet-webapp-7613c`
- **Package ID**: `com.socialverse.app`
- **Firestore Database ID**: `ai-studio-92b9aeb2-4283-48a0-9fe4-8928b1dc1806`

## 2. Firebase Console Configuration
1. **Authentication**:
   - Enable **Google** sign-in provider and add your Android SHA-1 and SHA-256 fingerprints (`./gradlew signingReport`).
   - Enable **Email/Password** provider and customize the Email Verification & Password Reset templates.
2. **Android App Registration**:
   - Register `com.socialverse.app` in Firebase Project Settings.
   - Download `google-services.json` and place it at `android/app/google-services.json` (see `android/app/google-services.json.template`).
3. **App Check**:
   - Enable **Play Integrity** in Firebase App Check for `com.socialverse.app`.
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
