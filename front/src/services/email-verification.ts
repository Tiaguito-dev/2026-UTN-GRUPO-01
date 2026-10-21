import { requestJson } from "./http";

export function verifyEmail(token: string): Promise<void> {
  return requestJson<void>("/auth/verify-email", { method: "POST", body: { token } });
}

export async function resendVerification(email: string): Promise<string> {
  const response = await requestJson<{ message: string }>("/auth/resend-verification", {
    method: "POST",
    body: { email: email.trim().toLowerCase() },
  });
  return response.message;
}
