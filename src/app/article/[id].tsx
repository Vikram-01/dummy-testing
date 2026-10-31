import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Bookmark, BookmarkCheck, Bug, ExternalLink, Globe, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet, View } from 'react-native';
import { getArticle, markRead } from '../../lib/repo/articles';
import { toggleBookmark } from '../../lib/repo/library';
import type { ArticleRow } from '../../lib/repo/types';
import { useApp, useDb } from '../../ui/AppState';
import { Tag } from '../../ui/components/cards';
import { Button, Card, Chip, EmptyState, IconButton, Loading, T } from '../../ui/components/primitives';
import { SafeHtml } from '../../ui/components/SafeHtml';
import { fmtDate, hostOf } from '../../ui/format';
import { space, useTheme } from '../../ui/theme';

export default function ArticleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useDb();
  const c = useTheme();
  const { bump } = useApp();
  const [a, setA] = useState<ArticleRow | null | undefined>(undefined);

  const articleId = Number(id);
  const validId = Number.isInteger(articleId) && articleId > 0;

  const load = useCallback(async () => {
    const n = Number(id);
    if (!Number.isInteger(n) || n <= 0) return;
    const row = await getArticle(db, n);
    setA(row);
    if (row && !row.read_at) await markRead(db, n);
  }, [db, id]);
  useEffect(() => {
    // Data loads asynchronously; state is only set after the query resolves.
    (async () => {
      await load();
    })();
  }, [load]);

  if (!validId) return <EmptyState title="Article not found" body="This link does not point to a stored article." />;
  if (a === undefined) return <Loading />;
  if (!a) return <EmptyState title="Article not available" body="It may have been removed by the retention window." />;

  const openOriginal = () => router.push({ pathname: '/browser', params: { url: a.url } });
  const meta = `${a.source_name} · ${fmtDate(a.published_at, true)}${a.author ? ` · ${a.author}` : ''}`;
  const cves = a.cve_ids ? a.cve_ids.split(',') : [];

  const actions = (
    <View style={[styles.bar, { backgroundColor: c.surfaceContainer, borderColor: 'transparent' }]}>
      <View style={{ flex: 1 }}><Button label="Read original" icon={Globe} onPress={openOriginal} /></View>
      <IconButton icon={a.bookmarked ? BookmarkCheck : Bookmark} color={a.bookmarked ? c.accent : c.text} label={a.bookmarked ? 'Remove bookmark' : 'Bookmark'} onPress={async () => { await toggleBookmark(db, 'article', String(a.id)); await load(); bump(); }} />
      <IconButton icon={Share2} color={c.text} label="Share" onPress={() => Share.share({ message: `${a.title}\n${a.url}`, url: a.url })} />
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <Stack.Screen options={{ title: a.source_name }} />
      {cves.length ? (
        <View style={[styles.cveRow, { borderColor: c.outlineVariant }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: space.md }}>
            {cves.map((v) => <Chip key={v} label={v} icon={Bug} color={c.warn} active onPress={() => router.push(`/cve/${v}`)} />)}
          </ScrollView>
        </View>
      ) : null}
      {a.content_html ? (
        <SafeHtml html={a.content_html} baseUrl={a.url} title={a.title} meta={meta} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: space.lg, gap: space.md }}>
          <T variant="h1">{a.title}</T>
          <T variant="small">{meta}</T>
          <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
            {a.categories.split('|').filter(Boolean).map((cat) => <Tag key={cat} label={cat} />)}
          </View>
          {a.summary ? <T variant="body" style={{ fontSize: 16, lineHeight: 25 }}>{a.summary}</T> : null}
          <Card style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }} onPress={openOriginal}>
            <ExternalLink size={16} color={c.accent} />
            <T variant="small" style={{ flex: 1 }}>
              {a.source_name} publishes a summary in its feed. Open the full article from {hostOf(a.url)} in the in-app browser.
            </T>
          </Card>
        </ScrollView>
      )}
      {actions}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderTopWidth: StyleSheet.hairlineWidth },
  cveRow: { paddingVertical: space.sm, borderBottomWidth: StyleSheet.hairlineWidth },
});
