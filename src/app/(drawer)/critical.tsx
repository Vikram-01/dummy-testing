
import type { CveFilter } from '../../lib/repo/cves';
import { CveScreen } from '../../ui/screens/CveScreen';

const BASE: CveFilter = { severities: ['CRITICAL'] };
export default function Critical() {
  return <CveScreen base={BASE} initial={{ sort: 'score' }} intro="CVSS 9.0 and above. Use Filters to show only vulnerabilities CISA has confirmed are exploited." />;
}
