import { Stack, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, ArrowRight, ExternalLink, Lock, RotateCw, Share2, ShieldAlert } from 'lucide-react-native';
import { type ComponentType, type Ref, useMemo, useRef, useState } from 'react';
import { Linking, Share, StyleSheet, View } from 'react-native';
import { WebView, type WebViewNavigation, type WebViewProps } from 'react-native-webview';

import { safeHttpUrl } from '../lib/parse/sanitize';
import { EmptyState, IconButton, T } from '../ui/components/primitives';
import { hostOf } from '../ui/format';
import { space, useTheme } from '../ui/theme';

interface WebViewHandle { goBack(): void; goForward(): void; reload(): void }
// The platform WebView forwards a ref with these imperative methods.
const WV = WebView as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewHandle> }>;

/**
 * Restricted in-app browser for original articles and advisories.
 * - Only https:// navigation; every other scheme (file:, content:, intent:,
 *   javascript:, data:, custom app schemes) is blocked.
 * - No file or content-provider access, no mixed content, no pop-up windows,
 *   no persistent cookies/storage (incognito), no JS bridge into the app.
 */
export default function Browser() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const c = useTheme();
  const ref = useRef<WebViewHandle>(null);
  const start = useMemo(() => safeHttpUrl(typeof url === 'string' ? url : null), [url]);
  const [nav, setNav] = useState<{ url: string; title: string; back: boolean; fwd: boolean }>({ url: start ?? '', title: '', back: false, fwd: false });
  const [progress, setProgress] = useState(0);
  const [blocked, setBlocked] = useState<string | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  if (!start) return <EmptyState icon={ShieldAlert} title="Link blocked" body="Only secure https:// links can be opened." />;

  const onNav = (n: WebViewNavigation) => setNav({ url: n.url, title: n.title, back: n.canGoBack, fwd: n.canGoForward });

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: hostOf(nav.url || start) }} />
      <View style={[styles.addr, { backgroundColor: c.surface, borderColor: c.border }]}>
        <Lock size={13} color={c.ok} />
        <T variant="tiny" numberOfLines={1} style={{ flex: 1 }}>{nav.url || start}</T>
      </View>
      {progress > 0 && progress < 1 ? <View style={{ height: 2, width: `${progress * 100}%`, backgroundColor: c.accent }} /> : null}
      {blocked ? (
        <View style={[styles.note, { backgroundColor: c.warn + '1A' }]}>
          <ShieldAlert size={14} color={c.warn} />
          <T variant="tiny" style={{ flex: 1 }}>Blocked a non-HTTPS navigation to {blocked.slice(0, 80)}</T>
        </View>
      ) : null}
      {failed ? (
        <EmptyState icon={ShieldAlert} title="Page could not be loaded" body={`${failed}. Check your connection, or open it in your default browser.`} />
      ) : (
        <WV
          ref={ref}
          source={{ uri: start }}
          originWhitelist={['https://*']}
          javaScriptEnabled
          domStorageEnabled={false}
          incognito
          thirdPartyCookiesEnabled={false}
          allowFileAccess={false}
          allowFileAccessFromFileURLs={false}
          allowUniversalAccessFromFileURLs={false}
          allowsLinkPreview={false}
          mixedContentMode="never"
          setSupportMultipleWindows={false}
          javaScriptCanOpenWindowsAutomatically={false}
          geolocationEnabled={false}
          mediaPlaybackRequiresUserAction
          allowsProtectedMedia={false}
          saveFormDataDisabled
          textZoom={100}
          onNavigationStateChange={onNav}
          onLoadProgress={(e) => setProgress(e.nativeEvent.progress)}
          onError={(e) => setFailed(e.nativeEvent.description || 'Network error')}
          onShouldStartLoadWithRequest={(req) => {
            if (req.url.startsWith('https://') || req.url === 'about:blank') return true;
            setBlocked(req.url);
            return false;
          }}
          style={{ backgroundColor: c.bg }}
        />
      )}
      <View style={[styles.bar, { backgroundColor: c.surface, borderColor: c.border }]}>
        <IconButton icon={ArrowLeft} label="Back" color={nav.back ? c.text : c.textFaint} onPress={() => nav.back && ref.current?.goBack()} />
        <IconButton icon={ArrowRight} label="Forward" color={nav.fwd ? c.text : c.textFaint} onPress={() => nav.fwd && ref.current?.goForward()} />
        <IconButton icon={RotateCw} label="Reload" color={c.text} onPress={() => { setFailed(null); ref.current?.reload(); }} />
        <View style={{ flex: 1 }} />
        <IconButton icon={Share2} label="Share" color={c.text} onPress={() => Share.share({ message: nav.url || start })} />
        <IconButton icon={ExternalLink} label="Open in default browser" color={c.text} onPress={() => { const u = safeHttpUrl(nav.url || start); if (u) Linking.openURL(u); }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  addr: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 6 },
  bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.sm, paddingVertical: 4, borderTopWidth: StyleSheet.hairlineWidth },
});
