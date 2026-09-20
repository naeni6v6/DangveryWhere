import { loadAppData } from '$lib/server/account';
import { selectRegion } from '$lib/server/regionSelection';
import type { LayoutServerLoad } from './$types';

export const load: LayoutServerLoad = ({ locals, url, cookies }) =>
  loadAppData(locals, selectRegion(url, cookies));
