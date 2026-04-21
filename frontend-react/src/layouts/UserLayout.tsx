"use client";


import {
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { usePathname, useRouter } from "next/navigation";

import { Outlet } from "react-router-dom";

import { LayoutGrid, X } from "lucide-react";

import { useIsMobile } from "@/hooks/use-mobile";

import {
  DashboardTopNavbar,
  DashboardSideNavbar,
  DashboardActionPanel,
  DashboardMainLayout,
} from "@/components/dashboard/layout";

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui";

import { useLoadProfile } from "@/hooks/shared/profile";

import Link from "next/link";

import { cn } from "@/lib/core";

import { hasMenuAccess } from "@/constants/roles";

import {
  canAccessAction,
  getHeaderIcon,
  getVisibleTopNavItems,
  parseDashboardPath,
  SIDEBAR_SHORTCUTS,
  type SidebarShortcut,
  toMenuHref,
} from "@/lib/dashboard";

type UserLayoutProps = {
  children?: ReactNode;
};

const ACTION_PANEL_WIDTH = "20rem";
const SIDEBAR_WIDTH = "5rem";

function DashboardShell({ children }: UserLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isMobile = useIsMobile();
  const { profile } = useLoadProfile();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.sessionStorage.setItem("last_app_path", pathname);
  }, [pathname]);

  const { menu: menuParam, action: actionParam } = parseDashboardPath(pathname);
  const defaultMenuId = SIDEBAR_SHORTCUTS[0].id;
  const displayName = profile.name?.trim() || "User";
  const sidebarShortcuts = useMemo(
    () =>
      SIDEBAR_SHORTCUTS.filter((item) =>
        hasMenuAccess(
          profile.role,
          item.id as Parameters<typeof hasMenuAccess>[1],
        ),
      )
        .map((item) => {
          const actions = item.actions.filter((action) =>
            canAccessAction(profile.role, action),
          );

          return {
            ...item,
            href: actions[0]?.href ?? item.href,
            actions,
            ...(item.id === "dashboard"
              ? {
                  label: `Welcome, ${displayName}!`,
                }
              : {}),
          };
        })
        .filter(
          (item) =>
            item.actions.length > 0 ||
            item.id === "schedule" ||
            item.id === "notifications" ||
            item.id === "bebas-laboratorium",
        ),
    [displayName, profile.role],
  );
  const visibleTopNavItems = useMemo(
    () => getVisibleTopNavItems(profile.role),
    [profile.role],
  );

  const [activeMenuId, setActiveMenuId] = useState<string>(
    menuParam || defaultMenuId,
  );
  const [isActionPanelOpen, setIsActionPanelOpen] = useState(true);
  const [isMobileActionOpen, setIsMobileActionOpen] = useState(false);
  const [isMobileShortcutOpen, setIsMobileShortcutOpen] = useState(false);

  useEffect(() => {
    if (!menuParam) return;
    if (!sidebarShortcuts.some((menu) => menu.id === menuParam)) return;
    setActiveMenuId(menuParam);
    setIsActionPanelOpen(true);
  }, [menuParam, sidebarShortcuts]);

  const activeMenu =
    sidebarShortcuts.find((item) => item.id === activeMenuId) ??
    sidebarShortcuts[0];
  const activeAction =
    activeMenu.id === "my-profile"
      ? null
      : (activeMenu.actions.find((action) => action.id === actionParam) ??
        null);
  const pageTitle =
    activeMenu.id === "my-profile"
      ? "Informasi Profil"
      : (activeAction?.label ?? activeMenu.label);
  const pageDescription =
    activeMenu.id === "my-profile"
      ? "Ringkasan data akun pengguna Anda."
      : (activeAction?.description ?? activeMenu.description);
  const isApprovalPage = pathname.includes("/approval");
  const pageEyebrow = isApprovalPage ? "CSL Management" : undefined;
  const HeaderIcon = getHeaderIcon(activeMenu.id, actionParam);
  const pageHeaderIcon = <HeaderIcon className="h-5 w-5 text-white" />;

  const hasActionPanel = isActionPanelOpen && !isMobile;
  const mobileBottomMenus = sidebarShortcuts.filter(
    (item) => item.id !== "notifications" && item.id !== "my-profile",
  );
  const mobileTopShortcuts = visibleTopNavItems.map((item) => ({
    ...item,
    isActive: activeMenuId === item.id,
  }));

  const getMenuDefaultHref = (menuId: string) =>
    toMenuHref(sidebarShortcuts, profile.role, menuId);

  const handleMenuClick = (menu: SidebarShortcut) => {
    setActiveMenuId(menu.id);
    setIsActionPanelOpen(true);
  };

  const handleTopShortcutClick = (menuId: string) => {
    const selectedMenu = sidebarShortcuts.find((item) => item.id === menuId);
    if (selectedMenu) handleMenuClick(selectedMenu);
    setIsMobileShortcutOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-100 [--primary:#0048B4] [--primary-foreground:#FFFFFF] [--ring:#3B82F6] [--sidebar-primary:#0048B4] [--sidebar-primary-foreground:#FFFFFF] [--sidebar-ring:#3B82F6]">
      <Sheet open={isMobileActionOpen} onOpenChange={setIsMobileActionOpen}>
        <SheetContent
          side="left"
          className="w-[360px] max-w-[calc(100%-1rem)] p-0"
        >
          <SheetHeader className="sr-only">
            <SheetTitle>Action Panel</SheetTitle>
            <SheetDescription>
              Panel aksi dan filter dashboard pengguna.
            </SheetDescription>
          </SheetHeader>
          {activeMenu ? (
            <DashboardActionPanel
              width={ACTION_PANEL_WIDTH}
              isOpen
              mobile
              menu={activeMenu}
              menuParam={menuParam}
              actionParam={actionParam}
              getActionHref={(actionId) =>
                toMenuHref(sidebarShortcuts, profile.role, activeMenu.id, actionId)
              }
              getMenuHref={() => toMenuHref(sidebarShortcuts, profile.role, activeMenu.id)}
              onClose={() => setIsMobileActionOpen(false)}
            />
          ) : null}
        </SheetContent>
      </Sheet>

      <DashboardTopNavbar
        activeMenuId={activeMenuId}
        items={visibleTopNavItems}
        onShortcutClick={(menuId) => {
          handleTopShortcutClick(menuId);
        }}
        onMobileActionOpen={() => setIsMobileActionOpen(true)}
      />

      <div
        className="flex min-h-screen pt-16 transition-[padding-left] duration-300 ease-in-out"
        style={
          isMobile
            ? undefined
            : {
                paddingLeft: hasActionPanel
                  ? `calc(${SIDEBAR_WIDTH} + ${ACTION_PANEL_WIDTH})`
                  : SIDEBAR_WIDTH,
              }
        }
      >
        <DashboardSideNavbar
          menus={sidebarShortcuts}
          activeMenuId={activeMenuId}
          getMenuHref={getMenuDefaultHref}
          bottomMenuIds={["notifications", "my-profile"]}
          onMenuClick={(menuId) => {
            const selectedMenu = sidebarShortcuts.find(
              (item) => item.id === menuId,
            );
            if (selectedMenu) handleMenuClick(selectedMenu);
          }}
          onLogoClick={() => router.push(toMenuHref(sidebarShortcuts, profile.role))}
        />

        {activeMenu && (
          <DashboardActionPanel
            width={ACTION_PANEL_WIDTH}
            isOpen={hasActionPanel}
            menu={activeMenu}
            menuParam={menuParam}
            actionParam={actionParam}
            getActionHref={(actionId) =>
              toMenuHref(sidebarShortcuts, profile.role, activeMenu.id, actionId)
            }
            getMenuHref={() => toMenuHref(sidebarShortcuts, profile.role, activeMenu.id)}
            onClose={() => setIsActionPanelOpen(false)}
          />
        )}

        <DashboardMainLayout
          pageTitle={pageTitle}
          pageDescription={pageDescription}
          pageEyebrow={pageEyebrow}
          pageIcon={pageHeaderIcon}
        >
          {children}
        </DashboardMainLayout>
      </div>

      {isMobileShortcutOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-50 bg-slate-950/10 backdrop-blur-sm md:hidden"
            aria-label="Close shortcuts"
            onClick={() => setIsMobileShortcutOpen(false)}
          />
          <div className="fixed right-4 bottom-40 z-[60] w-[min(20rem,calc(100vw-2rem))] rounded-2xl border border-slate-200 bg-white/95 p-3 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop-blur md:hidden">
            <div className="mb-2 flex items-center justify-between px-1">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Shortcut Menu
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsMobileShortcutOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-100"
                aria-label="Close shortcuts"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="max-h-[min(70vh,32rem)] space-y-1 overflow-y-auto pr-1">
              {mobileTopShortcuts.map((item) => {
                return (
                  <div
                    key={item.id}
                    className="border-b border-slate-100 pb-1 last:border-b-0"
                  >
                    {item.href ? (
                      <Link
                        href={item.href}
                        onClick={() => handleTopShortcutClick(item.id)}
                        className={cn(
                          "block rounded-lg px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50",
                          item.isActive && "text-[#0048B4]",
                        )}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <div className="px-1 py-1">
                        <div
                          className={cn(
                            "px-2 py-2 text-sm font-semibold text-slate-900",
                            item.isActive && "text-[#0048B4]",
                          )}
                        >
                          {item.label}
                        </div>
                        <div className="space-y-1">
                          {item.children?.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              onClick={() => handleTopShortcutClick(item.id)}
                              className="block rounded-lg px-4 py-2 text-sm text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      <nav className="fixed right-0 bottom-0 left-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-4 backdrop-blur md:hidden">
        <div className="mx-auto flex w-full justify-center">
          <div className="flex max-w-full gap-2 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {mobileBottomMenus.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenuId === item.id;
              return (
                <Link
                  key={item.id}
                  href={getMenuDefaultHref(item.id)}
                  onClick={() => handleMenuClick(item)}
                  className={cn(
                    "flex h-10 min-w-14 shrink-0 items-center justify-center rounded-xl px-4 transition",
                    isActive
                      ? "bg-blue-50 text-[#0048B4]"
                      : "text-slate-600 hover:bg-slate-50",
                  )}
                  aria-label={item.label}
                >
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      <button
        type="button"
        onClick={() => setIsMobileShortcutOpen((current) => !current)}
        className="fixed right-4 bottom-20 z-[60] inline-flex h-14 w-14 items-center justify-center rounded-full bg-[#0048B4] text-white shadow-[0_18px_36px_rgba(0,72,180,0.32)] transition hover:bg-[#003b92] md:hidden"
        aria-label="Open shortcut menu"
      >
        {isMobileShortcutOpen ? (
          <X className="h-5 w-5" />
        ) : (
          <LayoutGrid className="h-5 w-5" />
        )}
      </button>
    </div>
  );
}

export function UserLayout({ children }: UserLayoutProps) {
  return <DashboardShell>{children ?? <Outlet />}</DashboardShell>;
}
