import { api } from "encore.dev/api";

export const checkHealth = api({
    auth: false,
    method: "GET",
    expose: true

}, async (): Promise<{
    status: "ok" | "error"
    message: string
}> => {
    return {
        status: "ok",
        message: "All good"
    }
})