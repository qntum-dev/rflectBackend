import { v2 as cloudinary, UploadApiResponse } from 'cloudinary';
import { api, APIError } from 'encore.dev/api';
import { secret } from 'encore.dev/config';
import { getAuthData } from '~encore/auth';
import { nanoid } from 'nanoid';
import { getIDdata } from '../utils/redisHelpers';
import { db, redis } from '../db/db';
import { User, users } from '../db/schemas';
import { eq } from 'drizzle-orm';

const cloud_name = secret("CLOUDINARY_CLOUD_NAME")();
const api_key = secret("CLOUDINARY_API_KEY")();
const api_secret = secret("CLOUDINARY_API_SECRET")();

cloudinary.config({
    cloud_name,
    api_key,
    api_secret,
});

interface Req {
    base64: string; // ✅ corrected
}

interface Res {
    url: string;
}

export const uploadProfileImage = api<Req, Res>({
    auth: true,
    expose: true,
    method: "POST",
    path: "/media/uploadProfileImage"
}, async ({ base64 }) => { // ✅ corrected
    const auth = getAuthData();
    if (!auth) {
        throw APIError.unauthenticated("Sorry, you are not authorized to perform this action");
    }

    const userID = auth.userID;
    const user = await getIDdata("user", userID);
    if (!user) {
        throw APIError.notFound("User not found");
    }

    const fileName = `${user.id}-${nanoid(6)}`;

    const buffer = Buffer.from(base64, "base64"); // ✅ convert for upload

    const uploadResult = await new Promise<UploadApiResponse>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
            {
                public_id: `profile_images/${fileName}`,
                folder: "profile_images",
                resource_type: "image",
                transformation: [
                    { width: 512, height: 512, crop: "fill", gravity: "face" },
                    { radius: "max" } // circular crop
                ],
            },
            (error, result) => {
                if (error) {
                    reject(APIError.internal(`Upload failed: ${error.message}`));
                } else if (!result) {
                    reject(APIError.internal("Upload failed: empty result"));
                } else {
                    resolve(result);
                }
            }
        );
        uploadStream.end(buffer);
    });

    const r = await db.update(users)
        .set({ profileImgUrl: uploadResult.secure_url })
        .where(eq(users.id, userID)).returning();

    await redis.set(`user:id:${userID}`, JSON.stringify(r[0]))


    return { url: uploadResult.secure_url };
});
