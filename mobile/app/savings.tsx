import { useSavings } from '@/hooks/queries';
import { date, pct } from '@/lib/format';
import { Donut } from '@/ui/charts';
import {
  Badge, Body, Caption, Card, EmptyState, ErrorState, Heading, Label, Money, Progress, Row, Screen, SectionHeader, SkeletonCard, Stat,
} from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

export default function SavingsScreen() {
  const { colors } = useTheme();
  const q = useSavings();
  const d = q.data?.data;
  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      {q.isPending ? <SkeletonCard lines={4} /> : !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <Card>
            <Row gap={space.lg}>
              <Stat label="Deposits (FD / RD)" value={<Money value={d.totals.deposits} compact variant="heading" />} />
              <Stat label="Retirement" value={<Money value={d.totals.retirement} compact variant="heading" />} />
            </Row>
          </Card>

          <SectionHeader title="Fixed & recurring deposits" />
          {d.deposits.length === 0 ? <Card><EmptyState icon="lock-closed-outline" title="No deposits linked" /></Card> :
            [...d.deposits].sort((a, b) => a.days_to_maturity - b.days_to_maturity).map((x) => {
              const total = Date.parse(x.maturity_date) - Date.parse(x.start_date);
              const done = Math.min(100, Math.max(0, ((Date.now() - Date.parse(x.start_date)) / total) * 100));
              return (
                <Card key={x.id}>
                  <Row style={{ justifyContent: 'space-between' }}>
                    <Row><Badge label={x.type} tone="primary" /><Body>{x.bank}</Body></Row>
                    {x.days_to_maturity <= 45 && x.days_to_maturity >= 0 ? <Badge label={`Matures in ${x.days_to_maturity} d`} tone="warning" /> : null}
                  </Row>
                  <Row gap={space.lg}>
                    <Stat label={x.type === 'RD' ? 'Deposited so far' : 'Principal'} value={<Money value={x.principal} compact variant="label" />} />
                    <Stat label="Rate" value={<Label>{pct(x.rate_pct)}</Label>} />
                    <Stat label="At maturity" value={<Money value={x.maturity_amount} compact variant="label" />} />
                  </Row>
                  <Progress value={done} />
                  <Caption muted>{x.account_masked} · {date(x.start_date)} → {date(x.maturity_date)} · {x.payout}{x.monthly_installment ? ` · ₹${x.monthly_installment}/month` : ''}</Caption>
                </Card>
              );
            })}

          <SectionHeader title="Retirement" />
          {d.retirement.ppf ? (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}><Heading>PPF</Heading><Money value={d.retirement.ppf.balance} variant="heading" /></Row>
              <Caption muted>This financial year: <Money value={d.retirement.ppf.fy_contribution} variant="caption" /> of <Money value={d.retirement.ppf.fy_limit} variant="caption" /> limit</Caption>
              <Progress value={(d.retirement.ppf.fy_contribution / d.retirement.ppf.fy_limit) * 100} color={colors.positive} />
              <Caption muted>{d.retirement.ppf.account_masked} · {pct(d.retirement.ppf.rate_pct)} · matures {date(d.retirement.ppf.maturity_date)}</Caption>
            </Card>
          ) : null}
          {d.retirement.epf ? (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}><Heading>EPF</Heading><Money value={d.retirement.epf.balance} variant="heading" /></Row>
              <Row gap={space.lg}>
                <Stat label="Employee share" value={<Money value={d.retirement.epf.employee_share} compact variant="label" />} />
                <Stat label="Employer share" value={<Money value={d.retirement.epf.employer_share} compact variant="label" />} />
              </Row>
              <Caption muted>UAN {d.retirement.epf.uan_masked} · {pct(d.retirement.epf.rate_pct)} · last credit {date(d.retirement.epf.last_contribution)}</Caption>
            </Card>
          ) : null}
          {d.retirement.nps ? (
            <Card>
              <Row style={{ justifyContent: 'space-between' }}><Heading>NPS</Heading><Money value={d.retirement.nps.balance} variant="heading" /></Row>
              <Row gap={space.lg}>
                <Stat label="Tier I" value={<Money value={d.retirement.nps.tier1} compact variant="label" />} />
                <Stat label="Tier II" value={<Money value={d.retirement.nps.tier2} compact variant="label" />} />
              </Row>
              <Donut size={120} data={d.retirement.nps.scheme_mix.map((m) => ({ label: m.asset, value: m.pct }))} />
              <Caption muted>PRAN {d.retirement.nps.pran_masked}</Caption>
            </Card>
          ) : null}
          {!d.retirement.ppf && !d.retirement.epf && !d.retirement.nps ? <Card><EmptyState icon="umbrella-outline" title="No retirement accounts linked" /></Card> : null}
        </>
      )}
    </Screen>
  );
}
