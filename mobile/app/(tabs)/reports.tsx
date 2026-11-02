import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Alert, Pressable } from 'react-native';
import { useAllocation, useAnnual, useMonthly, useNwHistory } from '@/hooks/queries';
import { allocationPct } from '@/lib/calc';
import { inr, monthLabel, pct, shiftMonth, ym } from '@/lib/format';
import { exportCsv, exportPdf, toCsv, toHtml, type ReportSection } from '@/services/export';
import { useAuth } from '@/state/auth';
import { BarChart, CategoryBars, Donut, LineChart } from '@/ui/charts';
import {
  Button, Caption, Card, EmptyState, ErrorState, Heading, Label, Money, Row, Screen, Segmented, SkeletonCard, Stat,
} from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

type Tab = 'monthly' | 'annual' | 'allocation' | 'networth';

export default function Reports() {
  const [tab, setTab] = useState<Tab>('monthly');
  const [month, setMonth] = useState(ym(new Date(Date.now() - 86400000 * new Date().getDate()))); // last full month
  const [year, setYear] = useState(new Date().getFullYear());
  const monthly = useMonthly(month);

  return (
    <Screen refreshing={monthly.isRefetching} onRefresh={() => monthly.refetch()}>
      <DataBanners query={monthly} />
      <Segmented<Tab> value={tab} onChange={setTab}
        options={[{ value: 'monthly', label: 'Monthly' }, { value: 'annual', label: 'Annual' }, { value: 'allocation', label: 'Allocation' }, { value: 'networth', label: 'Net worth' }]} />
      {tab === 'monthly' && <Monthly month={month} setMonth={setMonth} />}
      {tab === 'annual' && <Annual year={year} setYear={setYear} />}
      {tab === 'allocation' && <AllocationView />}
      {tab === 'networth' && <NetWorth />}
    </Screen>
  );
}

function Stepper({ label, onPrev, onNext, nextDisabled }: { label: string; onPrev: () => void; onNext: () => void; nextDisabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Row style={{ justifyContent: 'space-between' }}>
      <Pressable onPress={onPrev} hitSlop={12} accessibilityLabel="Previous"><Ionicons name="chevron-back" size={22} color={colors.primary} /></Pressable>
      <Heading>{label}</Heading>
      <Pressable onPress={nextDisabled ? undefined : onNext} hitSlop={12} accessibilityLabel="Next"><Ionicons name="chevron-forward" size={22} color={nextDisabled ? colors.border : colors.primary} /></Pressable>
    </Row>
  );
}

function ExportButtons({ build, name }: { build: () => { title: string; subtitle: string; sections: ReportSection[] }; name: string }) {
  const { isDemo } = useAuth();
  const [busy, setBusy] = useState<'pdf' | 'csv' | null>(null);
  const run = async (kind: 'pdf' | 'csv') => {
    setBusy(kind);
    try {
      const r = build();
      if (kind === 'pdf') await exportPdf(toHtml(r.title, r.subtitle, r.sections, isDemo));
      else {
        const csv = r.sections.map((s) => `${s.heading}\r\n${toCsv(s.header, s.rows)}`).join('\r\n\r\n');
        await exportCsv(`${name}${isDemo ? '-DEMO' : ''}`, (isDemo ? 'DEMO DATA - fictional\r\n' : '') + csv);
      }
    } catch (e) {
      Alert.alert('Export failed', (e as Error).message);
    } finally {
      setBusy(null);
    }
  };
  return (
    <Row>
      <Button title="Export PDF" icon="document-outline" variant="secondary" loading={busy === 'pdf'} onPress={() => run('pdf')} style={{ flex: 1 }} />
      <Button title="Export CSV" icon="grid-outline" variant="secondary" loading={busy === 'csv'} onPress={() => run('csv')} style={{ flex: 1 }} />
    </Row>
  );
}

