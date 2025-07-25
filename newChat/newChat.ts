
import { api, APIError, Query, StreamInOut } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
import { db, redis } from "../db/db";
import { chatParticipants, chats, messages, User, users } from "../db/schemas";
import { aliasedTable, and, desc, eq, inArray, InferSelectModel, lt, ne, sql } from "drizzle-orm";
import { getIDdata } from "../utils/redisHelpers";
import { z } from "zod";
import log from "encore.dev/log";
import { findOrCreateDM, getChatListData } from "./helpers/getters";
import { chatData, ChatListHandshake, ChatListRes, ChatListStreamReq, ChatListStreamRes, HandshakeRequest, NewChatRequest, ReceiveMessage, SendMessage, StartChatRequest, startChatSchema } from "./types";
import cron from 'node-cron';



const chatStreams: Map<
    string, // chatID
    Map<string, Set<StreamInOut<ReceiveMessage, SendMessage>>> // userID -> Set of active streams
> = new Map();

const allowedUsersForSession: Map<string, [string, string]> = new Map(); // chatID -> [userA, userB]




export const getMessages = api({
    method: "GET",
    auth: true,
    expose: true,
    path: "/getMessages/:chatID",
}, async (params: { chatID: string, before?: Query<string>, limit?: Query<string> }): Promise<{ messages: SendMessage[] }> => {
    const chatID = params.chatID;

    const limit = params.limit ? parseInt(params.limit) : 20; // default 20 messages per page
    const beforeTimestamp = params.before ? parseInt(params.before) : Date.now();

    const redisKey = `chat:${chatID}:messages`;

    // 🧠 Fetch messages from Redis ZSET
    const rawMessages = await redis.zrevrangebyscore(
        redisKey,
        `(${beforeTimestamp}`, // strict less than
        "-inf",
        "LIMIT",
        0,
        limit
    );

    let msgs: SendMessage[];

    if (rawMessages.length > 0) {


        msgs = rawMessages.map((raw) => {
            const parsed = JSON.parse(raw) as SendMessage;

            return {
                id: parsed.id,
                senderId: parsed.senderId,
                content: parsed.content,
                timestamp: parsed.timestamp,
            };
        });
    } else {
        // 🔥 Step 2: Fallback to Database
        const rawMessages = await db
            .select({
                id: messages.id,
                createdAt: messages.createdAt,
                senderId: messages.senderId,
                content: messages.content,
            })
            .from(messages)
            .where(and(
                eq(messages.chatId, chatID),
                lt(messages.createdAt, new Date(beforeTimestamp))
            ))
            .orderBy(desc(messages.createdAt))
            .limit(limit);

        msgs = rawMessages.map(msg => ({
            id: msg.id,
            timestamp: msg.createdAt.getTime(),
            senderId: msg.senderId,
            content: msg.content,
        }));
    }

    return { messages: msgs };
});


export const privateChat = api.streamInOut<HandshakeRequest, ReceiveMessage, SendMessage>(
    { expose: true, path: "/private-chat" },
    async (handshake, stream) => {
        const { chatID, userID } = handshake;

        const allowed = allowedUsersForSession.get(chatID);
        if (!allowed) {
            await stream.send({ id: crypto.randomUUID(), senderId: "System", content: "Chat session not found", timestamp: Date.now() });
            await stream.close();
            return;
        }

        const [userA, userB] = allowed;
        const otherUserID = userID === userA ? userB : userA;

        if (![userA, userB].includes(userID)) {
            await stream.send({ id: crypto.randomUUID(), senderId: "System", content: "Unauthorized", timestamp: Date.now() });
            await stream.close();
            return;
        }

        if (!chatStreams.has(chatID)) {
            chatStreams.set(chatID, new Map());
        }
        if (!chatStreams.get(chatID)!.has(userID)) {
            chatStreams.get(chatID)!.set(userID, new Set());
        }
        chatStreams.get(chatID)!.get(userID)!.add(stream);

        try {
            for await (const msg of stream) {
                const chatMessage = { id: crypto.randomUUID(), senderId: userID, content: msg.message, timestamp: Date.now() };
                await redis.zadd(`chat:${chatID}:messages`, 'NX', chatMessage.timestamp, JSON.stringify(chatMessage));

                const senderStreams = chatStreams.get(chatID)?.get(userID) ?? new Set();
                const receiverStreams = chatStreams.get(chatID)?.get(otherUserID) ?? new Set();

                for (const s of senderStreams) {
                    await s.send(chatMessage);
                }
                for (const s of receiverStreams) {
                    await s.send(chatMessage);
                }

                const receiverChatlistStream = chatListStreams.get(otherUserID);
                if (receiverChatlistStream) {
                    const user = await getIDdata("user", userID);
                    await receiverChatlistStream.send({
                        data: {
                            chat_id: chatID,
                            latestMessage: chatMessage.content,
                            latestMessageTime: chatMessage.timestamp,
                            receiverId: userID,
                            receiverName: user.name
                        },
                        noData: false
                    });
                }
            }
        } catch (err) {
            // handle error if needed
        } finally {
            const userStreams = chatStreams.get(chatID)?.get(userID);
            userStreams?.delete(stream);
            if (userStreams?.size === 0) {
                chatStreams.get(chatID)?.delete(userID);
            }
            if (chatStreams.get(chatID)?.size === 0) {
                chatStreams.delete(chatID);
            }
        }
    }
);



