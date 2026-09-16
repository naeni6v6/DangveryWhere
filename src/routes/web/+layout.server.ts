import { loadAppData } from '$lib/server/account';
import type { LayoutServerLoad } from './$types';

// Every web(PC) page shares the same places, dog profile and favorites.
export const load: LayoutServerLoad = ({ locals }) => loadAppData(locals);
