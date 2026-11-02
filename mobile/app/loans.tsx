import { useLiabilities } from '@/hooks/queries';
import { daysUntil } from '@/lib/calc';
import { date, pct } from '@/lib/format';
import {
  Badge, Body, Caption, Card, EmptyState, ErrorState, Heading, Label, Money, Progress, Row, Screen, SectionHeader, SkeletonCard, Stat,
} from '@/ui/components';
import { DataBanners } from '@/ui/DataBanners';
import { space, useTheme } from '@/ui/theme';

export default function Loans() {
  const { colors } = useTheme();
  const q = useLiabilities();
  const d = q.data?.data;
  const utilColor = (u: number) => (u > 50 ? colors.negative : u > 30 ? colors.warning : colors.positive);

  return (
    <Screen refreshing={q.isRefetching} onRefresh={() => q.refetch()}>
      <DataBanners query={q} />
      {q.isPending ? <SkeletonCard lines={4} /> : !d ? <ErrorState error={q.error} onRetry={() => q.refetch()} /> : (
        <>
          <Card>
            <Caption muted>Total outstanding</Caption>
            <Money value={d.totals.total} variant="title" />
            <Row gap={space.lg}>
              <Stat label="Monthly EMIs" value={<Money value={d.totals.monthly_emi} compact variant="heading" />} />
              <Stat label="Card utilisation" value={<Heading color={utilColor(d.totals.utilisation_pct)}>{pct(d.totals.utilisation_pct, { decimals: 1 })}</Heading>} />
            </Row>
          </Card>

          <SectionHeader title="Loans" />
          {d.loans.length === 0 ? <Card><EmptyState icon="home-outline" title="No loans" /></Card> : d.loans.map((l) => {
            const paid = ((l.principal - l.outstanding) / l.principal) * 100;
            const due = daysUntil(l.next_emi_date);
            return (
              <Card key={l.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Heading>{l.type}</Heading>
                  {due >= 0 && due <= 7 ? <Badge label={`EMI in ${due} d`} tone="warning" /> : null}
                </Row>
                <Body muted>{l.lender} · {l.account_masked}</Body>
                <Row gap={space.lg}>
                  <Stat label="Outstanding" value={<Money value={l.outstanding} compact variant="label" />} />
                  <Stat label="EMI" value={<Money value={l.emi} variant="label" />} />
                  <Stat label="Rate" value={<Label>{pct(l.interest_rate_pct)}</Label>} />
                </Row>
                <Progress value={paid} color={colors.positive} />
                <Caption muted>{paid.toFixed(0)}% repaid · {l.tenure_left_months} months left · next EMI {date(l.next_emi_date)}</Caption>
              </Card>
            );
          })}

          <SectionHeader title="Credit cards" />
          {d.cards.length === 0 ? <Card><EmptyState icon="card-outline" title="No credit cards" /></Card> : d.cards.map((c) => {
            const u = (c.outstanding / c.credit_limit) * 100;
            const due = daysUntil(c.due_date);
            return (
              <Card key={c.id}>
                <Row style={{ justifyContent: 'space-between' }}>
                  <Heading>{c.card_name} ···· {c.last4}</Heading>
                  {due >= 0 && due <= 7 ? <Badge label={`Due in ${due} d`} tone="warning" /> : due < 0 ? <Badge label="Overdue" tone="negative" /> : null}
                </Row>
                <Body muted>{c.issuer}</Body>
                <Row gap={space.lg}>
                  <Stat label="Outstanding" value={<Money value={c.outstanding} variant="label" />} />
                  <Stat label="Minimum due" value={<Money value={c.min_due} variant="label" />} />
                  <Stat label="Due date" value={<Label>{date(c.due_date)}</Label>} />
                </Row>
                <Progress value={u} color={utilColor(u)} />
                <Caption muted>{pct(u, { decimals: 1 })} of <Money value={c.credit_limit} compact variant="caption" /> limit used · statement {date(c.statement_date)}</Caption>
              </Card>
            );
          })}
          <Caption faint>Keeping utilisation under 30% generally supports a healthy credit score. Pay bills through your bank or card issuer — this app never collects card numbers, CVV or PINs.</Caption>
        </>
      )}
    </Screen>
  );
}
