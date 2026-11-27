/**
 * @license
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Static Android wrapper gate (`npm run verify:android`).
 *
 * Compiling an APK needs JDK 17 plus the Android SDK (see android-wrapper/README.md).
 * Everything that can be verified without that toolchain is checked here, so a broken
 * wrapper, a drifting version or an unstageable asset tree fails on any machine and in
 * `npm run verify`:
 *   - Gradle wrapper completeness and version pinning (wrapper files + CI agreement)
 *   - Release version alignment across package.json, version.json, gradle.properties and app/build.gradle.kts
 *   - Manifest security flags (cleartext off, backup off, exported launcher, scoped FileProvider)
 *   - WebView asset staging guards (assets/www/.gitkeep, syncWebAssets, preBuild hook)
 *   - Minimal dependency policy (no Firebase/GMS/Capacitor/analytics SDKs)
 *   - Native bridge name agreement between gradle.properties and src/native/pedigreeBridge.ts
 */

import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const WRAPPER = path.join(ROOT, 'android-wrapper');

const failures: string[] = [];
const passes: string[] = [];

function rel(absPath: string): string {
  return path.relative(ROOT, absPath).split(path.sep).join('/');
}

function read(relPath: string): string | null {
  try {
    return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
  } catch {
    return null;
  }
}

function check(label: string, probe: () => string | null): void {
  const failure = probe();
  if (failure) failures.push(`${label} — ${failure}`);
  else passes.push(label);
}

function missingFile(relPath: string): string | null {
  return fs.existsSync(path.join(ROOT, relPath)) ? null : `missing ${relPath}`;
}

function containsIn(relPath: string, needle: string, expectation: string): string | null {
  const content = read(relPath);
  if (content === null) return `missing ${relPath}`;
  return content.includes(needle) ? null : `${relPath} must contain ${expectation}`;
}

const GRADLE_PROPERTIES = 'android-wrapper/gradle.properties';
const APP_GRADLE = 'android-wrapper/app/build.gradle.kts';
const MANIFEST = 'android-wrapper/app/src/main/AndroidManifest.xml';

check('Gradle wrapper is complete', () => {
  for (const file of [
    'android-wrapper/gradlew',
    'android-wrapper/gradlew.bat',
    'android-wrapper/gradle/wrapper/gradle-wrapper.jar',
    'android-wrapper/gradle/wrapper/gradle-wrapper.properties',
  ]) {
    const failure = missingFile(file);
    if (failure) return failure;
  }
  return null;
});

check('Gradle wrapper jar is a valid archive', () => {
  try {
    const jar = fs.readFileSync(path.join(WRAPPER, 'gradle/wrapper/gradle-wrapper.jar'));
    if (jar.length < 1024) return 'gradle-wrapper.jar is implausibly small';
    return jar[0] === 0x50 && jar[1] === 0x4b ? null : 'gradle-wrapper.jar is not a ZIP/JAR archive';
  } catch {
    return 'gradle-wrapper.jar is unreadable';
  }
});

check('Gradle wrapper pins 8.13', () =>
  containsIn(
    'android-wrapper/gradle/wrapper/gradle-wrapper.properties',
    'gradle-8.13-bin.zip',
    'the gradle-8.13-bin.zip distribution'
  )
);

check('CI pins the same Gradle version', () =>
  containsIn('.github/workflows/build-android-apk.yml', 'gradle-version: "8.13"', 'gradle-version: "8.13"')
);

check('Release version is aligned across manifests', () => {
  const pkgText = read('package.json');
  const versionJsonText = read('public/version.json');
  const gradlePropsText = read(GRADLE_PROPERTIES);
  const appGradleText = read(APP_GRADLE);
  if (!pkgText || !versionJsonText || !gradlePropsText || !appGradleText) {
    return 'one of package.json, public/version.json, gradle.properties, app/build.gradle.kts is unreadable';
  }
  const pkgVersion = (JSON.parse(pkgText) as { version?: string }).version;
  const versionJson = (JSON.parse(versionJsonText) as { appVersion?: string }).appVersion;
  const propsVersion = gradlePropsText.match(/^pedigree\.wrapper\.versionName=(.+)$/m)?.[1]?.trim();
  const gradleVersion = appGradleText.match(/versionName = "([^"]+)"/)?.[1];
  const versions = { pkgVersion, versionJson, propsVersion, gradleVersion };
  const unique = new Set(Object.values(versions).filter((value) => typeof value === 'string' && value.length > 0));
  if (unique.size !== 1) return `mismatched versions ${JSON.stringify(versions)}`;
  return null;
});

check('Manifest keeps cleartext traffic disabled', () =>
  containsIn(MANIFEST, 'android:usesCleartextTraffic="false"', 'android:usesCleartextTraffic="false"')
);

check('Manifest keeps Auto Backup disabled', () =>
  containsIn(MANIFEST, 'android:allowBackup="false"', 'android:allowBackup="false"')
);

