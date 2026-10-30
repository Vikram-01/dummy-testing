
import { SECTION_FILTERS } from '../../lib/config/categories';
import { NewsScreen } from '../../ui/screens/NewsScreen';

const S = SECTION_FILTERS.appsec;
const BASE = { categories: S.categories };
export default function AppSec() {
  return <NewsScreen base={BASE} quickCategories={S.categories} />;
}
