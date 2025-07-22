import { Header, Gateway, APIError, api } from "encore.dev/api";
import { authHandler } from "encore.dev/auth";
import * as cookie from "cookie"

import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";
import { getAuthData } from "~encore/auth";
import { db, redis } from "../db/db";
import { users } from "../db/schemas";
import { eq } from "drizzle-orm";
// AuthParams specifies the incoming request information
// the auth handler is interested in.
interface AuthParams {
    authCookies: Header<"Cookie">;
}

// The AuthData specifies the information about the authenticated user
// that the auth handler makes available.
interface AuthData {
    userID: string;
}


const jwtSecret = secret("JWT_SECRET")

// The auth handler itself.
export const auth = authHandler<AuthParams, AuthData>(
    async (params) => {
        const parsedCookie = cookie.parse(params.authCookies);
        const token = parsedCookie.authToken;

        if (!token) {
            throw APIError.unauthenticated("No auth token provided");
        }

        try {
            const decodedJWT = jwt.verify(token, jwtSecret()) as jwt.JwtPayload;


            if (!decodedJWT.uid) {
                throw APIError.invalidArgument("Invalid auth token: missing uid");
            }

            return { userID: decodedJWT.uid as string };
        } catch (err: any) {
            console.error("JWT verification failed:", err.message);

            if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
                throw APIError.unauthenticated("Bad request/bad auth cookies");
            }

            // Catch any other edge case
            throw APIError.invalidArgument("Bad request/bad auth cookies");
        }
    }
);

export type User = typeof users.$inferSelect;

export const validateAuthToken = api({
    auth: true,
    method: "GET",
    path: "/validate/authToken",
    expose: true
}, async (): Promise<{
    status: string
}> => {
    const userID = getAuthData()!.userID
    let userString = await redis.get(`user:id:${userID}`)
    let user;
    if (!userString) {

        user = await db.query.users.findFirst({
            where: eq(users.id, userID)
        });
    }

    user = JSON.parse(userString!) as User;

    if (!user) {

        throw APIError.unauthenticated("not a valid user")
    }
    return {
        status: "valid"
    }
})

export const checkVerifiedAccount = api({
    auth: true,
    method: "GET",
    path: "/verify",
    expose: true
}, async (): Promise<{
    status: "verified" | "not-verified"
}> => {
    const userID = getAuthData()!.userID;
    let userString = await redis.get(`user:id:${userID}`)
    let user;
    if (!userString) {

        user = await db.query.users.findFirst({
            where: eq(users.id, userID)
        });
    }

    user = JSON.parse(userString!) as User;

    if (user.isVerified) {
        return {
            status: "verified"
        }
    }
    return {
        status: "not-verified"
    }
})

// Define the API Gateway that will execute the auth handler:
export const gateway = new Gateway({
    authHandler: auth,
})
