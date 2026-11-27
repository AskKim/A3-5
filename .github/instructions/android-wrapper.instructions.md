---
applyTo: "android-wrapper/**"
---
- `android-wrapper/` is strictly a thin native Kotlin WebView shell serving the compiled React PWA (`dist/` -> `assets/www/`).
- Never recode the React PWA in Kotlin, and never add Google Play Services, Firebase, Capacitor, or analytics SDKs.
- Keep `versionName` in `android-wrapper/app/build.gradle.kts` synced with `package.json` and `public/version.json`.
