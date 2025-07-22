import { defineConfig } from 'drizzle-kit';
import { parseDatabaseUrl } from './utils/parseDBuri';

export default defineConfig({
  out: './drizzle',
  schema: './db/schemas',
  dialect: 'postgresql',
  verbose: true,
  strict: true,
  dbCredentials: parseDatabaseUrl(process.env.DB_URI!, process.env.PEM!),

});
