import { authenticateWithPassword } from '$lib/server/password-auth';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = (event) => authenticateWithPassword(event, 'login');
