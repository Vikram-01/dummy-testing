import { Ionicons } from '@expo/vector-icons';
import { useInsurance } from '@/hooks/queries';
import { date } from '@/lib/format';
import { Badge, Body, Caption, Card, EmptyState, ErrorState, Heading, Money, Row, Screen, SkeletonCard, Stat, type IconName } from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

const ICON: Record<string, IconName> = { life: 'heart-outline', health: 'medkit-outline', motor: 'car-outline' };
const LABEL: Record<string, string> = { life: 'Life', health: 'Health', motor: 'Motor' };

export default function Insurance() {
  const { colors } = useTheme();
  const q = useInsurance();
  const list = q.data?.data ?? [];
  const annual = list.reduce((s, p) => s + (p.frequency === 'Yearly' ? p.premium : p.premium * 12), 0);
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      {q.isPending ? <SkeletonCard /> : q.isError && !q.data ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : list.length === 0 ? (
        <Card><EmptyState icon="shield-checkmark-outline" title="No policies linked" message="Link policies through the insurance repository consent." /></Card>
      ) : (
        <>
          <Card>
            <Row gap={space.lg}>
              <Stat label="Policies" value={<Heading>{list.length}</Heading>} />
              <Stat label="Annual premiums" value={<Money value={annual} compact variant="heading" />} />
            </Row>
          </Card>
          {[...list].sort((a, b) => a.days_to_renewal - b.days_to_renewal).map((p) => (
            <Card key={p.id}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Row>
                  <Ionicons name={ICON[p.type]} size={18} color={colors.primary} />
                  <Heading>{LABEL[p.type]}</Heading>
                </Row>
                {p.days_to_renewal <= 30 ? <Badge label={p.days_to_renewal < 0 ? 'Lapsed' : `Renew in ${p.days_to_renewal} d`} tone={p.days_to_renewal < 0 ? 'negative' : 'warning'} /> : <Badge label={p.status} tone="positive" />}
              </Row>
              <Body>{p.insurer} · {p.plan}</Body>
              <Row gap={space.lg}>
                <Stat label={p.type === 'motor' ? 'IDV' : 'Cover'} value={<Money value={p.sum_assured} compact variant="label" />} />
                <Stat label={`Premium (${p.frequency.toLowerCase()})`} value={<Money value={p.premium} variant="label" />} />
              </Row>
              <Caption muted>{p.policy_masked} · {p.insured} · renews {date(p.renewal_date)}</Caption>
            </Card>
          ))}
          <Caption faint>Renewal reminders arrive 7 days before each date (see Profile → Notifications).</Caption>
        </>
      )}
    </Screen>
  );
}
