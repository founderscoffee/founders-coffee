import { createFileRoute } from '@tanstack/react-router';

import { AdminLogin } from '../features/auth/AdminLogin';

export const Route = createFileRoute('/login')({ component: AdminLogin });
