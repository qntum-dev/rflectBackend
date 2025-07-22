import { api, Header } from "encore.dev/api";
import { secret } from "encore.dev/config";
import jwt from "jsonwebtoken";

type AuthenticateUserParams = {
  authorisation: Header<"Set-Cookie">
}

type CookieValue = {
  uid: string
}

const jwt_secret = secret("JWT_SECRET");

export const set = api<CookieValue, AuthenticateUserParams>(
  { method: "GET", path: "/setCookie", expose: true },
  async ({ uid }) => {
    const token = jwt.sign({ uid }, jwt_secret(), {
      expiresIn: "7d"
    })


    return {
      authorisation: `authToken=${token}; HttpOnly;`
    }
  },
)
