#!/usr/bin/env bash
# Installs the APK on the CI emulator, launches it, lets the first sync run,
# and captures screenshots + logcat. Writes ci-logs/RESULT (PASS or CRASH).
set -u
PKG=com.vigil.securityintel
mkdir -p ci-logs
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb install -r -g vigil-1.0.0.apk > ci-logs/install.txt 2>&1
cat ci-logs/install.txt
adb logcat -c
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
crashed=0
for t in 15 45 90 150; do
  sleep $(( t - ${prev:-0} )); prev=$t
  adb exec-out screencap -p > "ci-logs/screen-${t}s.png" 2>/dev/null || true
  if ! adb shell pidof "$PKG" > /dev/null 2>&1; then
    echo "App not running at ${t}s"; crashed=1; break
  fi
done
adb logcat -d -v time > ci-logs/logcat-full.txt 2>&1 || true
grep -E "AndroidRuntime|ReactNativeJS|ReactNative|FATAL|Fatal signal|DEBUG  |libc  |Expo|expo|SQLite|vigil|$PKG" ci-logs/logcat-full.txt > ci-logs/logcat-app.txt || true
if grep -qE "FATAL EXCEPTION|Fatal signal|JavascriptException|Unhandled JS Exception" ci-logs/logcat-full.txt; then crashed=1; fi
if [ "$crashed" = 1 ]; then echo CRASH > ci-logs/RESULT; else echo PASS > ci-logs/RESULT; fi
cat ci-logs/RESULT
grep -E -A40 "FATAL EXCEPTION|Fatal signal|JavascriptException|Unhandled JS Exception" ci-logs/logcat-full.txt | head -120 || true
exit 0
