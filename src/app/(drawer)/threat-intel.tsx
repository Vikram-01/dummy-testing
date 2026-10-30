
import { SECTION_FILTERS } from '../../lib/config/categories';
import { NewsScreen } from '../../ui/screens/NewsScreen';

const S = SECTION_FILTERS['threat-intel'];
const BASE = { categories: S.categories };
export default function ThreatIntel() {
  return <NewsScreen base={BASE} quickCategories={S.categories} intro="Threat actors, campaigns, malware, ransomware, zero-days and breaches." />;
}
