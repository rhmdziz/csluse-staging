import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  API_AUTH_LOGIN,
  API_AUTH_LOGIN_ROUTE,
  API_AUTH_USER_PROFILE,
} from "@/constants/api";
import { authFetch } from "@/lib/auth";
import {
  buildProfileFromApiResponse,
  persistProfileCache,
} from "@/hooks/shared/profile";

type LoginStatus = "idle" | "submitting" | "success" | "error";

type LoginFormData = {
  username: string;
  password: string;
};

type LoginResponse = {
  access_token?: string;
  access?: string;
  refresh_token?: string;
  refresh?: string;
  non_field_errors?: string[];
  detail?: string;
};

type LoginRouteResponse = {
  mode?: "local" | "microsoft";
  authorization_url?: string;
  detail?: string;
  code?: string;
};

const MICROSOFT_AUTH_ERROR_MESSAGES: Record<string, string> = {
  microsoft_cancelled: "Login Microsoft dibatalkan.",
  microsoft_domain_invalid:
    "Gunakan email kampus Prasetiya Mulya untuk login Microsoft.",
  microsoft_email_mismatch:
    "Email Microsoft yang dipilih tidak sesuai dengan email yang Anda masukkan.",
  microsoft_missing_email:
    "Akun Microsoft tidak mengembalikan alamat email yang valid.",
  microsoft_not_configured:
    "Login Microsoft belum dikonfigurasi pada server.",
  microsoft_failed: "Login Microsoft gagal. Silakan coba lagi.",
};

export function useLogin() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [formData, setFormData] = useState<LoginFormData>({
    username: "",
    password: "",
  });
  const [status, setStatus] = useState<LoginStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    const authProvider = searchParams.get("auth_provider");
    const authError = searchParams.get("auth_error");
    if (authProvider !== "microsoft" || !authError) {
      return;
    }

    setStatus("error");
    setErrorMessage(
      MICROSOFT_AUTH_ERROR_MESSAGES[authError] ?? "Login Microsoft gagal.",
    );
    router.replace("/login");
  }, [router, searchParams]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage("");
    setStatus("submitting");

    try {
      const loginRouteResponse = await fetch(API_AUTH_LOGIN_ROUTE, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          email: formData.username,
        }),
      });

      const loginRouteData =
        (await loginRouteResponse.json().catch(() => ({}))) as LoginRouteResponse;

      if (!loginRouteResponse.ok) {
        setStatus("error");
        setFormData({ username: "", password: "" });
        setErrorMessage(
          loginRouteData.detail || "Login gagal. Coba lagi beberapa saat lagi.",
        );
        return;
      }

      if (
        loginRouteData.mode === "microsoft" &&
        loginRouteData.authorization_url
      ) {
        window.location.assign(loginRouteData.authorization_url);
        return;
      }

      const response = await fetch(API_AUTH_LOGIN, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
        }),
      });

      const data = (await response.json()) as LoginResponse;

      if (response.ok) {
        setStatus("success");

        try {
          const profileResponse = await authFetch(API_AUTH_USER_PROFILE, {
            credentials: "include",
          });

          if (profileResponse.ok) {
            const profileData: unknown = await profileResponse.json();
            const nextProfile = buildProfileFromApiResponse(profileData);
            if (nextProfile) {
              persistProfileCache(nextProfile);
            }
          }
        } catch (error) {
          console.error("Profile fetch after login error:", error);
        }

        router.push("/dashboard");
      } else {
        setStatus("error");
        setFormData({ username: "", password: "" });
        if (data.non_field_errors?.[0]) {
          setErrorMessage(data.non_field_errors[0]);
        } else if (data.detail) {
          setErrorMessage(data.detail);
        } else {
          setErrorMessage("Login gagal. Periksa email dan password Anda.");
        }
      }
    } catch (error) {
      setStatus("error");
      setFormData({ username: "", password: "" });
      setErrorMessage("Terjadi kesalahan jaringan. Coba lagi.");
      console.error("Login error:", error);
    }
  };

  return {
    formData,
    status,
    errorMessage,
    handleChange,
    handleSubmit,
  };
}
