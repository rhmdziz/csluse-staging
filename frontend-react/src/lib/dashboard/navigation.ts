import type { ComponentType } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  CircleHelp,
  ClipboardList,
  FilePenLine,
  FlaskConical,
  GitBranch,
  LayoutDashboard,
  Package,
  ShieldCheck,
  Stamp,
  UserRound,
} from "lucide-react";

import { hasMenuAccess, normalizeRoleValue } from "@/constants/roles";
import {
  APPROVAL_ACCESS_ROLES,
  CATALOG_ACCESS_ROLES,
  REQUESTER_ACCESS_ROLES,
  SAMPLE_TESTING_APPROVAL_ACCESS_ROLES,
  SAMPLE_TESTING_REQUESTER_ACCESS_ROLES,
} from "@/lib/dashboard";

export type ShortcutAction = {
  id: string;
  label: string;
  description: string;
  href: string;
  allowedRoles?: readonly string[];
};

export type SidebarShortcut = {
  id: string;
  label: string;
  description: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
  actions: ShortcutAction[];
};

export type TopNavItem = {
  id: string;
  label: string;
  href?: string;
  children?: Array<{
    id?: string;
    label: string;
    href: string;
  }>;
};

const TOP_NAV_MENU_CONFIG: Array<Pick<TopNavItem, "id" | "label" | "href">> = [
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
  { id: "schedule", label: "Lihat Jadwal", href: "/schedule" },
  { id: "booking-rooms", label: "Peminjaman Lab" },
  { id: "borrow-equipment", label: "Peminjaman Alat" },
  { id: "sample-testing", label: "Pengujian Sampel" },
];

const ADMIN_APPROVAL_DEFAULT_MENU_IDS = new Set([
  "booking-rooms",
  "borrow-equipment",
  "sample-testing",
]);

export function getHeaderIcon(menuId: string, actionId: string | null) {
  if (menuId === "dashboard") {
    if (actionId === "announcements") return Bell;
    if (actionId === "faq") return CircleHelp;
    if (actionId === "organization-structure") return GitBranch;
    return LayoutDashboard;
  }

  if (menuId === "schedule") return CalendarDays;

  if (menuId === "booking-rooms") {
    if (actionId === "request-form") return FilePenLine;
    if (actionId === "request-list" || actionId === "all-requests") {
      return ClipboardList;
    }
    return Building2;
  }

  if (menuId === "sample-testing") {
    if (actionId === "request-form") return FilePenLine;
    if (actionId === "request-list" || actionId === "all-requests") {
      return ClipboardList;
    }
    return FlaskConical;
  }

  if (menuId === "borrow-equipment") {
    if (actionId === "request-form") return FilePenLine;
    if (actionId === "request-list" || actionId === "all-requests") {
      return ClipboardList;
    }
    return Package;
  }

  if (menuId === "bebas-laboratorium") return Stamp;

  if (menuId === "notifications") return Bell;

  if (menuId === "my-profile") {
    if (actionId === "change-password") return ShieldCheck;
    return UserRound;
  }

  return LayoutDashboard;
}

