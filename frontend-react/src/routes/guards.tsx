import { Loader2 } from "lucide-react";
import { useEffect, useState, type ReactElement } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { API_AUTH_USER_PROFILE } from "@/constants/api";
import {
  hasMenuAccess,
  isPrivilegedRole,
  normalizeRoleValue,
} from "@/constants/roles";
import {
  APPROVAL_ACCESS_ROLES,
  LAB_CLEARANCE_APPROVAL_ACCESS_ROLES,
  LAB_CLEARANCE_REQUESTER_ACCESS_ROLES,
  REQUESTER_ACCESS_ROLES,
  SAMPLE_TESTING_APPROVAL_ACCESS_ROLES,
  SAMPLE_TESTING_REQUESTER_ACCESS_ROLES,
} from "@/lib/dashboard";
import { authFetch, clearTokens } from "@/lib/auth";
import {
  buildProfileFromApiResponse,
  clearProfileCache,
  getCachedProfileSnapshot,
  persistProfileCache,
  type UserProfile,
} from "@/hooks/shared/profile";

type RoleProfile = Pick<UserProfile, "role">;
let resolvedAuthStatus: AuthStatus | null = null;
let inFlightAuthStatusRequest: Promise<AuthStatus> | null = null;

export function hasAuthToken() {
  return Boolean(getCachedProfileSnapshot());
}

function getProfile() {
  return (getCachedProfileSnapshot() ?? {}) as RoleProfile;
}

type AuthStatus = "checking" | "authenticated" | "unauthenticated";

function AuthPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 text-slate-600">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

async function resolveAuthStatus(): Promise<AuthStatus> {
  if (getCachedProfileSnapshot()) {
    resolvedAuthStatus = "authenticated";
    return resolvedAuthStatus;
  }

  if (resolvedAuthStatus && resolvedAuthStatus !== "checking") {
    return resolvedAuthStatus;
  }

  if (inFlightAuthStatusRequest) {
    return inFlightAuthStatusRequest;
  }

  inFlightAuthStatusRequest = (async () => {
    try {
      const response = await authFetch(API_AUTH_USER_PROFILE, {
        credentials: "include",
      });

      if (!response.ok) {
        clearTokens();
        clearProfileCache();
        resolvedAuthStatus = "unauthenticated";
        return resolvedAuthStatus;
      }

      const profileData: unknown = await response.json().catch(() => null);
      const nextProfile = buildProfileFromApiResponse(profileData);
      if (nextProfile) {
        persistProfileCache(nextProfile);
      }
      resolvedAuthStatus = "authenticated";
      return resolvedAuthStatus;
    } catch (error) {
      console.error("Auth guard session check error:", error);
      clearTokens();
      clearProfileCache();
      resolvedAuthStatus = "unauthenticated";
      return resolvedAuthStatus;
    } finally {
      inFlightAuthStatusRequest = null;
    }
  })();

  return inFlightAuthStatusRequest;
}

export function useResolvedAuthStatus() {
  const [status, setStatus] = useState<AuthStatus>(() => {
    if (getCachedProfileSnapshot()) {
      resolvedAuthStatus = "authenticated";
      return resolvedAuthStatus;
    }
    if (resolvedAuthStatus && resolvedAuthStatus !== "checking") {
      return resolvedAuthStatus;
    }
    return "checking";
  });

  useEffect(() => {
    let isActive = true;

    if (status !== "checking") {
      return () => {
        isActive = false;
      };
    }

    void resolveAuthStatus().then((nextStatus) => {
      if (!isActive) return;
      setStatus(nextStatus);
    });

    return () => {
      isActive = false;
    };
  }, [status]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleSessionExpired = () => {
      resolvedAuthStatus = "unauthenticated";
      inFlightAuthStatusRequest = null;
      setStatus("unauthenticated");
    };

    window.addEventListener("auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("auth:session-expired", handleSessionExpired);
    };
  }, []);

  return status;
}

export function RequireAuth({ children }: { children: ReactElement }) {
  const location = useLocation();
  const status = useResolvedAuthStatus();

  if (status === "checking") {
    return <AuthPending />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return children;
}

export function RequireAdmin({ children }: { children: ReactElement }) {
  const profile = getProfile();
  if (!isPrivilegedRole(profile.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RequireFeatureScope({
  children,
  featurePath,
  scope,
}: {
  children: ReactElement;
  featurePath:
    | "/booking-rooms"
    | "/borrow-equipment"
    | "/sample-testing"
    | "/lab-clearance";
  scope: "requester" | "approval";
}) {
  const profile = getProfile();
  const normalizedRole = normalizeRoleValue(profile.role);
  const requesterAccessRoles =
    featurePath === "/lab-clearance"
      ? LAB_CLEARANCE_REQUESTER_ACCESS_ROLES
      : featurePath === "/sample-testing"
        ? SAMPLE_TESTING_REQUESTER_ACCESS_ROLES
        : REQUESTER_ACCESS_ROLES;
  const approvalAccessRoles =
    featurePath === "/lab-clearance"
      ? LAB_CLEARANCE_APPROVAL_ACCESS_ROLES
      : featurePath === "/sample-testing"
        ? SAMPLE_TESTING_APPROVAL_ACCESS_ROLES
        : APPROVAL_ACCESS_ROLES;
  const canAccessRequesterScope = requesterAccessRoles.some((role) => role === normalizedRole);
  const canAccessApprovalScope = approvalAccessRoles.some((role) => role === normalizedRole);

  if (scope === "requester" && !canAccessRequesterScope && canAccessApprovalScope) {
    return <Navigate to={`${featurePath}/approval`} replace />;
  }

  if (scope === "requester" && !canAccessRequesterScope) {
    return <Navigate to="/dashboard" replace />;
  }

  if (scope === "approval" && !canAccessApprovalScope && canAccessRequesterScope) {
    return <Navigate to={featurePath} replace />;
  }

  if (scope === "approval" && !canAccessApprovalScope) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

export function RequireMenuAccess({
  children,
  menuId,
}: {
  children: ReactElement;
  menuId:
    | "dashboard"
    | "schedule"
    | "booking-rooms"
    | "borrow-equipment"
    | "sample-testing"
    | "bebas-laboratorium"
    | "notifications"
    | "my-profile";
}) {
  const profile = getProfile();
  if (!hasMenuAccess(profile.role, menuId)) {
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}