check('Manifest exposes exactly one exported launcher activity', () => {
  const manifest = read(MANIFEST);
  if (manifest === null) return `missing ${MANIFEST}`;
  const exportedActivities = manifest.match(/<activity[\s\S]*?android:exported="true"[\s\S]*?>/g) ?? [];
  if (exportedActivities.length !== 1) return `expected 1 exported activity, found ${exportedActivities.length}`;
  return exportedActivities[0].includes('android:name=".MainActivity"')
    ? null
    : 'the exported activity must be .MainActivity';
});

check('FileProvider is scoped to the application id', () =>
  containsIn(MANIFEST, 'android:authorities="${applicationId}.fileprovider"', 'authorities="${applicationId}.fileprovider"')
);

check('Manifest requests only the INTERNET permission', () => {
  const manifest = read(MANIFEST);
  if (manifest === null) return `missing ${MANIFEST}`;
  const permissions = manifest.match(/<uses-permission[^>]*android:name="([^"]+)"/g) ?? [];
  const names = permissions
    .map((entry) => entry.match(/android:name="([^"]+)"/)?.[1])
    .filter((name): name is string => Boolean(name));
  if (names.length === 0) return 'no uses-permission declared (INTERNET is required for the virtual asset origin)';
  const unexpected = names.filter((name) => name !== 'android.permission.INTERNET');
  return unexpected.length === 0 ? null : `unexpected permissions: ${unexpected.join(', ')}`;
});

check('SDK levels are pinned', () => {
  const gradle = read(APP_GRADLE);
  if (gradle === null) return `missing ${APP_GRADLE}`;
  for (const needle of ['compileSdk = 36', 'minSdk = 26', 'targetSdk = 36']) {
    if (!gradle.includes(needle)) return `${APP_GRADLE} must contain ${needle}`;
  }
  return null;
});

check('WebView assets are stageable', () => {
  const keep = missingFile('android-wrapper/app/src/main/assets/www/.gitkeep');
  if (keep) return `${keep} (the asset root must exist after a clone)`;
  const script = missingFile('android-wrapper/scripts/stage-web-assets.sh');
  if (script) return script;
  return containsIn(APP_GRADLE, 'syncWebAssets', 'a syncWebAssets task that stages dist/');
});

check('Assembling without staged assets fails fast', () => {
  const gradle = read(APP_GRADLE);
  if (gradle === null) return `missing ${APP_GRADLE}`;
  const declaresGuard = gradle.includes('tasks.register("verifyWebAssets")');
  const wiresGuard = /tasks\.named\("preBuild"\)\s*\{\s*dependsOn\("verifyWebAssets"\)/.test(gradle);
  if (!declaresGuard) return 'app/build.gradle.kts must register a verifyWebAssets task';
  return wiresGuard ? null : 'preBuild must depend on verifyWebAssets';
});

check('Dependency policy stays minimal', () => {
  const forbidden = ['firebase', 'android.gms', 'capacitor', 'crashlytics', 'amplitude', 'mixpanel'];
  for (const relPath of ['android-wrapper/app/build.gradle.kts', 'android-wrapper/build.gradle.kts']) {
    const content = read(relPath);
    if (content === null) return `missing ${relPath}`;
    const stripped = content
      .split('\n')
      .filter((line) => !/^\s*(\/\/|\/\*|\*)/.test(line))
      .join('\n')
      .toLowerCase();
    const hit = forbidden.find((needle) => stripped.includes(needle));
    if (hit) return `${relPath} references forbidden dependency "${hit}"`;
  }
  return null;
});

check('Native bridge name matches the TypeScript contract', () => {
  const props = read(GRADLE_PROPERTIES);
  if (props === null) return `missing ${GRADLE_PROPERTIES}`;
  const bridgeName = props.match(/^pedigree\.wrapper\.bridgeObjectName=(.+)$/m)?.[1]?.trim();
  if (!bridgeName) return 'pedigree.wrapper.bridgeObjectName is not set';
  const bridgeTs = read('src/native/pedigreeBridge.ts');
  if (bridgeTs === null) return 'missing src/native/pedigreeBridge.ts';
  return bridgeTs.includes(bridgeName) ? null : `src/native/pedigreeBridge.ts never references "${bridgeName}"`;
});

check('README documents the wrapper build path', () => {
  const readme = read('android-wrapper/README.md');
  if (readme === null) return 'missing android-wrapper/README.md';
  if (!readme.includes('./gradlew')) return 'android-wrapper/README.md must document ./gradlew';
  return readme.includes('stage-web-assets.sh') ? null : 'android-wrapper/README.md must document scripts/stage-web-assets.sh';
});

if (failures.length > 0) {
  console.error(`[verify:android] FAIL — ${failures.length} static wrapper check(s) failed:`);
  for (const failure of failures) console.error(`  - ${failure}`);
  console.error(
    '[verify:android] These checks do not build an APK; a real build needs JDK 17 + the Android SDK (see android-wrapper/README.md).'
  );
  process.exit(1);
}

console.log(`[verify:android] PASS — ${passes.length} static Android wrapper checks passed (no SDK required).`);
