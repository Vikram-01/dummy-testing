import { Fragment, useState } from 'react';
import { View } from 'react-native';
import { useDemat, useMutualFunds, usePerformance, useSips } from '@/hooks/queries';
import { absoluteReturnPct } from '@/lib/calc';
import { date, pct } from '@/lib/format';
import { Donut, LineChart } from '@/ui/charts';
import {
  Badge, Body, Caption, Card, Divider, EmptyState, ErrorState, Heading, Label, ListRow, Money, Row, Screen, Segmented, SkeletonCard, Stat,
} from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

type Tab = 'overview' | 'stocks' | 'mf' | 'sip';

export default function Investments() {
  const [tab, setTab] = useState<Tab>('overview');
  const demat = useDemat();
  const mf = useMutualFunds();
  const sips = useSips();
  const refresh = () => Promise.all([demat.refetch(), mf.refetch(), sips.refetch()]);

  return (
    <Screen refreshing={demat.isRefetching || mf.isRefetching} onRefresh={refresh}>
      <DataBanners query={mf} />
      <Segmented<Tab>
        value={tab}
        onChange={setTab}
        options={[{ value: 'overview', label: 'Overview' }, { value: 'stocks', label: 'Stocks' }, { value: 'mf', label: 'Mutual funds' }, { value: 'sip', label: 'SIPs' }]}
      />
      {tab === 'overview' && <Overview />}
      {tab === 'stocks' && <Stocks />}
      {tab === 'mf' && <Funds />}
      {tab === 'sip' && <Sips />}
    </Screen>
  );
}

function Overview() {
  const [range, setRange] = useState<'6M' | '1Y' | '2Y'>('1Y');
  const demat = useDemat();
  const mf = useMutualFunds();
  const perf = usePerformance(range);
  if (demat.isPending || mf.isPending) return <SkeletonCard lines={4} />;
  if (!demat.data || !mf.data) return <ErrorState error={demat.error ?? mf.error} onRetry={() => { demat.refetch(); mf.refetch(); }} />;

  const s = demat.data.data.totals;
  const f = mf.data.data.totals;
  const invested = s.invested + f.invested;
  const value = s.market_value + f.current_value;
  if (invested === 0) return <Card><EmptyState icon="trending-up-outline" title="No investments linked" message="Link your demat account and mutual fund folios via Account Aggregator or CAS." /></Card>;

  const byCategory = new Map<string, number>();
  byCategory.set('Direct stocks', s.market_value);
  for (const h of mf.data.data.holdings) {
    const k = h.category.split(':')[0].trim() + ' funds';
    byCategory.set(k, (byCategory.get(k) ?? 0) + h.current_value);
  }

  return (
    <>
      <Card>
        <Caption muted>Portfolio value</Caption>
        <Money value={value} variant="display" />
        <Row>
          <Money value={value - invested} sign colorize variant="label" />
          <Label muted>({pct(absoluteReturnPct(invested, value), { sign: true })}) overall</Label>
        </Row>
        <Row gap={space.lg}>
          <Stat label="Invested" value={<Money value={invested} compact variant="heading" />} />
          <Stat label="Mutual fund XIRR" value={<Heading>{pct(f.xirr_pct)}</Heading>} />
        </Row>
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Heading>Performance</Heading>
          <View style={{ width: 160 }}>
            <Segmented value={range} onChange={setRange} options={[{ value: '6M', label: '6M' }, { value: '1Y', label: '1Y' }, { value: '2Y', label: '2Y' }]} />
          </View>
        </Row>
        {perf.data?.data.length ? (
          <LineChart
            a11y="Invested amount versus current value over time"
            labels={perf.data.data.map((p) => date(p.date).split(' ').slice(1).join(' '))}
            series={[
              { name: 'Value', values: perf.data.data.map((p) => p.value) },
              { name: 'Invested', values: perf.data.data.map((p) => p.invested), fill: false },
            ]}
          />
        ) : perf.isPending ? <SkeletonCard /> : <Caption muted>No history yet.</Caption>}
      </Card>

      <Card>
        <Heading>Allocation</Heading>
        <Donut data={[...byCategory.entries()].map(([label, v]) => ({ label, value: v }))} />
      </Card>
    </>
  );
}

