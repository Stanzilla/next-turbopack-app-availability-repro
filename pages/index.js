import { a } from '../lib/a-page-only';
import { b } from '../lib/b-boundary';
import { c } from '../lib/c-shared';
import { d } from '../lib/d-boundary';
import { e } from '../lib/e-page';
export default function Home() {
  if (typeof window !== 'undefined') import('../lib/page-dyn');
  return <p id="out">{[a, b, c, d, e].join(' ')}</p>;
}
