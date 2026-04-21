"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Sidebar,
  SidebarContent,
  SidebarInput,
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarHeader,
  SidebarMenuItem,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarFooter,
} from "@/components/ui";
import {
  CalendarDays,
  ChevronDown,
  FileText,
  History,
  Info,
  LayoutDashboard,
  type LucideIcon,
  Package,
  BriefcaseBusiness,
  Search,
  Users,
} from "lucide-react";
import { NavUser } from "@/components/admin/layout";

type MenuItem = {
  key?: string;
  label: string;
  href?: string;
  items?: MenuItem[];
};

type GroupMenuKey =
  | "information"
  | "inventory"
  | "record"
  | "document"
  | "user"
  | "task";

type LinkMenuConfig = {
  type: "link";
  key: string;
  label: string;
  href: string;
  icon: LucideIcon;
  tooltip?: string;
  searchTerms?: string[];
  isActive?: (pathname: string, href: string) => boolean;
};

type GroupMenuConfig = {
  type: "group";
  key: GroupMenuKey;
  label: string;
  icon: LucideIcon;
  tooltip?: string;
  searchTerms?: string[];
  items: MenuItem[];
};

type MenuConfig = LinkMenuConfig | GroupMenuConfig;

const adminMenuConfig: MenuConfig[] = [
  {
    type: "link",
    key: "home",
    label: "Home",
    href: "/admin/home",
    icon: LayoutDashboard,
    tooltip: "Home",
    searchTerms: ["home"],
    isActive: (pathname) => pathname === "/admin" || pathname === "/admin/home",
  },
  {
    type: "group",
    key: "information",
    label: "Informasi",
    icon: Info,
    tooltip: "Informasi",
    searchTerms: ["informasi"],
    items: [
      { label: "Pengumuman", href: "/admin/information/announcements" },
      { label: "FAQ", href: "/admin/information/faq" },
    ],
  },
  {
    type: "link",
    key: "schedule",
    label: "Jadwal",
    href: "/admin/schedules",
    icon: CalendarDays,
    tooltip: "Jadwal",
  },
  {
    type: "group",
    key: "record",
    label: "Riwayat",
    icon: History,
    tooltip: "Riwayat",
    searchTerms: ["riwayat"],
    items: [
      { label: "Peminjaman Lab", href: "/admin/history/room-bookings" },
      { label: "Peminjaman Alat", href: "/admin/history/equipment-borrows" },
      { label: "Pengujian Sampel", href: "/admin/history/sample-testing" },
    ],
  },
  {
    type: "group",
    key: "document",
    label: "Dokumen",
    icon: FileText,
    tooltip: "Dokumen",
    searchTerms: ["dokumen", "surat", "invoice", "pengujian", "bebas", "tanggungan", "lab"],
    items: [
      {
        label: "Pengujian Sampel",
        href: "/admin/documents/sample-testing",
      },
      {
        label: "Surat Bebas Lab",
        href: "/admin/documents/lab-clearance",
      },
    ],
  },
  {
    type: "group",
    key: "inventory",
    label: "Inventarisasi",
    icon: Package,
    tooltip: "Inventarisasi",
    searchTerms: ["inventarisasi", "bahan", "material"],
    items: [
      { label: "Ruangan", href: "/admin/inventory/rooms" },
      { label: "Peralatan", href: "/admin/inventory/equipment" },
      { label: "Bahan", href: "/admin/inventory/materials" },
      { label: "Software", href: "/admin/inventory/software" },
    ],
  },
  {
    type: "group",
    key: "user",
    label: "User Management",
    icon: Users,
    tooltip: "User",
    searchTerms: ["user management", "user"],
    items: [
      { label: "Semua User", href: "/admin/user-management/list-users" },
      {
        key: "role",
        label: "Role",
        items: [
          { label: "Student", href: "/admin/user-management/role/student" },
          { label: "Lecturer", href: "/admin/user-management/role/lecturer" },
          { label: "Admin", href: "/admin/user-management/role/admin" },
          { label: "Staff", href: "/admin/user-management/role/staff" },
          { label: "Guest", href: "/admin/user-management/role/guest" },
        ],
      },
    ],
  },
  {
    type: "group",
    key: "task",
    label: "Task Management",
    icon: BriefcaseBusiness,
    tooltip: "Task Management",
    searchTerms: ["task management", "task"],
    items: [
      {
        label: "Dosen Pembimbing",
        href: "/admin/task-management/dosen-pembimbing",
      },
      {
        label: "PIC Ruangan",
        href: "/admin/task-management/pic-ruangan",
      },
    ],
  },
];

