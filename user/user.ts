import { api, APIError, Header, Query } from "encore.dev/api";
import { MinLen, IsEmail } from "encore.dev/validate";
import { db, redis } from "../db/db";
import { users } from "../db/schemas/userSchema";
import { eq, lt } from "drizzle-orm";
import { validatePassword } from "../utils/validate";
import { compare, genSalt, hash } from "bcrypt-ts";
import jwt from "jsonwebtoken";
import { secret } from "encore.dev/config";
import cron from 'node-cron';
import { userOTPs } from "../db/schemas/authSchema";
import { nanoid } from "nanoid";
import { z } from "zod";
import { getAuthData } from "~encore/auth";
import { getIDdata } from "../utils/redisHelpers";
import { IncomingMessage } from "http";

interface ReqBody {
    name: string & MinLen<1>;
    email: string & IsEmail;
    about?: string;
    password: string & MinLen<8>;
}

interface Response {
    userData: PublicUser;
    authorisation: Header<"Set-Cookie">
}
const jwt_secret = secret("JWT_SECRET");



cron.schedule('0 3 * * *', async () => {
    const now = new Date();

    await db.delete(userOTPs).where(lt(userOTPs.expiresAt, now));

});


export const create = api<ReqBody, Response>({
    method: "POST",
    expose: true,
    auth: false,
    path: "/user/create"
}, async ({ email, name, about, password }): Promise<Response> => {

    const existingEmail = await db.query.users.findMany({
        where: eq(users.email, email)
    });

    if (existingEmail.length > 0) {
        throw APIError.alreadyExists("user already exists")
    }
    const valid = validatePassword(password, email)

    if (valid !== "ok") {
        throw APIError.invalidArgument(valid)

    }

    const salt = await genSalt(10);
    const hashedPassword = await hash(password, salt);


    const [user] = await db.insert(users).values({
        username: `${name.split(" ")[0]}-${nanoid(6)}`,
        name,
        email,
        about,
        passwordHash: hashedPassword,
        profileImgUrl: null,
    }).returning();


    //How the subscribe/unsubscribe to emails work if I implement scheduled mails

    const token = jwt.sign({ uid: user.id }, jwt_secret(), {
        expiresIn: "7d"
    })
    await redis.set(`user:id:${user.id}`, JSON.stringify(user))

    const userData: PublicUser = {
        id: user.id,
        username: user.username,
        name: user.name,
        about: user.about,
        email: user.email,
        profileImgUrl: user.profileImgUrl || null,
        isVerified: user.isVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
    }
    // await otp.sendVerifyOTP()



    return {
        userData,
        authorisation: `authToken=${token}; Path=/; HttpOnly; Secure; SameSite=none; Domain=rflectbackend.onrender.com`
    };

});

interface LoginReq { email: string & IsEmail, password: string & MinLen<8> }

export const login = api<LoginReq, Response>({
    method: "POST",
    path: "/user/login",
    expose: true,
    auth: false
}, async ({ email, password }) => {
    const find_user = await db.query.users.findFirst({
        where: eq(users.email, email)
    });


    if (!find_user) {
        throw APIError.notFound("User not found")
    }
    await redis.set(`user:id:${find_user.id}`, JSON.stringify(find_user))

    const verified = await compare(password, find_user.passwordHash);
    if (!verified) {
        throw APIError.unauthenticated("Invalid Password");
    }
    const token = jwt.sign({ uid: find_user.id }, jwt_secret(), {
        expiresIn: "7d"
    })
    const userData: PublicUser = {
        id: find_user.id,
        username: find_user.username,
        name: find_user.name,
        about: find_user.about,
        email: find_user.email,
        isVerified: find_user.isVerified,
        profileImgUrl: find_user.profileImgUrl || null,
        createdAt: find_user.createdAt,
        updatedAt: find_user.updatedAt
    }
    return {
        userData,
        authorisation: `authToken=${token}; Path=/; HttpOnly; Secure; SameSite=none; Domain=rflectbackend.onrender.com`

    }
})

// Extract the body from an incoming request.
function getBody(req: IncomingMessage): Promise<string> {
    return new Promise((resolve) => {
        const bodyParts: any[] = [];
        req
            .on("data", (chunk) => {
                bodyParts.push(chunk);
            })
            .on("end", () => {
                resolve(Buffer.concat(bodyParts).toString());
            });
    });
}

export const loginRaw = api.raw({
    method: 'POST',
    path: '/user/loginRaw',
    expose: true,
    auth: false,
}, async (req, resp) => {
    const body = await getBody(req);

    console.log(body);
    console.log(JSON.parse(body).email);
    console.log(JSON.parse(body).password);


    const find_user = await db.query.users.findFirst({
        where: eq(users.email, JSON.parse(body).email),
    });

    if (!find_user) {
        throw APIError.notFound('User not found');
    }

    await redis.set(`user:id:${find_user.id}`, JSON.stringify(find_user));

    const verified = await compare(JSON.parse(body).password, find_user.passwordHash);
    if (!verified) {
        throw APIError.unauthenticated('Invalid Password');
    }

    const token = jwt.sign({ uid: find_user.id }, jwt_secret(), {
        expiresIn: '7d',
    });

    const userData: PublicUser = {
        id: find_user.id,
        username: find_user.username,
        name: find_user.name,
        about: find_user.about,
        email: find_user.email,
        isVerified: find_user.isVerified,
        profileImgUrl: find_user.profileImgUrl || null,
        createdAt: find_user.createdAt,
        updatedAt: find_user.updatedAt,
    };

    resp.setHeader('Set-Cookie', `authToken=${token}; Path=/; HttpOnly; Secure; SameSite=none; Domain=rflectbackend.onrender.com`);

    // resp.statusCode = 204;
    resp.end(JSON.stringify({
        userData,
    }));

});

// const findUserSchema=z.string().email("Not a valid mail address")

export interface PublicUser {
    id: string;
    username: string;
    name: string;
    about: string | null;
    email: string;
    isVerified: boolean;
    createdAt: Date | null;
    updatedAt: Date | null;
    profileImgUrl: string | null;
}

export const findUser = api<{ id: Query<string> }, PublicUser>({
    method: "GET",
    auth: true,
    expose: true,
    path: "/getUser"
}, async ({ id }) => {
    const cacheKey = `user:id:${id}`
    const rawUser = await redis.get(cacheKey);
    const cachedUser = rawUser && JSON.parse(rawUser) as PublicUser;
    if (cachedUser) {

        return cachedUser
    }

    const user = await db.select().from(users).where(eq(
        users.id, id
    ))
    if (!(user.length > 0)) {
        throw APIError.notFound("User not found")
    }


    const { passwordHash, ...safeUser } = user[0];


    await redis.set(cacheKey, JSON.stringify(safeUser), "EX", 300)
    return safeUser
})

export const getCurrentUser = api({
    method: "GET",
    auth: true,
    expose: true,
    path: "/getCurrentUser"
}, async () => {
    const auth = getAuthData()!;
    const rawUser = await redis.get(auth.userID);
    const cachedUser = rawUser && JSON.parse(rawUser) as PublicUser;
    if (!cachedUser) {
        throw APIError.notFound("User not found")

    }

    return cachedUser
})


