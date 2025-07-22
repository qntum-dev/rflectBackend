import { eq } from "drizzle-orm";
import { db, redis } from "../db/db";
import { chats, messages, users } from "../db/schemas";

const DEFAULT_TTL = 60 * 60 * 24 * 7; // 7 days

type Chat = typeof chats.$inferSelect;
type Message = typeof messages.$inferSelect;
type User = typeof users.$inferSelect;

// Map entity type to its result type
type EntityDataMap = {
  user: User;
  chat: Chat;
  message: Message;
};

type Entity = keyof EntityDataMap;

// === Entity configuration with column mapping ===
const entityConfig = {
  user: {
    table: users,
    columns: {
      id: users.id,
      email: users.email,
      username: users.username
      // Add other possible ID columns here if needed
    }
  },
  chat: {
    table: chats,
    columns: {
      id: chats.id,
      // Add other possible ID columns here if needed
    }
  },
  message: {
    table: messages,
    columns: {
      id: messages.id,
      // Add other possible ID columns here if needed
    }
  }
} as const;

/**
 * Retrieves entity data by ID with Redis caching
 * @param entity The entity type to fetch (user, chat, message)
 * @param id The ID value to look up
 * @param columnName The column name to search by (defaults to "id")
 * @returns The entity data or null if not found
 */
export async function getIDdata<E extends Entity>(
  entity: E,
  id: string,
  columnName: string = "id"
): Promise<EntityDataMap[E]> {
  const cacheKey = `${entity}:${columnName}:${id}`;

  // Try to get from cache first
  const cachedData = await redis.get(cacheKey);
  if (cachedData) {
    try {
      return JSON.parse(cachedData) as EntityDataMap[E];
    } catch {
      // If cache is corrupted or invalid, fallback to DB
    }
  }

  // Get the entity configuration
  const config = entityConfig[entity];
  const idColumn = config.columns[columnName as keyof typeof config.columns];

  if (!idColumn) {
    throw new Error(`Invalid column name "${columnName}" for entity "${entity}"`);
  }

  // Query the database
  const result = await db
    .select()
    .from(config.table)
    .where(eq(idColumn, id))
    .limit(1);

  const data = result[0] as EntityDataMap[E];
  // Cache the result
  await redis.set(cacheKey, JSON.stringify(data), 'EX', DEFAULT_TTL);
  return data;
  // if (result.length > 0) {
  // }

}