function Monthly({ month, setMonth }: { month: string; setMonth: (m: string) => void }) {
  const q = useMonthly(month);
  const cur = ym(new Date());
  const d = q.data?.data;
  return (
    <>
      <Stepper label={monthLabel(month)} onPrev={() => setMonth(shiftMonth(month, -1))} onNext={() => setMonth(shiftMonth(month, 1))} nextDisabled={month >= cur} />
      {q.isPending ? <SkeletonCard lines={4} /> : !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : d.income_total === 0 && d.expense_total === 0 ? (
        <Card><EmptyState icon="calendar-outline" title="No transactions this month" /></Card>
      ) : (
        <>
          <Card>
            <Row gap={space.lg}>
              <Stat label="Income" value={<Money value={d.income_total} compact variant="heading" />} />
              <Stat label="Expenses" value={<Money value={d.expense_total} compact variant="heading" />} />
              <Stat label="Saved" value={<Money value={d.net_savings} compact colorize variant="heading" />} sub={<Caption muted>{pct(d.savings_rate_pct, { decimals: 1 })} rate</Caption>} />
            </Row>
            {d.net_worth_change != null ? (
              <Row><Caption muted>Net worth change</Caption><Money value={d.net_worth_change} sign colorize variant="label" /></Row>
            ) : null}
          </Card>
          <Card>
            <Heading>Where the money went</Heading>
            <CategoryBars items={d.expense} max={8} />
          </Card>
          <Card>
            <Heading>Income sources</Heading>
            <CategoryBars items={d.income} />
          </Card>
          <ExportButtons name={`PF360-monthly-${month}`} build={() => ({
            title: `Monthly report — ${monthLabel(month)}`,
            subtitle: `Income ${inr(d.income_total)} · Expenses ${inr(d.expense_total)} · Savings rate ${d.savings_rate_pct}%`,
            sections: [
              { heading: 'Summary', header: ['Item', 'Amount'], numericCols: [1], rows: [['Income', d.income_total], ['Expenses', d.expense_total], ['Net savings', d.net_savings]] },
              { heading: 'Expenses by category', header: ['Category', 'Amount'], numericCols: [1], rows: d.expense.map((e) => [e.category, e.amount]) },
              { heading: 'Income by source', header: ['Source', 'Amount'], numericCols: [1], rows: d.income.map((e) => [e.category, e.amount]) },
            ],
          })} />
        </>
      )}
    </>
  );
}

function Annual({ year, setYear }: { year: number; setYear: (y: number) => void }) {
  const q = useAnnual(year);
  const d = q.data?.data;
  return (
    <>
      <Stepper label={String(year)} onPrev={() => setYear(year - 1)} onNext={() => setYear(year + 1)} nextDisabled={year >= new Date().getFullYear()} />
      {q.isPending ? <SkeletonCard lines={4} /> : !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : d.income_total === 0 && d.expense_total === 0 ? (
        <Card><EmptyState icon="calendar-outline" title={`No data for ${year}`} /></Card>
      ) : (
        <>
          <Card>
            <Row gap={space.lg}>
              <Stat label="Income" value={<Money value={d.income_total} compact variant="heading" />} />
              <Stat label="Expenses" value={<Money value={d.expense_total} compact variant="heading" />} />
              <Stat label="Savings rate" value={<Heading>{pct(d.savings_rate_pct, { decimals: 1 })}</Heading>} />
            </Row>
          </Card>
          <Card>
            <Heading>Income vs expenses</Heading>
            <BarChart a11y={`Monthly income and expenses for ${year}`} labels={d.months.map((m) => monthLabel(m.month).slice(0, 1))}
              groups={[{ name: 'Income', values: d.months.map((m) => m.income_total) }, { name: 'Expenses', values: d.months.map((m) => m.expense_total) }]} />
          </Card>
          <Card>
            <Heading>Top expense categories</Heading>
            <CategoryBars items={d.expense_by_category} max={8} />
          </Card>
          <ExportButtons name={`PF360-annual-${year}`} build={() => ({
            title: `Annual report — ${year}`,
            subtitle: `Savings rate ${d.savings_rate_pct}%`,
            sections: [
              { heading: 'By month', header: ['Month', 'Income', 'Expenses', 'Net'], numericCols: [1, 2, 3], rows: d.months.map((m) => [monthLabel(m.month), m.income_total, m.expense_total, m.net_savings]) },
              { heading: 'Expenses by category', header: ['Category', 'Amount'], numericCols: [1], rows: d.expense_by_category.map((e) => [e.category, e.amount]) },
            ],
          })} />
        </>
      )}
    </>
  );
}

