import { aliasedTable, and, desc, eq, inArray, lt, ne, or, sql } from "drizzle-orm";
import { db, redis } from "../../db/db";
import { chatParticipants, chats, messages, users } from "../../db/schemas";
import { chatData, ChatListData, SendMessage } from "../types";
import { getIDdata } from "../../utils/redisHelpers";
import log from "encore.dev/log";

const userPairKey = (a: string, b: string) => {
    const [id1, id2] = [a, b].sort(); // sort for consistency
    return `dm:${id1}:${id2}`;
};

export async function findOrCreateDM(user1Id: string, user2Id: string): Promise<{
    chat_id: string
    receiverId: string
    receiverName: string
    type: "existing" | "new"
}> {


    const cacheKey = userPairKey(user1Id, user2Id);
    const receiver = await getIDdata("user", user2Id);
    const cachedChatId = await redis.get(cacheKey);
    if (cachedChatId) {
        return { chat_id: cachedChatId, type: "existing", receiverId: user2Id, receiverName: receiver.name };
    }

    const dmChats = await db
        .select({
            chatId: chatParticipants.chatId,
            // participantCount: count(chatParticipants.userId)
        })
        .from(chatParticipants)
        .where(inArray(chatParticipants.userId, [user1Id, user2Id]))
        .groupBy(chatParticipants.chatId)
        .having(sql`count(${chatParticipants.userId}) = 2`)
        .limit(1);

    // If a chat already exists, return it
    if (dmChats.length > 0) {
        const chatId = dmChats[0].chatId;
        await redis.set(cacheKey, chatId); // cache it
        console.log("user1Id: ", user1Id, "user2Id: ", user2Id);

        return { chat_id: chatId, type: "existing", receiverId: user2Id, receiverName: receiver.name };
    }



    // Step 2: Create a new DM chat if not found
    const [newChat] = await db.insert(chats).values({
        type: "dm",
    }).returning();


    log.info("Creating new DM chat", { chatId: newChat.id, user1Id, user2Id });

    const isReceiver = await db.query.users.findFirst({
        where: eq(users.id, user2Id),
    });
    if (!isReceiver) {
        throw new Error(`User ${user2Id} does not exist in DB`);
    }

    const [newChatParticipants] = await db.insert(chatParticipants).values([
        { chatId: newChat.id, userId: user1Id },
        { chatId: newChat.id, userId: user2Id },
    ]).returning();
    log.info("New chat participants added", newChatParticipants)
    if (!newChatParticipants) {
        throw new Error("Failed to create chat participants");
    }

    log.info("chatParticipants created", newChatParticipants);

    await redis.set(cacheKey, newChat.id);

    await updateChats(user1Id);



    // Return the new chat
    return { chat_id: newChat.id, type: "new", receiverId: user2Id, receiverName: receiver.name };
}



export async function getUserChats(userId: string) {
    return db.select()
        .from(chatParticipants)
        .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
        .where(eq(chatParticipants.userId, userId));
}


const receiver = aliasedTable(chatParticipants, "receiver");
const receiverUser = aliasedTable(users, "receiver_user");



// export async function getChatListData(userId: string, before?: string, limit?: number): Promise<ChatListData[]> {
//     const pageSize = limit ? limit : 20;

//     const latestMessages = db
//         .selectDistinctOn([messages.chatId], {
//             chatId: messages.chatId,
//             content: messages.content,
//             createdAt: messages.createdAt,
//         })
//         .from(messages)
//         .where(eq(messages.isDeleted, false))
//         .orderBy(messages.chatId, desc(messages.createdAt))
//         .as('latest_messages');

//     const filters = [
//         eq(chatParticipants.userId, userId),
//         before ? lt(latestMessages.createdAt, new Date(before)) : undefined,
//     ].filter(Boolean); // Remove undefined


//     // Complete the query with ordering and limit
//     const rows = await db
//         .select({
//             chat: chats,
//             receiverId: receiver.userId,
//             receiverName: receiverUser.name
//         })
//         .from(chatParticipants)
//         .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
//         .innerJoin(
//             receiver,
//             and(
//                 eq(chatParticipants.chatId, receiver.chatId),
//                 ne(receiver.userId, userId)
//             )
//         )
//         .innerJoin(receiverUser, eq(receiver.userId, receiverUser.id))
//         .leftJoin(latestMessages, eq(chats.id, latestMessages.chatId))
//         .where(and(...filters))
//         .orderBy(desc(latestMessages.createdAt))
//         .limit(pageSize);

//     const chatData = await Promise.all(
//         rows.map(async (row) => {
//             const redisKey = `chat:${row.chat.id}:messages`;

//             // 🧠 Fetch messages from Redis ZSET
//             const rawMessages = await redis.zrevrange(redisKey, 0, 0);
//             const parsed = JSON.parse(rawMessages[0]) as SendMessage;

//             return {
//                 chat_id: row.chat.id,
//                 receiverId: row.receiverId,
//                 receiverName: row.receiverName,
//                 latestMessage: parsed.content || "",
//                 latestMessageTime: parsed.timestamp,
//             };
//         })
//     );

//     return chatData;
// }

export async function getChatListData(userId: string, before?: string, limit?: number): Promise<ChatListData[]> {
    const pageSize = limit ? limit : 20;

    const filters = [
        eq(chatParticipants.userId, userId),
    ].filter(Boolean);

    const rows = await db
        .select({
            chat: chats,
            receiverId: receiver.userId,
            receiverName: receiverUser.name
        })
        .from(chatParticipants)
        .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
        .innerJoin(
            receiver,
            and(
                eq(chatParticipants.chatId, receiver.chatId),
                ne(receiver.userId, userId)
            )
        )
        .innerJoin(receiverUser, eq(receiver.userId, receiverUser.id))
        .where(and(...filters))
        .orderBy(desc(chats.updatedAt))
        .limit(pageSize);

    const chatData = await Promise.all(
        rows.map(async (row) => {
            const redisKey = `chat:${row.chat.id}:messages`;

            const rawMessages = await redis.zrevrange(redisKey, 0, 0);

            let latestMessage = "";
            let latestMessageTime: number | null = null;

            if (rawMessages.length > 0) {
                const parsed = JSON.parse(rawMessages[0]) as SendMessage;
                latestMessage = parsed.content ?? "";
                latestMessageTime = parsed.timestamp ?? null;
            }

            return {
                chat_id: row.chat.id,
                receiverId: row.receiverId,
                receiverName: row.receiverName,
                latestMessage,
                latestMessageTime,
            };
        })
    );

    return chatData;
}



export async function updateChats(userId: string): Promise<chatData[]> {

    const cacheKey = `user:id:${userId}:chats`;

    // Find all chat IDs the user participates in
    const rows = await db
        .select({
            chat: chats,
            receiverId: receiver.userId,
            receiverName: receiverUser.name, // ← grab the name!

        })
        .from(chatParticipants)
        .innerJoin(chats, eq(chatParticipants.chatId, chats.id))
        .innerJoin(
            receiver,
            and(
                eq(chatParticipants.chatId, receiver.chatId),
                ne(receiver.userId, userId)
            )
        ).innerJoin(receiverUser, eq(receiver.userId, receiverUser.id)) // ← join to get name
        .where(eq(chatParticipants.userId, userId))

    // Map rows to chatData[]
    const chatData = rows.map(row => ({
        chat_id: row.chat.id,
        receiverId: row.receiverId,
        receiverName: row.receiverName
    }));

    await redis.set(cacheKey, JSON.stringify(chatData), 'EX', 300);

    return chatData
}