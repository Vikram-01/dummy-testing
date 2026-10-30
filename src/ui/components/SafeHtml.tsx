import { router } from 'expo-router';
import { useMemo } from 'react';
import { View } from 'react-native';
import { WebView } from 'react-native-webview';
import { escapeHtml, safeHttpUrl, sanitizeHtml } from '../../lib/parse/sanitize';
import { useTheme } from '../theme';

/**
 * Renders already-sanitized feed HTML in an isolated WebView:
 * JavaScript off, no file/content access, strict CSP (no scripts, no frames,
 * images over HTTPS only), and every link tap is intercepted and opened in
 * the restricted in-app browser instead of navigating this view.
 */
export function SafeHtml({ html, baseUrl, title, meta }: { html: string; baseUrl: string; title?: string; meta?: string }) {
  const c = useTheme();
  const doc = useMemo(() => {
    const body = sanitizeHtml(html, baseUrl); // defense in depth: sanitize again at render
    return `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https:; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'">
<style>
  html,body{margin:0;padding:0 16px 32px;background:${c.bg};color:${c.text};font:16px/1.6 -apple-system,Roboto,sans-serif;word-wrap:break-word}
  a{color:${c.accent}} img{max-width:100%;height:auto;border-radius:8px} figure{margin:12px 0}
  pre,code{background:${c.surfaceAlt};border-radius:6px;font-family:monospace;font-size:13px} pre{padding:10px;overflow-x:auto}
  blockquote{border-left:3px solid ${c.border};margin:12px 0;padding-left:12px;color:${c.textMuted}}
  table{border-collapse:collapse;display:block;overflow-x:auto} td,th{border:1px solid ${c.border};padding:4px 8px}
  h1,h2,h3{line-height:1.3} .vg-title{font-size:22px;margin:16px 0 4px} .vg-meta{color:${c.textMuted};font-size:13px;margin-bottom:16px}
</style><title>article</title></head><body>${title ? `<h1 class="vg-title">${escapeHtml(title)}</h1>` : ''}${meta ? `<div class="vg-meta">${escapeHtml(meta)}</div>` : ''}${body}</body></html>`;
  }, [html, baseUrl, c, title, meta]);

  return (
    <View style={{ flex: 1 }}>
      <WebView
        originWhitelist={['about:blank']}
        source={{ html: doc, baseUrl: 'about:blank' }}
        javaScriptEnabled={false}
        domStorageEnabled={false}
        allowFileAccess={false}
        allowFileAccessFromFileURLs={false}
        allowUniversalAccessFromFileURLs={false}
        allowsLinkPreview={false}
        mixedContentMode="never"
        setSupportMultipleWindows={false}
        incognito
        cacheEnabled={false}
        style={{ backgroundColor: c.bg }}
        onShouldStartLoadWithRequest={(req) => {
          if (req.url === 'about:blank' || req.url.startsWith('about:blank') || req.url.startsWith('data:text/html')) return true;
          const safe = safeHttpUrl(req.url);
          if (safe) router.push({ pathname: '/browser', params: { url: safe } });
          return false;
        }}
      />
    </View>
  );
}