function AllocationView() {
  const q = useAllocation();
  const d = q.data?.data;
  if (q.isPending) return <SkeletonCard lines={4} />;
  if (!d) return <ErrorState error={q.error} onRetry={() => q.refetch()} />;
  if (!d.assets.length) return <Card><EmptyState icon="pie-chart-outline" title="Nothing to allocate yet" /></Card>;
  const ta = d.assets.reduce((s, a) => s + a.value, 0);
  const tl = d.liabilities.reduce((s, a) => s + a.value, 0);
  const ap = allocationPct(d.assets.map((a) => a.value));
  const lp = allocationPct(d.liabilities.map((a) => a.value));
  return (
    <>
      <Card>
        <Heading>Asset allocation</Heading>
        <Donut data={d.assets.map((a) => ({ label: a.class, value: a.value }))} centerLabel="assets" centerValue={`₹${(ta / 1e5).toFixed(1)}L`} />
      </Card>
      <Card>
        <Heading>Liability breakdown</Heading>
        <Donut data={d.liabilities.map((a) => ({ label: a.type, value: a.value }))} centerLabel="owed" centerValue={`₹${(tl / 1e5).toFixed(1)}L`} />
        <Row><Label muted>Debt-to-asset ratio</Label><Label>{pct((tl / ta) * 100, { decimals: 1 })}</Label></Row>
      </Card>
      <ExportButtons name="PF360-allocation" build={() => ({
        title: 'Asset allocation & liabilities',
        subtitle: `Assets ${inr(ta)} · Liabilities ${inr(tl)}`,
        sections: [
          { heading: 'Assets', header: ['Class', 'Value', 'Share %'], numericCols: [1, 2], rows: d.assets.map((a, i) => [a.class, a.value, `${ap[i]}%`]) },
          { heading: 'Liabilities', header: ['Type', 'Outstanding', 'Share %'], numericCols: [1, 2], rows: d.liabilities.map((a, i) => [a.type, a.value, `${lp[i]}%`]) },
        ],
      })} />
    </>
  );
}

function NetWorth() {
  const [range, setRange] = useState<'1Y' | '2Y'>('1Y');
  const q = useNwHistory(range);
  const d = q.data?.data;
  return (
    <>
      <Segmented value={range} onChange={setRange} options={[{ value: '1Y', label: '1 year' }, { value: '2Y', label: '2 years' }]} />
      {q.isPending ? <SkeletonCard lines={4} /> : !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : !d.length ? (
        <Card><EmptyState icon="analytics-outline" title="No history yet" /></Card>
      ) : (
        <>
          <Card>
            <Caption muted>Change over period</Caption>
            <Money value={d[d.length - 1].net_worth - d[0].net_worth} sign colorize variant="title" />
            <LineChart a11y="Assets, liabilities and net worth over time" labels={d.map((p) => monthLabel(p.month, true))}
              series={[
                { name: 'Net worth', values: d.map((p) => p.net_worth) },
                { name: 'Assets', values: d.map((p) => p.assets), fill: false },
                { name: 'Liabilities', values: d.map((p) => p.liabilities), fill: false },
              ]} height={210} />
          </Card>
          <ExportButtons name={`PF360-networth-${range}`} build={() => ({
            title: 'Net worth history', subtitle: `${monthLabel(d[0].month)} – ${monthLabel(d[d.length - 1].month)}`,
            sections: [{ heading: 'By month', header: ['Month', 'Assets', 'Liabilities', 'Net worth'], numericCols: [1, 2, 3], rows: d.map((p) => [monthLabel(p.month), p.assets, p.liabilities, p.net_worth]) }],
          })} />
        </>
      )}
    </>
  );
}
