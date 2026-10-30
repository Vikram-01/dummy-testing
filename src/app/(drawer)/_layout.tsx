import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import {
  Bookmark, Bug, Cloud, Code, FlaskConical, History, LayoutDashboard, Newspaper, Package, Radar, RefreshCw, Search, Settings, ShieldAlert, Flame, type LucideIcon,
} from 'lucide-react-native';

import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../ui/AppState';
import { Wordmark } from '../../ui/components/Logo';
import { IconButton, T } from '../../ui/components/primitives';
import { radius, space, useTheme } from '../../ui/theme';

interface NavItem { name: string; title: string; icon: LucideIcon; section?: string }

const NAV: NavItem[] = [
  { name: 'index', title: 'Overview', icon: LayoutDashboard, section: 'Intelligence' },
  { name: 'news', title: 'Latest News', icon: Newspaper },
  { name: 'cves', title: 'Latest CVEs', icon: Bug, section: 'Vulnerabilities' },
  { name: 'critical', title: 'Critical Vulnerabilities', icon: Flame },
  { name: 'kev', title: 'CISA KEV', icon: ShieldAlert },
  { name: 'threat-intel', title: 'Threat Intelligence', icon: Radar, section: 'Topics' },
  { name: 'research', title: 'Security Research', icon: FlaskConical },
  { name: 'appsec', title: 'Application Security', icon: Code },
  { name: 'cloud', title: 'Cloud Security', icon: Cloud },
  { name: 'supply-chain', title: 'Supply Chain Security', icon: Package },
  { name: 'bookmarks', title: 'Bookmarks', icon: Bookmark, section: 'Library' },
  { name: 'search', title: 'Search', icon: Search },
  { name: 'sync', title: 'Sync History', icon: History, section: 'System' },
  { name: 'settings', title: 'Settings', icon: Settings },
];

function Sidebar(props: DrawerContentComponentProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { syncing, lastSummary, syncNow } = useApp();
  const current = props.state.routes[props.state.index]?.name;
  return (
    <View style={{ flex: 1, backgroundColor: c.surface }}>
      <View style={[styles.brand, { paddingTop: insets.top + space.md, borderColor: c.border }]}>
        <Wordmark />
      </View>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: space.sm, paddingHorizontal: space.sm }}>
        {NAV.map((n) => {
          const active = current === n.name;
          const Icon = n.icon;
          return (
            <View key={n.name}>
              {n.section ? <T variant="label" style={{ marginTop: space.md, marginBottom: 4, marginLeft: space.md }}>{n.section}</T> : null}
              <Pressable
                onPress={() => props.navigation.navigate(n.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                style={({ pressed }) => [styles.item, { backgroundColor: active ? c.accentSoft : pressed ? c.surfaceAlt : 'transparent' }]}
              >
                <Icon size={18} color={active ? c.accent : c.textMuted} />
                <T variant="body" color={active ? c.accent : c.text} style={{ fontWeight: active ? '700' : '500' }}>{n.title}</T>
              </Pressable>
            </View>
          );
        })}
      </DrawerContentScrollView>
      <Pressable onPress={() => syncNow()} disabled={syncing} style={[styles.footer, { borderColor: c.border, paddingBottom: insets.bottom + space.md }]} accessibilityRole="button" accessibilityLabel="Sync now">
        {syncing ? <ActivityIndicator size="small" color={c.accent} /> : <RefreshCw size={16} color={c.accent} />}
        <View>
          <T variant="small" color={c.text} style={{ fontWeight: '700' }}>{syncing ? 'Syncing…' : 'Sync now'}</T>
          {lastSummary?.runId ? <T variant="tiny" numberOfLines={1}>Last run this session: {lastSummary.status}</T> : null}
        </View>
      </Pressable>
    </View>
  );
}

function HeaderSync() {
  const { syncing, syncNow } = useApp();
  const c = useTheme();
  return (
    <View style={{ marginRight: 8 }}>
      {syncing ? <ActivityIndicator style={{ padding: 8 }} color={c.accent} /> : <IconButton icon={RefreshCw} label="Sync now" onPress={() => syncNow()} color={c.text} />}
    </View>
  );
}

export default function DrawerLayout() {
  const c = useTheme();
  return (
    <Drawer
      drawerContent={(p) => <Sidebar {...p} />}
      screenOptions={{
        headerStyle: { backgroundColor: c.surface },
        headerTintColor: c.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: c.surface, width: 300 },
        sceneStyle: { backgroundColor: c.bg },
        headerRight: () => <HeaderSync />,
        drawerType: 'front',
      }}
    >
      {NAV.map((n) => (
        <Drawer.Screen key={n.name} name={n.name} options={{ title: n.title }} />
      ))}
    </Drawer>
  );
}

const styles = StyleSheet.create({
  brand: { paddingHorizontal: space.lg, paddingBottom: space.md, borderBottomWidth: StyleSheet.hairlineWidth },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.md, paddingVertical: 10, borderRadius: radius.md },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: space.lg, paddingTop: space.md, borderTopWidth: StyleSheet.hairlineWidth },
});
