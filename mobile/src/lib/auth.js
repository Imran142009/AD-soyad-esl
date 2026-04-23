import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";
import { api, saveToken } from "./api";

WebBrowser.maybeCompleteAuthSession();

// REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
export async function loginWithEmergentGoogle() {
  // Return URL for the in-app browser to detect completion
  const returnUrl = Linking.createURL("auth-callback");
  const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(returnUrl)}`;

  const result = await WebBrowser.openAuthSessionAsync(authUrl, returnUrl);
  if (result.type !== "success" || !result.url) {
    return { ok: false, reason: result.type };
  }

  // The return URL looks like: <returnUrl>#session_id=XXX
  const url = result.url;
  const fragment = url.split("#")[1] || "";
  const params = new URLSearchParams(fragment);
  const sessionId = params.get("session_id");
  if (!sessionId) return { ok: false, reason: "no_session_id" };

  const { data } = await api.post("/auth/session", { session_id: sessionId });
  if (!data?.session_token) return { ok: false, reason: "no_token_returned" };
  await saveToken(data.session_token);
  return { ok: true, user: data.user };
}
