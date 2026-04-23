import { http } from "@/services/shared";

export type LoginPayload = {
  username: string;
  password: string;
};

export const authService = {
  login(payload: LoginPayload) {
    return http.post("/api/auth/login/", payload);
  },
  logout() {
    return http.get("/api/auth/logout/");
  },
  profile() {
    return http.get("/api/auth/user/profile/");
  },
  refresh(payload?: { refresh?: string }) {
    return http.post("/api/auth/token/refresh/", payload ?? {});
  },
};
