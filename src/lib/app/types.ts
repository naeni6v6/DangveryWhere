import type { loadAppData } from '$lib/server/account';

export type AppData = Awaited<ReturnType<typeof loadAppData>>;
