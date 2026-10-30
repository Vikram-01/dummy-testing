
import { SECTION_FILTERS } from '../../lib/config/categories';
import { NewsScreen } from '../../ui/screens/NewsScreen';

const S = SECTION_FILTERS.cloud;
const BASE = { categories: S.categories };
export default function CloudSec() {
  return <NewsScreen base={BASE} quickCategories={S.categories} />;
}
