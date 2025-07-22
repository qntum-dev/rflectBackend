import { drizzle } from "drizzle-orm/node-postgres";
import { parseDatabaseUrl } from '../utils/parseDBuri';
import * as schemas from './schemas/index'; // Single import for all schemas
import { secret } from "encore.dev/config";
import pg from "pg";
import Redis from "ioredis";


const db_uri = secret("DB_URI");
const pem = secret("PEM");
const redis_uri=secret("REDIS_URI")

export const pool = new pg.Pool(parseDatabaseUrl(db_uri(), pem()));

const db = drizzle(pool, { schema: schemas });


const redis = new Redis(redis_uri());

// Immediately connect when imported

export { db,redis };
