import { Query, StreamInOut } from "encore.dev/api";
import { IsEmail } from "encore.dev/validate";
import { z } from "zod";

export interface ChatSession {
    chatID: string; // Unique chat ID
    userA: string;     // UserID of participant 1
    userB: string;     // UserID of participant 2
}

export interface HandshakeRequest {
    chatID: string;
    userID: string;
}

export interface ReceiveMessage {
    message: string;
}

export interface SendMessage {
    id: string;
    senderId: string;
    content: string | null;
    timestamp: number;
}


export interface StartChatRequest {
    userB: string;
}

export interface NewChatRequest {
    email: Query<string> & IsEmail
}

export const startChatSchema = z.object({
    userB: z.string().uuid("Invalid userB format"),
});



export type chatData = {
    chat_id: string;
    receiverId: string;
};

export type ChatListHandshake = {
    userID: string; // The user ID initiating the handshake  
};

export type ChatListStreamReq = {
    chat_id: string;
    receiverId: string;
    receiverName: string;
    latestMessage: string | null;
    latestMessageTime: number | null;
};



export type ChatListData = {
    chat_id: string;
    receiverId: string;
    receiverName: string;
    latestMessage: string | null;
    latestMessageTime: number | null;
}
export type ChatListStreamRes = {
    data: ChatListData | null;
    noData: boolean;
}
export type ChatListRes = {
    chatListData: ChatListData[];
    noData: boolean;
};

