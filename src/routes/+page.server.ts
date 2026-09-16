import { loadAppData } from '$lib/server/account';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = ({ locals }) => loadAppData(locals);
