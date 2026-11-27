# Pedigree Android Wrapper (`android-wrapper/`) — Thin Hybrid Shell ONLY

> **CRITICAL ARCHITECTURE RULE — READ BEFORE TOUCHING ANYTHING:**
> **This folder is ONLY a thin native AndroidX `WebView` container. The core application / site / PWA is—and MUST ALWAYS remain—the React + Vite + TypeScript application in `/src/` (booted from `/index.html`).**

## Why Kotlin Exists in This Repository (Hybrid Situation)

`AskKim/Pedigree` uses a **hybrid packaging architecture**:
1. **Core PWA (`/src/`, `/index.html`, `/vite.config.ts`, `/package.json`) — MANDATORY REACT:**
   - All UI screens, routing, pedigree trees, Wright COI calculations, coat color genetics, SQLite/OPFS storage, importers, exporters, and print/PDF generators live in **React + Vite + TypeScript**.
   - **NEVER convert, rewrite, or recode the core PWA into Kotlin, Android Views, or Jetpack Compose.**
   - Even if a GitHub import or upgrade breaks bootability or `npm run lint` / `vite build`, the fix belongs in `/src/`, `/index.html`, or `/vite.config.ts`—**NOT** by replacing the React PWA with Kotlin.
2. **Android Wrapper (`/android-wrapper/`) — THIN WEBVIEW SHELL ONLY:**
   - Written in Kotlin using AndroidX (`AppCompatActivity`, `WebViewAssetLoader`, `WebViewCompat`, `CustomTabsIntent`, `PrintManager`).
   - Serves the compiled React production bundle (`npm run build -- --base=/` -> `dist/` -> `android-wrapper/app/src/main/assets/www/`) offline at `https://appassets.androidplatform.net/`.
   - Provides narrow native device bridges (`window.pedigreeNative` <-> `src/native/pedigreeBridge.ts`) for Android back navigation, SAF file picker/share, native printing (`PrintBridge.kt`), external link handoff, and backup vault mirroring.
   - Contains **zero** app screens, genetics engines, or SQLite data models.

## Build Relationship

```bash
# Step 1: Build the mandatory React + Vite + TypeScript PWA
npm run build -- --base=/

# Step 2: Copy dist/ into the Android wrapper's offline WebView assets
rm -rf android-wrapper/app/src/main/assets/www
mkdir -p android-wrapper/app/src/main/assets/www
cp -R dist/. android-wrapper/app/src/main/assets/www/

# Step 3: Stage dist/ into the WebView asset root (keeps .gitkeep; fails if dist/ is missing)
./android-wrapper/scripts/stage-web-assets.sh

# Step 4: Package the thin Android APK shell (the wrapper pins Gradle 8.13)
cd android-wrapper && ./gradlew assembleDebug --no-daemon
```

`npm run verify:android` statically checks the wrapper files, Gradle/CI version agreement, release version
alignment, manifest security flags, asset staging guards and dependency policy without needing the SDK.

## Build toolchain

A real APK build needs **JDK 17 plus the Android SDK** (platform 36, build-tools, platform-tools), roughly
3–4 GB installed. CI does exactly that on every push to `main` via `actions/setup-java` and the runner's
preinstalled SDK (`gradle assembleDebug` / `assembleRelease`).

Without that toolchain you can still:

- run `npm run verify:android` for the static gate, and
- trigger the real APK build remotely: `node scripts/android-build-remote.mjs --ref main` (needs a
  `GH_TOKEN` with `actions:write`), or `gh workflow run build-android-apk.yml`.
