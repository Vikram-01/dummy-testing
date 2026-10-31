import { Drawer, DrawerContentScrollView, type DrawerContentComponentProps } from 'expo-router/drawer';
import {
  Bookmark, Bug, Cloud, Code, FlaskConical, History, LayoutDashboard, Newspaper, Package, Radar, RefreshCw, Search, Settings, ShieldAlert, Flame, type LucideIcon,
} from 'lucide-react-native';

import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../ui/AppState';
import { Wordmark } from '../../ui/components/Logo';
import { Button, IconButton } from '../../ui/components/primitives';
import { fonts, radius, space, type, useTheme } from '../../ui/theme';

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

/** M3 navigation drawer: 56dp items with a full-pill secondaryContainer active indicator. */
function Sidebar(props: DrawerContentComponentProps) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  const { syncing, syncNow } = useApp();
  const current = props.state.routes[props.state.index]?.name;
  return (
    <View style={{ flex: 1, backgroundColor: c.surfaceContainerLow }}>
      <View style={[styles.brand, { paddingTop: insets.top + space.xl }]}>
        <Wordmark size={22} subtitle="Security intelligence, daily" />
      </View>
      <DrawerContentScrollView {...props} contentContainerStyle={{ paddingTop: 0, paddingHorizontal: space.md, paddingBottom: space.lg }}>
        {NAV.map((n) => {
          const active = current === n.name;
          const Icon = n.icon;
          return (
            <View key={n.name}>
              {n.section ? (
                <>
                  {n.name !== 'index' ? <View style={[styles.divider, { backgroundColor: c.outlineVariant }]} /> : null}
                  <Text style={[type.titleSmall, styles.section, { color: c.onSurfaceVariant }]}>{n.section}</Text>
                </>
              ) : null}
              <Pressable
                onPress={() => props.navigation.navigate(n.name)}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                android_ripple={{ color: c.onSurface + '1F' }}
                style={[styles.item, { backgroundColor: active ? c.secondaryContainer : 'transparent' }]}
              >
                <Icon size={22} color={active ? c.onSecondaryContainer : c.onSurfaceVariant} />
                <Text style={[type.labelLarge, { color: active ? c.onSecondaryContainer : c.onSurfaceVariant, fontSize: 15 }]}>{n.title}</Text>
              </Pressable>
            </View>
          );
        })}
      </DrawerContentScrollView>
      <View style={{ paddingHorizontal: space.lg, paddingBottom: insets.bottom + space.lg, paddingTop: space.sm }}>
        <Button label={syncing ? 'Syncing…' : 'Sync now'} icon={RefreshCw} kind="secondary" loading={syncing} onPress={() => void syncNow()} />
      </View>
    </View>
  );
}

function HeaderSync() {
  const { syncing, syncNow } = useApp();
  const c = useTheme();
  return (
    <View style={{ marginRight: 4 }}>
      {syncing ? <ActivityIndicator style={{ padding: 12 }} color={c.primary} /> : <IconButton icon={RefreshCw} label="Sync now" onPress={() => void syncNow()} color={c.onSurfaceVariant} />}
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
        headerTintColor: c.onSurface,
        headerTitleStyle: { fontFamily: fonts.regular, fontSize: 22 },
        headerShadowVisible: false,
        drawerStyle: { backgroundColor: c.surfaceContainerLow, width: 320, borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg, overflow: 'hidden' },
        overlayColor: c.scrim + '66',
        sceneStyle: { backgroundColor: c.surface },
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
  brand: { paddingHorizontal: space.xl, paddingBottom: space.lg },
  section: { marginLeft: space.lg, marginTop: space.sm, marginBottom: space.xs, height: 40, textAlignVertical: 'center', lineHeight: 40 },
  divider: { height: StyleSheet.hairlineWidth, marginHorizontal: space.lg, marginTop: space.sm },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingLeft: space.lg, paddingRight: space.xl, height: 56, borderRadius: radius.full, overflow: 'hidden' },
});
