import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

export default {
  schema: ['./database/schemas/main.ts', './database/schemas/tenant.ts', './database/schemas/firewall.ts', './database/schemas/edr.ts', './database/schemas/reports.ts', './database/schemas/alerts-incidents.ts'],
  out: './database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
} satisfies Config;