export function AppSidebar() {
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");
  const [openMenus, setOpenMenus] = useState<Record<GroupMenuKey, boolean>>({
    information: false,
    inventory: false,
    record: false,
    document: false,
    user: false,
    task: false,
  });
  const [openNestedMenus, setOpenNestedMenus] = useState<Record<string, boolean>>({});
  const menuButtonClass = (isSelected = false) =>
    isSelected
      ? "text-sidebar-foreground group-data-[collapsible=icon]:mx-auto"
      : "text-sidebar-foreground/65 hover:text-sidebar-foreground group-data-[collapsible=icon]:mx-auto";

  const toggleMenu = (
    menu: GroupMenuKey,
  ) => {
    setOpenMenus((prev) => ({
      ...prev,
      [menu]: !prev[menu],
    }));
  };

  const isPathActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const hasSearch = normalizedQuery.length > 0;
  const matchesSearch = (text: string) =>
    normalizedQuery.length === 0 ||
    text.toLowerCase().includes(normalizedQuery);
  const filterMenuItems = (items: MenuItem[]): MenuItem[] =>
    items.reduce<MenuItem[]>((acc, item) => {
      const filteredChildren = item.items ? filterMenuItems(item.items) : undefined;
      const selfMatches = matchesSearch(item.label);

      if (!selfMatches && !filteredChildren?.length) {
        return acc;
      }

      acc.push({
        ...item,
        items: filteredChildren,
      });
      return acc;
    }, []);

  const hasActiveItem = (items: MenuItem[]): boolean =>
    items.some((item) => {
      if (item.href && isPathActive(item.href)) return true;
      if (item.items?.length) return hasActiveItem(item.items);
      return false;
    });

  const groupMenuStates = useMemo(
    () =>
      adminMenuConfig.reduce(
        (acc, menu) => {
          if (menu.type !== "group") return acc;

          const filteredItems = filterMenuItems(menu.items);
          const searchMatches =
            menu.searchTerms?.some((term) => matchesSearch(term)) ?? false;

          acc[menu.key] = {
            filteredItems,
            isActive: hasActiveItem(menu.items),
            isVisible: searchMatches || filteredItems.length > 0,
          };

          return acc;
        },
        {} as Record<
          GroupMenuKey,
          { filteredItems: MenuItem[]; isActive: boolean; isVisible: boolean }
        >,
      ),
    [pathname, normalizedQuery],
  );

  const nextOpenMenus: Record<GroupMenuKey, boolean> = {
    record: openMenus.record || groupMenuStates.record.isActive,
    document: openMenus.document || groupMenuStates.document.isActive,
    inventory: openMenus.inventory || groupMenuStates.inventory.isActive,
    user: openMenus.user || groupMenuStates.user.isActive,
    information: openMenus.information || groupMenuStates.information.isActive,
    task: openMenus.task || groupMenuStates.task.isActive,
  };

  const toggleNestedMenu = (key: string) => {
    setOpenNestedMenus((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const renderSubmenuItems = (items: MenuItem[], depth = 0) => (
    <SidebarMenuSub>
      {items.map((item) => (
        <SidebarMenuSubItem key={item.key ?? item.href ?? item.label}>
          {item.items?.length ? (
            <>
              <SidebarMenuSubButton
                asChild
                isActive={hasActiveItem(item.items)}
                className={
                  hasActiveItem(item.items)
                    ? "text-sidebar-foreground"
                    : "text-sidebar-foreground/65 hover:text-sidebar-foreground"
                }
              >
                <button
                  type="button"
                  onClick={() => toggleNestedMenu(item.key ?? item.label)}
                  className="flex w-full items-center gap-2 text-left"
                >
                  <span className={`text-sm ${depth > 0 ? "pl-2" : ""}`}>{item.label}</span>
                  <ChevronDown
                    className={`ml-auto h-4 w-4 transition-transform ${
                      openNestedMenus[item.key ?? item.label] || hasActiveItem(item.items)
                        ? "rotate-180"
                        : ""
                    }`}
                  />
                </button>
              </SidebarMenuSubButton>
              {(openNestedMenus[item.key ?? item.label] || hasActiveItem(item.items))
                ? renderSubmenuItems(item.items, depth + 1)
                : null}
            </>
          ) : item.href ? (
            <SidebarMenuSubButton
              href={item.href}
              isActive={isPathActive(item.href)}
              className={
                isPathActive(item.href)
                  ? "text-sidebar-foreground"
                  : "text-sidebar-foreground/65 hover:text-sidebar-foreground"
              }
            >
              <span className={`text-sm ${depth > 0 ? "pl-3" : ""}`}>{item.label}</span>
            </SidebarMenuSubButton>
          ) : null}
        </SidebarMenuSubItem>
      ))}
    </SidebarMenuSub>
  );

  const renderMenuItem = (menu: MenuConfig) => {
    if (menu.type === "link") {
      const isVisible =
        menu.searchTerms?.some((term) => matchesSearch(term)) ||
        matchesSearch(menu.label);
      if (!isVisible) return null;

      const isActive = menu.isActive
        ? menu.isActive(pathname, menu.href)
        : isPathActive(menu.href);
      const Icon = menu.icon;

      return (
        <SidebarMenuItem className="mt-2" key={menu.key}>
          <SidebarMenuButton
            tooltip={menu.tooltip ?? menu.label}
            className={menuButtonClass(isActive)}
            asChild
            isActive={isActive}
          >
            <Link href={menu.href}>
              <Icon />
              <span className="text-sm">{menu.label}</span>
            </Link>
          </SidebarMenuButton>
        </SidebarMenuItem>
      );
    }

    const state = groupMenuStates[menu.key];
    if (!state.isVisible) return null;

    const Icon = menu.icon;
    const isExpanded =
      nextOpenMenus[menu.key] || (hasSearch && state.filteredItems.length > 0);

    return (
      <SidebarMenuItem className="mt-2" key={menu.key}>
        <SidebarMenuButton
          onClick={() => toggleMenu(menu.key)}
          tooltip={menu.tooltip ?? menu.label}
          className={menuButtonClass(state.isActive)}
          isActive={state.isActive}
        >
          <Icon />
          <span className="text-sm">{menu.label}</span>
          <ChevronDown
            className={`ml-auto transition-transform group-data-[collapsible=icon]:hidden ${
              isExpanded ? "rotate-180" : ""
            }`}
          />
        </SidebarMenuButton>
        {isExpanded && renderSubmenuItems(state.filteredItems)}
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar
      variant="inset"
      collapsible="icon"
      className="border-r border-sidebar-border bg-slate-900 p-0 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6] [--sidebar:rgb(15_23_42)] [--sidebar-foreground:#F8FAFC] [--sidebar-accent:rgb(24_34_53)] [--sidebar-accent-foreground:#FFFFFF] [--sidebar-border:rgb(51_65_85)] [--sidebar-primary:#0048B4] [--sidebar-primary-foreground:#FFFFFF] [--sidebar-ring:#3B82F6]"
    >
      <SidebarHeader className="relative h-16 flex-row! items-center! justify-start! gap-0! !p-0 border-b border-sidebar-border/60 px-2">
        <SidebarMenu className="flex h-full w-full items-center justify-start px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <SidebarMenuItem className="w-full group-data-[collapsible=icon]:w-auto">
            <SidebarMenuButton
              size="lg"
              asChild
              className="h-full w-full py-3 overflow-visible rounded-xl mx-0 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:pt-0"
            >
              <Link
                href="/admin"
                className="mx-0 flex h-full w-full items-center justify-start gap-2 px-2 group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0"
              >
                <Image
                  src="/logo/stem-name-white.webp"
                  alt="STEM Logo"
                  width={140}
                  height={40}
                  // style={{ width: "auto", height: "auto" }}
                  className="rounded-md group-data-[collapsible=icon]:hidden"
                  priority
                />
                <Image
                  src="/logo/prasmul-white.webp"
                  alt="STEM Logo"
                  width={40}
                  height={40}
                  className="hidden rounded-md object-contain group-data-[collapsible=icon]:mx-auto group-data-[collapsible=icon]:block group-data-[collapsible=icon]:size-6"
                  priority
                />
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-4">
        <SidebarGroup>
          <div className="mb-2 group-data-[collapsible=icon]:hidden">
            <div className="relative">
              <Search className="pointer-events-none absolute top-1/2 left-2 h-4 w-4 -translate-y-1/2 text-sidebar-foreground/60" />
              <SidebarInput
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search..."
                aria-label="Search menu"
                className="border-sidebar-border bg-sidebar-accent pl-8 text-sidebar-foreground placeholder:text-sidebar-foreground/60 focus-visible:ring-sidebar-ring"
              />
            </div>
          </div>
          <SidebarGroupLabel className="text-xs tracking-wide text-sidebar-foreground/70">
            ADMIN AREA
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{adminMenuConfig.map(renderMenuItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/60 px-2">
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
