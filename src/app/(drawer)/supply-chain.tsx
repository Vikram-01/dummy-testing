
import { SECTION_FILTERS } from '../../lib/config/categories';
import { NewsScreen } from '../../ui/screens/NewsScreen';

const S = SECTION_FILTERS['supply-chain'];
const BASE = { categories: S.categories };
export default function SupplyChain() {
  return <NewsScreen base={BASE} quickCategories={S.categories} />;
}
