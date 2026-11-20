# Katalog — Native Android (Kotlin + Jetpack Compose)

Native Android rewrite of **Katalog** built from the ground up in **Kotlin**, **Jetpack Compose**, and **Material 3 Expressive** for Salwar Kameez garment manufacturing & inventory management.

## Architecture & Libraries
- **UI**: Jetpack Compose + Material 3 Expressive shapes, Atelier Bronze (`Ochre`) / Indigo / Sage / Slate palettes, Android 12+ Dynamic Color, edge-to-edge layout.
- **Offline Vault**: Room SQLite (`KatalogDatabase`) + Coil 120 MB disk cache + WorkManager (`CatalogueSyncWorker`) with `NetworkType.CONNECTED` auto-sync.
- **Photo Studio**: AndroidX `PickVisualMedia` + `ExifInterface` + native `Bitmap`/`Canvas`/`Matrix`/`ColorMatrix` crop, rotate, straighten, flip, and 6 color filters with EXIF-stripped JPEG export.
- **Auth & Cloud Sync**: Firebase Authentication (Email/Password + Credential Manager Google Sign-In) & Cloud Firestore targeting database `ai-studio-8d492067-6c5f-46b3-a770-4c2331446180`, strictly matching `firestore.rules`.
- **Salwar Kameez Domain**:
  - Full-page **Design Details** screen with per-size stock steppers & separate INR (`₹`) pricing, outsourced **Karigar & Craft Stages** ("Last Given To" + handover log), and **Raw Materials & Fabric** specifications.
  - **Batch Selection Mode** in the Catalogue (Grid & List views) with Select All / Deselect All, **Update Status**, and inline-confirmed **Delete Selected**.

## Build an Installable `.apk` in Android Studio
1. Open the `android-kotlin/` folder in **Android Studio (Ladybug / Meerkat or newer)** with JDK 17.
2. *(Optional for Firebase cloud sync — app runs immediately offline without this)*: Download `google-services.json` for package `com.katalog.atelier` from Firebase Console (project `gen-lang-client-0754574675`) and place it in `android-kotlin/app/google-services.json`. The Gradle script detects it automatically.
3. Let Gradle sync, then build your debug APK:
   - **Android Studio**: **Build → Build Bundle(s) / APK(s) → Build APK(s)**
   - **CLI**: `./gradlew assembleDebug` (or `gradle assembleDebug`)
4. Install `app/build/outputs/apk/debug/app-debug.apk` on your Android device.
