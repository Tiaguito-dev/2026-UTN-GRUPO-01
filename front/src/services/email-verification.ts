import { requestJson } from "./http";
import { messageSchema, parseResponse } from "./schemas";

export async function verifyEmail(token: string): Promise<void> {
  await requestJson("/auth/verify-email", { method: "POST", body: { token } });
}

export async function resendVerification(email: string): Promise<string> {
  const response = parseResponse(messageSchema, await requestJson("/auth/resend-verification", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
  }));
  return response.message;
}
