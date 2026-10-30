
import { NewsScreen } from '../../ui/screens/NewsScreen';

const BASE = { group: 'research' as const };
export default function Research() {
  return <NewsScreen base={BASE} intro="Original research from vendor and lab teams: Project Zero, Talos, Unit 42, Mandiant, SANS ISC, PortSwigger, Wiz and more." />;
}
