import * as Notifications from 'expo-notifications';
import { BellRing, Database, KeyRound, Moon, Save, Sun, SunMoon, Timer, Trash2, Wifi } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { NEWS_SOURCES, CVE_SOURCES } from '../../lib/config/sources';
import { LIMITS } from '../../lib/repo/settings';
import { getSecret, mask, setSecret, type SecretKey } from '../../lib/secrets';
import { purgeExpired } from '../../lib/sync/retention';
import { useApp, useDb } from '../../ui/AppState';
import { Button, Card, Chip, SectionHeader, T } from '../../ui/components/primitives';
import { font, fonts, radius, space, useTheme } from '../../ui/theme';

function Row({ icon: Icon, title, body, right }: { icon: typeof Sun; title: string; body?: string; right?: React.ReactNode }) {
  const c = useTheme();
  return (
    <View style={styles.row}>
      <Icon size={18} color={c.textMuted} />
      <View style={{ flex: 1 }}>
        <T variant="body" style={{ fontWeight: '600' }}>{title}</T>
        {body ? <T variant="tiny">{body}</T> : null}
      </View>
      {right}
    </View>
  );
}

function SecretField({ k, label, help, link }: { k: SecretKey; label: string; help: string; link: string }) {
  const c = useTheme();
  const [current, setCurrent] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    getSecret(k).then(setCurrent);
  }, [k]);
  return (
    <View style={{ gap: 6, marginTop: space.sm }}>
      <Row icon={KeyRound} title={label} body={`${mask(current)} · stored in the Android Keystore`} />
      <T variant="tiny">{help} <T variant="tiny" color={c.accent} onPress={() => Linking.openURL(link)}>Get one</T></T>
      <TextInput
        style={[styles.input, { backgroundColor: 'transparent', borderColor: err ? c.error : c.outline, color: c.onSurface, fontFamily: fonts.regular }]}
        value={draft}
        onChangeText={(t) => { setDraft(t); setErr(null); }}
        placeholder={current ? 'Enter a new value to replace' : 'Paste key'}
        placeholderTextColor={c.textFaint}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        maxLength={300}
      />
      {err ? <T variant="tiny" color={c.danger}>{err}</T> : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <View style={{ flex: 1 }}>
          <Button label="Save" icon={Save} kind="secondary" disabled={!draft} onPress={async () => {
            try { await setSecret(k, draft); setCurrent(draft.trim()); setDraft(''); } catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
          }} />
        </View>
        {current ? (
          <View style={{ flex: 1 }}>
            <Button label="Remove" icon={Trash2} kind="danger" onPress={async () => { await setSecret(k, null); setCurrent(null); }} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const db = useDb();
  const c = useTheme();
  const { settings, updateSettings, bump } = useApp();
  const sw = { trackColor: { true: c.primary, false: c.surfaceContainerHighest }, ios_backgroundColor: c.surfaceContainerHighest };

  return (
    <ScrollView contentContainerStyle={{ padding: space.md, paddingBottom: 64 }}>
      <SectionHeader title="Appearance" />
      <Card>
        <Row icon={SunMoon} title="Theme" />
        <View style={styles.chips}>
          <Chip label="Dark" icon={Moon} active={settings.theme === 'dark'} onPress={() => updateSettings({ theme: 'dark' })} />
          <Chip label="Light" icon={Sun} active={settings.theme === 'light'} onPress={() => updateSettings({ theme: 'light' })} />
          <Chip label="System" icon={SunMoon} active={settings.theme === 'system'} onPress={() => updateSettings({ theme: 'system' })} />
        </View>
      </Card>

      <SectionHeader title="Synchronization" />
      <Card>
        <Row icon={Timer} title="Sync interval" body={`Android runs background work no more often than every ${LIMITS.syncIntervalMinutes.min} minutes.`} />
        <View style={styles.chips}>
          {[15, 30, 60, 120, 180, 360, 720].map((m) => (
            <Chip key={m} label={m < 60 ? `${m} min` : `${m / 60} h`} active={settings.syncIntervalMinutes === m} onPress={() => updateSettings({ syncIntervalMinutes: m })} />
          ))}
        </View>
        <View style={{ height: space.md }} />
        <Row icon={Wifi} title="Background sync on Wi-Fi only" body="Manual sync always works on any connection." right={<Switch {...sw} thumbColor={settings.wifiOnly ? c.onPrimary : c.outline} value={settings.wifiOnly} onValueChange={(v) => updateSettings({ wifiOnly: v })} />} />
        <View style={{ height: space.md }} />
        <Row
          icon={BellRing}
          title="Alert on new CISA KEV entries"
          body="Local notification when CISA adds a known exploited vulnerability."
          right={
            <Switch {...sw} thumbColor={settings.kevNotifications ? c.onPrimary : c.outline} value={settings.kevNotifications}
              onValueChange={async (v) => {
                if (v) {
                  const p = await Notifications.requestPermissionsAsync();
                  if (!p.granted) {
                    Alert.alert('Notifications are off', 'Allow notifications for SecOpsDaily in Android settings to receive KEV alerts.');
                    return;
                  }
                }
                updateSettings({ kevNotifications: v });
              }}
            />
          }
        />
      </Card>

      <SectionHeader title="Data retention" />
      <Card>
        <Row icon={Database} title={`Keep ${settings.retentionDays} days of data`} body="Older articles, CVEs and sync logs are removed after each sync. Bookmarked items are always kept. The window counts back from the last successful sync, so nothing is lost while offline." />
        <View style={styles.chips}>
          {[1, 3, 5, 7, 14, 30].map((d) => (
            <Chip key={d} label={`${d} day${d > 1 ? 's' : ''}`} active={settings.retentionDays === d} onPress={() => updateSettings({ retentionDays: d })} />
          ))}
        </View>
        <View style={{ height: space.md }} />
        <Button
          label="Apply retention now"
          kind="secondary"
          icon={Trash2}
          onPress={async () => {
            const r = await purgeExpired(db, settings.retentionDays);
            bump();
            Alert.alert('Retention applied', `Removed ${r.articles} article(s), ${r.cves} CVE(s) and ${r.runs} old sync run(s).`);
          }}
        />
      </Card>

      <SectionHeader title="API keys (optional)" />
      <Card>
        <SecretField k="nvdApiKey" label="NVD API key" help="Raises the NVD limit from 5 to 50 requests per 30 seconds, making CVE syncs much faster." link="https://nvd.nist.gov/developers/request-an-api-key" />
        <View style={{ height: space.lg }} />
        <SecretField k="githubToken" label="GitHub token" help="A fine-grained token with no extra permissions raises the GitHub advisory limit from 60 to 5,000 requests per hour." link="https://github.com/settings/personal-access-tokens" />
      </Card>

      <SectionHeader title="Sources" />
      <Card>
        <T variant="tiny" style={{ marginBottom: space.sm }}>Turn off sources you do not want synced. Data already stored is kept.</T>
        {[...NEWS_SOURCES, ...CVE_SOURCES].map((s) => (
          <View key={s.id} style={styles.srcRow}>
            <View style={{ flex: 1 }}>
              <T variant="body">{s.name}</T>
              <T variant="tiny" numberOfLines={1}>{s.kind === 'news' ? 'News feed' : 'Vulnerability data'} · {s.homepage.replace(/^https:\/\//, '')}</T>
            </View>
            <Switch {...sw} thumbColor={(settings.enabledSources[s.id] ?? true) ? c.onPrimary : c.outline} value={settings.enabledSources[s.id] ?? true} onValueChange={(v) => updateSettings({ enabledSources: { ...settings.enabledSources, [s.id]: v } })} />
          </View>
        ))}
      </Card>

      <SectionHeader title="About" />
      <Card>
        <T variant="small">
          SecOpsDaily reads publishers&apos; official RSS/Atom feeds and the public NVD, CISA KEV, GitHub Advisory, CVE.org and OSV.dev APIs over HTTPS. Article pages open in a locked-down browser without access to app data. Exploitation is shown as verified only when CISA lists the CVE in KEV; NVD &ldquo;Exploit&rdquo; references are labelled unverified.
        </T>
        <T variant="tiny" style={{ marginTop: space.sm }}>SecOpsDaily 1.1.0</T>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: space.sm },
  input: { borderWidth: 1, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 9, fontSize: font.body },
  srcRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: space.sm },
});
