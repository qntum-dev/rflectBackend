import { api } from "encore.dev/api";
import { getAuthData } from "~encore/auth";
// import { user } from "~encore/clients";

export const getToken = api({
    expose: true,
    auth: true,
    method: "GET",
    path: "/testAuth/getUID"
}, async (): Promise<{ uid: string }> => {
    const userData = getAuthData()!;

    return {
        uid: `${userData.userID}`
    }
})