export const SIDEBAR_SHORTCUTS: SidebarShortcut[] = [
  {
    id: "dashboard",
    label: "Welcome, User!",
    description:
      "Akses utama untuk layanan CSL, termasuk jadwal, pemesanan, pengajuan, dan informasi terbaru.",
    href: "/dashboard",
    icon: LayoutDashboard,
    actions: [
      {
        id: "overview",
        label: "Ringkasan",
        description:
          "Lihat ringkasan status pengajuan dan aktivitas terbaru Anda.",
        href: "/dashboard/overview",
      },
      {
        id: "announcements",
        label: "Pengumuman",
        description: "Lihat pengumuman terbaru dari admin.",
        href: "/dashboard/announcements",
      },
      {
        id: "organization-structure",
        label: "Struktur Organisasi",
        description: "Lihat bagan struktur organisasi laboratorium.",
        href: "/dashboard/organization-structure",
      },
      {
        id: "faq",
        label: "FAQ",
        description:
          "Temukan jawaban cepat untuk pertanyaan yang sering diajukan.",
        href: "/dashboard/faq",
      },
    ],
  },
  {
    id: "schedule",
    label: "Jadwal Praktikum",
    description: "Lihat jadwal praktikum dan peminjaman laboratorium.",
    href: "/schedule",
    icon: CalendarDays,
    actions: [],
  },
  {
    id: "booking-rooms",
    label: "Peminjaman Lab",
    description: "Kelola pengajuan peminjaman lab dan pantau progresnya.",
    href: "/booking-rooms/form",
    icon: Building2,
    actions: [
      {
        id: "request-form",
        label: "Ajukan Peminjaman Lab",
        description: "Buat pengajuan peminjaman lab melalui formulir.",
        href: "/booking-rooms/form",
        allowedRoles: REQUESTER_ACCESS_ROLES,
      },
      {
        id: "request-list",
        label: "Pengajuan Saya",
        description: "Lihat daftar pengajuan peminjaman lab Anda.",
        href: "/booking-rooms",
        allowedRoles: REQUESTER_ACCESS_ROLES,
      },
      {
        id: "all-requests",
        label: "Approval Peminjaman Lab",
        description: "Lihat seluruh pengajuan peminjaman lab untuk diproses.",
        href: "/booking-rooms/approval",
        allowedRoles: APPROVAL_ACCESS_ROLES,
      },
      {
        id: "rooms",
        label: "Ruangan yang Tersedia",
        description: "Lihat daftar ruangan yang tersedia untuk peminjaman lab.",
        href: "/booking-rooms/rooms",
        allowedRoles: CATALOG_ACCESS_ROLES,
      },
      {
        id: "equipment",
        label: "Peralatan yang Tersedia",
        description: "Lihat daftar peralatan yang tersedia di laboratorium.",
        href: "/booking-rooms/equipment",
        allowedRoles: CATALOG_ACCESS_ROLES,
      },
      {
        id: "materials",
        label: "Bahan yang Tersedia",
        description: "Lihat daftar bahan habis pakai yang tersedia di laboratorium.",
        href: "/booking-rooms/materials",
        allowedRoles: CATALOG_ACCESS_ROLES,
      },
      {
        id: "software",
        label: "Daftar Software",
        description: "Lihat daftar software yang tersedia pada peralatan laboratorium.",
        href: "/booking-rooms/software",
        allowedRoles: CATALOG_ACCESS_ROLES,
      },
    ],
  },
  {
    id: "borrow-equipment",
    label: "Peminjaman Alat",
    description: "Kelola pengajuan peminjaman alat dan pantau progresnya.",
    href: "/borrow-equipment/form",
    icon: Package,
    actions: [
      {
        id: "request-form",
        label: "Ajukan Peminjaman",
        description: "Buat pengajuan peminjaman alat melalui formulir.",
        href: "/borrow-equipment/form",
        allowedRoles: REQUESTER_ACCESS_ROLES,
      },
      {
        id: "request-list",
        label: "Pengajuan Saya",
        description: "Lihat daftar pengajuan peminjaman alat Anda.",
        href: "/borrow-equipment",
        allowedRoles: REQUESTER_ACCESS_ROLES,
      },
      {
        id: "all-requests",
        label: "Approval Peminjaman Alat",
        description:
          "Lihat seluruh pengajuan peminjaman alat untuk diproses.",
        href: "/borrow-equipment/approval",
        allowedRoles: APPROVAL_ACCESS_ROLES,
      },
      {
        id: "equipment",
        label: "Alat yang Bisa Dipinjam",
        description: "Lihat daftar alat yang tersedia untuk dipinjam.",
        href: "/borrow-equipment/equipment",
        allowedRoles: CATALOG_ACCESS_ROLES,
      },
    ],
  },
  {
    id: "sample-testing",
    label: "Pengujian Sampel",
    description: "Kelola pengajuan pengujian sampel dan formulirnya.",
    href: "/sample-testing/form",
    icon: FlaskConical,
    actions: [
      {
        id: "request-form",
        label: "Ajukan Pengujian",
        description: "Buat pengajuan pengujian sampel melalui formulir.",
        href: "/sample-testing/form",
        allowedRoles: SAMPLE_TESTING_REQUESTER_ACCESS_ROLES,
      },
      {
        id: "request-list",
        label: "Pengajuan Saya",
        description: "Lihat daftar pengajuan pengujian sampel Anda.",
        href: "/sample-testing",
        allowedRoles: SAMPLE_TESTING_REQUESTER_ACCESS_ROLES,
      },
      {
        id: "all-requests",
        label: "Approval Pengujian Sampel",
        description:
          "Lihat seluruh daftar pengajuan pengujian sampel untuk diproses.",
        href: "/sample-testing/approval",
        allowedRoles: SAMPLE_TESTING_APPROVAL_ACCESS_ROLES,
      },
    ],
  },
  {
    id: "bebas-laboratorium",
    label: "Surat Bebas Laboratorium",
    description: "Ajukan permohonan surat bebas laboratorium untuk mahasiswa tugas akhir.",
    href: "/lab-clearance",
    icon: Stamp,
    actions: [],
  },
  {
    id: "notifications",
    label: "Notifikasi",
    description: "Lihat update status pengajuan dan pemberitahuan terbaru.",
    href: "/notifications",
    icon: Bell,
    actions: [],
  },
  {
    id: "my-profile",
    label: "Profil Saya",
    description: "Kelola data profil dan informasi akun pengguna.",
    href: "/my-profile",
    icon: UserRound,
    actions: [
      {
        id: "edit-profile",
        label: "Edit Profil",
        description:
          "Perbarui data profil seperti nama, batch, dan department.",
        href: "/my-profile/edit",
      },
      {
        id: "change-password",
        label: "Ganti Password",
        description: "Ubah password akun untuk menjaga keamanan akses.",
        href: "/my-profile/security",
      },
    ],
  },
];

