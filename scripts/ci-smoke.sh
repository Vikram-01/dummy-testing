#!/usr/bin/env bash
# Installs the APK on the CI emulator, launches it, lets the first sync run,
# and captures screenshots + logcat. Writes ci-logs/RESULT (PASS or CRASH).
set -u
PKG=com.vigil.securityintel
mkdir -p ci-logs
adb wait-for-device
adb shell settings put global window_animation_scale 0
adb install -r -g vigil-1.0.1.apk > ci-logs/install.txt 2>&1
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
# Visit every main screen through deep links (vigil://...) and check it survives.
if [ "$crashed" = 0 ]; then
  for route in news cves critical kev threat-intel research appsec cloud supply-chain bookmarks search sync settings; do
    adb shell am start -W -a android.intent.action.VIEW -d "vigil://$route" "$PKG" > /dev/null 2>&1
    sleep 6
    adb exec-out screencap -p > "ci-logs/route-$route.png" 2>/dev/null || true
    if ! adb shell pidof "$PKG" > /dev/null 2>&1; then echo "Crashed on route $route"; echo "$route" > ci-logs/CRASH_ROUTE; crashed=1; break; fi
  done
  # Open a stored CVE detail page if the sync produced one.
  adb shell am start -W -a android.intent.action.VIEW -d "vigil://cve/CVE-2021-44228" "$PKG" > /dev/null 2>&1
  sleep 10
  adb exec-out screencap -p > ci-logs/route-cve-detail.png 2>/dev/null || true
  adb shell pidof "$PKG" > /dev/null 2>&1 || { echo "Crashed on CVE detail"; echo cve-detail > ci-logs/CRASH_ROUTE; crashed=1; }
  adb shell am start -W -a android.intent.action.VIEW -d "vigil://" "$PKG" > /dev/null 2>&1
  sleep 5
  adb exec-out screencap -p > ci-logs/route-overview-final.png 2>/dev/null || true
fi
adb logcat -d -v time > ci-logs/logcat-full.txt 2>&1 || true
grep -E "AndroidRuntime|ReactNativeJS|ReactNative|FATAL|Fatal signal|DEBUG  |libc  |Expo|expo|SQLite|vigil|$PKG" ci-logs/logcat-full.txt > ci-logs/logcat-app.txt || true
if grep -qE "FATAL EXCEPTION|Fatal signal|JavascriptException|Unhandled JS Exception" ci-logs/logcat-full.txt; then crashed=1; fi
if [ "$crashed" = 1 ]; then echo CRASH > ci-logs/RESULT; else echo PASS > ci-logs/RESULT; fi
cat ci-logs/RESULT
grep -E -A40 "FATAL EXCEPTION|Fatal signal|JavascriptException|Unhandled JS Exception" ci-logs/logcat-full.txt | head -120 || true
exit 0