function Stocks() {
  const { colors } = useTheme();
  const q = useDemat();
  if (q.isPending) return <SkeletonCard lines={5} />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data.data;
  if (!d.holdings.length) return <Card><EmptyState icon="stats-chart-outline" title="No stock holdings" message="Link your demat account to see holdings." /></Card>;
  return (
    <>
      <Card>
        <Row gap={space.lg}>
          <Stat label="Market value" value={<Money value={d.totals.market_value} compact variant="heading" />} />
          <Stat label="Invested" value={<Money value={d.totals.invested} compact variant="heading" />} />
          <Stat label="P&L" value={<Money value={d.totals.pnl} compact colorize variant="heading" />} sub={<Caption muted>{pct(d.totals.pnl_pct, { sign: true })}</Caption>} />
        </Row>
        <Caption faint>{d.accounts.map((a) => `${a.depository} · ${a.dp_name} · ${a.bo_masked}`).join('\n')}</Caption>
      </Card>
      <Card style={{ gap: 0 }}>
        {d.holdings.map((h, i) => (
          <Fragment key={h.symbol}>
            {i > 0 ? <Divider /> : null}
            <View style={{ paddingVertical: space.md, gap: 4 }}>
              <Row style={{ justifyContent: 'space-between' }}>
                <Body style={{ fontWeight: '600' }}>{h.symbol}</Body>
                <Money value={h.market_value} />
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Caption muted numberOfLines={1} style={{ flex: 1 }}>{h.quantity} sh · avg <Money value={h.avg_price} decimals={2} variant="caption" /> · LTP <Money value={h.ltp} decimals={2} variant="caption" /></Caption>
                <Caption color={h.pnl >= 0 ? colors.positive : colors.negative}>
                  {pct(h.pnl_pct, { sign: true })}
                </Caption>
              </Row>
              <Row style={{ justifyContent: 'space-between' }}>
                <Caption faint>Day {pct(h.day_change_pct, { sign: true })}</Caption>
                <Money value={h.pnl} sign colorize variant="caption" />
              </Row>
            </View>
          </Fragment>
        ))}
      </Card>
      <Caption faint>Prices are as last reported by the server and may be delayed.</Caption>
    </>
  );
}

function Funds() {
  const [utiOnly, setUtiOnly] = useState(false);
  const q = useMutualFunds();
  if (q.isPending) return <SkeletonCard lines={5} />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const d = q.data.data;
  if (!d.holdings.length) return <Card><EmptyState icon="pie-chart-outline" title="No mutual funds" message="Import your CAS statement or link folios via Account Aggregator." /></Card>;
  const rows = utiOnly ? d.holdings.filter((h) => h.amc === 'UTI Mutual Fund') : d.holdings;
  return (
    <>
      <Card>
        <Row gap={space.lg}>
          <Stat label="Current value" value={<Money value={d.totals.current_value} compact variant="heading" />} />
          <Stat label="Invested" value={<Money value={d.totals.invested} compact variant="heading" />} />
        </Row>
        <Row gap={space.lg}>
          <Stat label="Absolute return" value={<Heading>{pct(d.totals.absolute_return_pct, { sign: true })}</Heading>} />
          <Stat label="XIRR (annualised)" value={<Heading>{pct(d.totals.xirr_pct, { sign: true })}</Heading>} />
        </Row>
      </Card>
      <Segmented<'all' | 'uti'> value={utiOnly ? 'uti' : 'all'} onChange={(v) => setUtiOnly(v === 'uti')}
        options={[{ value: 'all', label: `All funds (${d.holdings.length})` }, { value: 'uti', label: 'UTI Mutual Fund' }]} />
      {rows.map((h) => (
        <Card key={h.scheme_code}>
          <Row style={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1, gap: 4 }}>
              <Body style={{ fontWeight: '600' }}>{h.scheme_name}</Body>
              <Row>
                <Badge label={h.amc === 'UTI Mutual Fund' ? 'UTI MF' : h.amc} tone={h.amc === 'UTI Mutual Fund' ? 'primary' : 'neutral'} />
                <Caption muted>{h.category}</Caption>
              </Row>
            </View>
          </Row>
          <Row gap={space.lg}>
            <Stat label="Value" value={<Money value={h.current_value} compact variant="label" />} />
            <Stat label="Invested" value={<Money value={h.invested} compact variant="label" />} />
            <Stat label="Abs." value={<Label>{pct(h.absolute_return_pct, { sign: true })}</Label>} />
            <Stat label="XIRR" value={<Label>{pct(h.xirr_pct, { sign: true })}</Label>} />
          </Row>
          <Caption faint>Folio {h.folio_masked} · {h.units.toFixed(3)} units · NAV ₹{h.nav.toFixed(2)} on {date(h.nav_date)}</Caption>
        </Card>
      ))}
    </>
  );
}

function Sips() {
  const q = useSips();
  if (q.isPending) return <SkeletonCard lines={4} />;
  if (!q.data) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  const list = q.data.data;
  if (!list.length) return <Card><EmptyState icon="repeat-outline" title="No SIPs found" /></Card>;
  const monthly = list.filter((s) => s.status === 'Active').reduce((a, s) => a + s.amount, 0);
  return (
    <>
      <Card>
        <Row gap={space.lg}>
          <Stat label="Monthly SIP outflow" value={<Money value={monthly} variant="heading" />} />
          <Stat label="Active SIPs" value={<Heading>{list.filter((s) => s.status === 'Active').length}</Heading>} />
        </Row>
      </Card>
      <Card style={{ gap: 0 }}>
        {list.map((s, i) => (
          <Fragment key={s.id}>
            {i > 0 ? <Divider /> : null}
            <ListRow icon="repeat-outline" title={s.scheme_name} subtitle={`${s.frequency} on day ${s.sip_day} · ${s.installments_done} instalments since ${date(s.start_date)}`}
              right={<Money value={s.amount} />} rightSub={`Next ${date(s.next_date)}`} />
          </Fragment>
        ))}
      </Card>
    </>
  );
}