export function canAccessAction(
  role: string | null | undefined,
  action: ShortcutAction,
) {
  if (!action.allowedRoles?.length) return true;
  const normalizedRole = normalizeRoleValue(role);
  if (!normalizedRole) return false;
  return action.allowedRoles.includes(normalizedRole);
}

export function getVisibleTopNavItems(
  role: string | null | undefined,
): TopNavItem[] {
  return TOP_NAV_MENU_CONFIG.flatMap((item) => {
    if (!hasMenuAccess(role, item.id as Parameters<typeof hasMenuAccess>[1])) {
      return [];
    }

    const shortcut = SIDEBAR_SHORTCUTS.find((menu) => menu.id === item.id);
    if (!shortcut || !shortcut.actions.length) {
      return [{ ...item }];
    }

    const children = shortcut.actions
      .filter((action) => canAccessAction(role, action))
      .map((action) => ({
        id: action.id,
        label: action.label,
        href: action.href,
      }));

    if (!children.length) return [];

    return [
      {
        id: item.id,
        label: item.label,
        children,
      },
    ];
  });
}

function getDefaultActionId(
  role: string | null | undefined,
  menu: SidebarShortcut,
) {
  const normalizedRole = normalizeRoleValue(role);

  if (
    ADMIN_APPROVAL_DEFAULT_MENU_IDS.has(menu.id) &&
    (normalizedRole === "Admin" || normalizedRole === "SuperAdministrator")
  ) {
    const approvalAction = menu.actions.find((item) => item.id === "all-requests");
    if (approvalAction) return approvalAction.id;
  }

  const requestListAction = menu.actions.find((item) => item.id === "request-list");
  if (requestListAction) return requestListAction.id;

  const requestFormAction = menu.actions.find((item) => item.id === "request-form");
  if (requestFormAction) return requestFormAction.id;

  return menu.actions[0]?.id;
}

export function toMenuHref(
  shortcuts: SidebarShortcut[],
  role: string | null | undefined,
  menuId?: string,
  actionId?: string,
) {
  if (!menuId) return "/dashboard";
  const menu = shortcuts.find((item) => item.id === menuId);
  if (!menu) return "/dashboard";
  const resolvedActionId = actionId ?? getDefaultActionId(role, menu);
  const action = menu.actions.find((item) => item.id === resolvedActionId);
  return action?.href ?? menu.actions[0]?.href ?? menu.href;
}

export function parseDashboardPath(pathname: string) {
  const parts = pathname.split("/").filter(Boolean);

  if (parts[0] === "dashboard") {
    if (parts[1] === "overview") {
      return { menu: "dashboard", action: "overview" };
    }
    if (parts[1] === "announcements") {
      return { menu: "dashboard", action: "announcements" };
    }
    if (parts[1] === "faq") {
      return { menu: "dashboard", action: "faq" };
    }
    if (parts[1] === "organization-structure") {
      return { menu: "dashboard", action: "organization-structure" };
    }
    return { menu: "dashboard", action: null };
  }
  if (parts[0] === "schedule") {
    return { menu: "schedule", action: null };
  }
  if (parts[0] === "booking-rooms") {
    if (parts[1] === "approval") {
      return { menu: "booking-rooms", action: "all-requests" };
    }
    if (parts[1] === "form") {
      return { menu: "booking-rooms", action: "request-form" };
    }
    if (parts[1] === "rooms") {
      return { menu: "booking-rooms", action: "rooms" };
    }
    if (parts[1] === "equipment") {
      return { menu: "booking-rooms", action: "equipment" };
    }
    if (parts[1] === "materials") {
      return { menu: "booking-rooms", action: "materials" };
    }
    if (parts[1] === "software") {
      return { menu: "booking-rooms", action: "software" };
    }
    return { menu: "booking-rooms", action: "request-list" };
  }
  if (parts[0] === "sample-testing") {
    if (parts[1] === "approval") {
      return { menu: "sample-testing", action: "all-requests" };
    }
    if (parts[1] === "form") {
      return { menu: "sample-testing", action: "request-form" };
    }
    return { menu: "sample-testing", action: "request-list" };
  }
  if (parts[0] === "borrow-equipment") {
    if (parts[1] === "approval") {
      return { menu: "borrow-equipment", action: "all-requests" };
    }
    if (parts[1] === "equipment") {
      return { menu: "borrow-equipment", action: "equipment" };
    }
    if (parts[1] === "form") {
      return { menu: "borrow-equipment", action: "request-form" };
    }
    return { menu: "borrow-equipment", action: "request-list" };
  }
  if (parts[0] === "lab-clearance") {
    return { menu: "bebas-laboratorium", action: null };
  }
  if (parts[0] === "notifications") {
    return { menu: "notifications", action: null };
  }
  if (parts[0] === "my-profile") {
    if (parts[1] === "edit") {
      return { menu: "my-profile", action: "edit-profile" };
    }
    if (parts[1] === "security") {
      return { menu: "my-profile", action: "change-password" };
    }
    return { menu: "my-profile", action: null };
  }

  return { menu: null, action: null };
}
