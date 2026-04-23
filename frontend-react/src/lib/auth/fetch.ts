"use client";

import { API_AUTH_TOKEN_REFRESH } from "@/constants/api";
import { removeCookieValue } from "@/lib/auth";

type RefreshResponse = {
  access?: string;
  access_token?: string;
  refresh?: string;
  refresh_token?: string;
  detail?: string;
};

function notifySessionExpired(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("auth:session-expired"));
}

type ClearTokensOptions = {
  silent?: boolean;
};

function clearTokens(options: ClearTokensOptions = {}): void {
  removeCookieValue("access_token");
  removeCookieValue("access");
  removeCookieValue("refresh_token");
  removeCookieValue("refresh");
  removeCookieValue("profile");
  removeCookieValue("user");
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("access_token");
    window.localStorage.removeItem("refresh_token");
    window.localStorage.removeItem("profile");
    window.localStorage.removeItem("profile_cached_at");
    window.localStorage.removeItem("user");
  }
  if (!options.silent) {
    notifySessionExpired();
  }
}

async function refreshToken(): Promise<string | undefined> {
  const resp = await fetch(API_AUTH_TOKEN_REFRESH, {
    method: "POST",
    credentials: "include",
  });

  if (!resp.ok) {
    const data = (await resp.json().catch(() => ({}))) as RefreshResponse;
    throw new Error(data?.detail || "Refresh token invalid");
  }

  const data = (await resp.json()) as RefreshResponse;
  return data.access || data.access_token;
}

export async function authFetch(
  url: string,
  options: RequestInit = {},
  retry = true,
): Promise<Response> {
  const resp = await fetch(url, {
    ...options,
    credentials: options.credentials ?? "include",
  });

  if (resp.status !== 401 || retry === false) return resp;

  try {
    await refreshToken();
  } catch {
    clearTokens();
    return resp;
  }

  return authFetch(url, options, false);
}

export {
  refreshToken,
  clearTokens,
};
