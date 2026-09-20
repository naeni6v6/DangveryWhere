import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ url }) => {
  // Keep older installed apps on mobile while ordinary visits open the web home.
  const home = url.searchParams.get('source') === 'pwa' ? '/mobile' : '/web';
  redirect(307, `${home}${url.search}`);
};
