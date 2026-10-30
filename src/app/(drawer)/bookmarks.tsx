import { Bookmark, Bug, History, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, View } from 'react-native';
import { clearReadingHistory, listArticles } from '../../lib/repo/articles';
import { listCves } from '../../lib/repo/cves';
import { useApp, useDb } from '../../ui/AppState';
import { ArticleList, CveList } from '../../ui/components/lists';
import { Chip, T } from '../../ui/components/primitives';
import { space } from '../../ui/theme';

type Tab = 'articles' | 'cves' | 'history';
const BOOKMARKED = { bookmarkedOnly: true };
const READ = { readOnly: true };

export default function Bookmarks() {
  const db = useDb();
  const { bump } = useApp();
  const [tab, setTab] = useState<Tab>('articles');

  const cveLoader = useCallback((l: number, o: number) => listCves(db, { ...BOOKMARKED, sort: 'published' }, l, o), [db]);
  const articleLoader = useCallback((l: number, o: number) => listArticles(db, tab === 'history' ? READ : BOOKMARKED, l, o), [db, tab]);

  const header = (
    <View style={{ gap: space.sm, marginBottom: space.sm }}>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Chip label="Articles" icon={Bookmark} active={tab === 'articles'} onPress={() => setTab('articles')} />
        <Chip label="CVEs" icon={Bug} active={tab === 'cves'} onPress={() => setTab('cves')} />
        <Chip label="Reading history" icon={History} active={tab === 'history'} onPress={() => setTab('history')} />
        {tab === 'history' ? (
          <Chip
            label="Clear"
            icon={Trash2}
            onPress={() =>
              Alert.alert('Clear reading history?', 'Articles stay stored; only the read markers are removed.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Clear', style: 'destructive', onPress: async () => { await clearReadingHistory(db); bump(); } },
              ])
            }
          />
        ) : null}
      </View>
      <T variant="tiny">Bookmarked items are exempt from the retention window and stay available offline.</T>
    </View>
  );

  if (tab === 'cves') {
    return <CveList key="cves" loader={cveLoader} header={header} empty={{ title: 'No bookmarked CVEs', body: 'Tap the bookmark icon on any vulnerability to keep it here.' }} />;
  }
  return (
    <ArticleList
      key={tab}
      loader={articleLoader}
      header={header}
      empty={tab === 'history' ? { title: 'Nothing read yet', body: 'Articles you open appear here.' } : { title: 'No bookmarked articles', body: 'Tap the bookmark icon on any article to save it.' }}
    />
  );
}
