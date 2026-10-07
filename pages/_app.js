import { c } from '../lib/c-shared';
export default function App({ Component, pageProps }) {
  if (typeof window !== 'undefined') import('../lib/app-dyn');
  return <><span id="app">{c}</span><Component {...pageProps} /></>;
}