const chatListStreams: Map<string, StreamInOut<ChatListStreamReq, ChatListStreamRes>> = new Map();



// const chatListStreams: Map<string, StreamInOut<chatData, ChatListRes>> = new Map();




export const chatListStream = api.streamInOut<ChatListHandshake, ChatListStreamReq, ChatListStreamRes>(
    { path: "/chatlist/stream", expose: true },
    async (handshake, stream) => {
        const { userID } = handshake;


        if (!chatListStreams.has(userID)) {
            chatStreams.set(userID, new Map());
        }
        chatListStreams.set(userID, stream);

        log.info("User connected to chat list stream", { userID });



        try {
            for await (const msg of stream) {
                log.info("msg", msg)
                const receiver = await getIDdata("user", msg.receiverId);
                if (!receiver.id) {
                    await stream.send({
                        data: null,
                        noData: true
                    })
                    await stream.close()
                }
                // const dm = await findOrCreateDM(userID, msg.receiverId);


                if (!chatListStreams.has(msg.receiverId)) {
                    chatStreams.set(msg.receiverId, new Map());
                }

                const receiverChatlistStream = chatListStreams.get(msg.receiverId);

                await stream.send({
                    data: msg,
                    noData: false
                })



            }
        } catch (err) {
            // Handle stream failure
        } finally {
            chatStreams.get(userID)?.delete(userID);


        }
    }
)


export const startChat = api<StartChatRequest, { chatID: string, type: "new" | "existing", receiverId: string, receiverName: string }>(
    { path: "/start-chat", method: "POST", auth: true, expose: true },
    async (input) => {
        const parsed = startChatSchema.safeParse(input);
        if (!parsed.success) {
            throw APIError.invalidArgument(parsed.error.errors[0].message);
        }
        const { userB } = parsed.data;

        const isCurrentUser = getAuthData()!.userID == userB
        if (isCurrentUser) {
            throw APIError.permissionDenied("you cannot chat with yourself");
        }
        const receiver = await getIDdata("user", userB);

        if (!receiver) {
            throw APIError.notFound("this user is not found");

        }

        const chat = await findOrCreateDM(getAuthData()!.userID, userB);


        allowedUsersForSession.set(chat.chat_id, [getAuthData()!.userID, userB]);
        return { chatID: chat.chat_id, type: chat.type, receiverId: chat.receiverId, receiverName: chat.receiverName };
    }
);

export const newChat = api<NewChatRequest, { chat_id: string, receiverId: string, receiverName: string, type: "existing" | "new" }>({
    method: "GET",
    expose: true,
    path: "/newChat",
    auth: true
}, async ({ email }) => {
    const receiver = await getIDdata("user", email, "email")
    if (!receiver) {
        throw APIError.notFound("email not found")
    }


    const { chatID: chat_id, receiverId, receiverName, type } = await startChat({
        userB: receiver.id
    })
    return {
        chat_id,
        receiverId,
        receiverName,
        type
    }
})




export const getChatList = api<{
    before: Query<string>,
    limit: Query<number>
}, ChatListRes>({
    auth: true,
    expose: true,
    method: "GET",
    path: "/chat/getAllChats"
}, async ({ before, limit }) => {
    const userID = getAuthData()!.userID;

    const chatList = await getChatListData(userID, before, limit);
    log.info("Chat list fetched", { userID, chatCount: chatList.length });
    if (chatList.length < 1) {
        return {
            chatListData: [],
            noData: true
        }
    }

    return {
        chatListData: chatList,
        noData: false
    }

})






// cron.schedule('*/1 * * * *', async () => {
//     log.info("Running message sync job...");

//     await syncMessagesFromRedisToDB();
// });


async function syncMessagesFromRedisToDB() {
    try {
        const keys = await redis.keys('chat:*:messages');
        const keepMessageLimit = 20;
        for (const key of keys) {
            const chatID = key.split(":")[1];

            const lastSyncedTimestampStr = await redis.get(`last_synced_timestamp:${chatID}`);

            const lastSyncedTimestamp = lastSyncedTimestampStr ? parseInt(lastSyncedTimestampStr) : 0;

            const rawMessages = await redis.zrangebyscore(key, `(${lastSyncedTimestamp}`, "+inf");

            if (rawMessages.length === 0) continue;

            const preparedMessages = rawMessages.map((raw) => {
                const parsed = JSON.parse(raw) as SendMessage;
                log.info(raw)

                return {
                    chatId: chatID,
                    senderId: parsed.senderId,
                    content: parsed.content,
                    createdAt: new Date(parsed.timestamp),
                    updatedAt: new Date(parsed.timestamp),
                };
            });

            await db.insert(messages).values(preparedMessages);

            const maxTimestamp = Math.max(...preparedMessages.map(msg => msg.createdAt.getTime()));
            await redis.set(`last_synced_timestamp:${chatID}`, maxTimestamp.toString());
            // 🧹 Keep only the last 20 messages in cache
            const totalMessages = await redis.zcard(key);

            if (totalMessages > keepMessageLimit) {
                await redis.zremrangebyrank(key, 0, totalMessages - keepMessageLimit - 1); // Remove older messages
            }
        }

    } catch (err) {
        console.error("❌ Error syncing messages from Redis to DB:", err);
    }
}
