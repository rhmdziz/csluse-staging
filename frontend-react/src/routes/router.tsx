import { Suspense, lazy, type ComponentType, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { createBrowserRouter, Navigate, Outlet } from "react-router-dom";

import AuthLayout from "@/layouts/AuthLayout";
import AdminLayout from "@/layouts/AdminLayout";
import { UserLayout } from "@/layouts/UserLayout";
import {
  RequireAdmin,
  RequireAuth,
  RequireFeatureScope,
  RequireMenuAccess,
} from "@/routes/guards";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(() =>
    factory().catch((e: unknown) => {
      if (e instanceof Error && e.message.includes("Failed to fetch dynamically imported module")) {
        window.location.reload();
        return new Promise<never>(() => {});
      }
      throw e;
    }),
  );
}

const LoginPage = lazyWithReload(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazyWithReload(() => import("@/pages/auth/ForgotPasswordPage"));
const SignupGuestPage = lazyWithReload(() => import("@/pages/auth/SignupGuestPage"));
const SignupGuestVerifyPage = lazyWithReload(() => import("@/pages/auth/SignupGuestVerifyPage"));
const ResetPasswordPage = lazyWithReload(() => import("@/pages/auth/ResetPasswordPage"));
const DashboardHomePage = lazyWithReload(() => import("@/pages/dashboard/DashboardHomePage"));
const DashboardOverviewPage = lazyWithReload(
  () => import("@/pages/dashboard/overview/DashboardOverviewPage"),
);
const DashboardAnnouncementsPage = lazyWithReload(
  () => import("@/pages/dashboard/announcements/DashboardAnnouncementsPage"),
);
const DashboardFaqPage = lazyWithReload(() => import("@/pages/dashboard/faq/DashboardFaqPage"));
const DashboardOrganizationStructurePage = lazyWithReload(
  () => import("@/pages/dashboard/organization/DashboardOrganizationStructurePage"),
);
const SchedulePage = lazyWithReload(() => import("@/pages/dashboard/schedule/SchedulePage"));
const BookingRoomsListPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsListPage"),
);
const BookingRoomsAllListPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsAllListPage"),
);
const BookingRoomsFormPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsFormPage"),
);
const BookingRoomsDetailPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsDetailPage"),
);
const RoomsListPage = lazyWithReload(() => import("@/pages/dashboard/booking-rooms/RoomsListPage"));
const RoomDetailPage = lazyWithReload(() => import("@/pages/dashboard/booking-rooms/RoomDetailPage"));
const BookingEquipmentListPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/EquipmentListPage"),
);
const BookingEquipmentDetailPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/EquipmentDetailPage"),
);
const BookingMaterialListPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/MaterialListPage"),
);
const BookingMaterialDetailPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/MaterialDetailPage"),
);
const BookingSoftwareListPage = lazyWithReload(
  () => import("@/pages/dashboard/booking-rooms/SoftwareListPage"),
);
const SampleTestingListPage = lazyWithReload(
  () => import("@/pages/dashboard/sample-testing/SampleTestingListPage"),
);
const SampleTestingAllListPage = lazyWithReload(
  () => import("@/pages/dashboard/sample-testing/SampleTestingAllListPage"),
);
const SampleTestingFormPage = lazyWithReload(
  () => import("@/pages/dashboard/sample-testing/SampleTestingFormPage"),
);
const SampleTestingDetailPage = lazyWithReload(
  () => import("@/pages/dashboard/sample-testing/SampleTestingDetailPage"),
);
const BorrowEquipmentListPage = lazyWithReload(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentListPage"),
);
const BorrowEquipmentAllListPage = lazyWithReload(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentAllListPage"),
);
const BorrowEquipmentFormPage = lazyWithReload(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentFormPage"),
);
const BorrowEquipmentAvailablePage = lazyWithReload(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentAvailablePage"),
);
const BorrowEquipmentDetailPage = lazyWithReload(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentDetailPage"),
);
const NotificationsPage = lazyWithReload(() => import("@/pages/dashboard/account/NotificationsPage"));
const MyProfilePage = lazyWithReload(() => import("@/pages/dashboard/account/MyProfilePage"));
const AdminHomePage = lazyWithReload(() => import("@/pages/admin/home/AdminHomePage"));
const AdminSchedulePage = lazyWithReload(() => import("@/pages/admin/schedules/AdminSchedulePage"));
const AdminAnnouncementPage = lazyWithReload(
  () => import("@/pages/admin/information/AdminAnnouncementPage"),
);
const AdminFaqPage = lazyWithReload(() => import("@/pages/admin/information/AdminFaqPage"));
const AdminEquipmentPage = lazyWithReload(() => import("@/pages/admin/inventory/AdminEquipmentPage"));
const AdminMaterialPage = lazyWithReload(() => import("@/pages/admin/inventory/AdminMaterialPage"));
const AdminSoftwarePage = lazyWithReload(() => import("@/pages/admin/inventory/AdminSoftwarePage"));
const AdminRoomPage = lazyWithReload(() => import("@/pages/admin/inventory/AdminRoomPage"));
const AdminRoomBookingHistoryPage = lazyWithReload(
  () => import("@/pages/admin/history/AdminRoomBookingHistoryPage"),
);
const AdminEquipmentBorrowHistoryPage = lazyWithReload(
  () => import("@/pages/admin/history/AdminEquipmentBorrowHistoryPage"),
);
const AdminSampleTestingHistoryPage = lazyWithReload(
  () => import("@/pages/admin/history/AdminSampleTestingHistoryPage"),
);
const AdminSampleTestingDocumentsPage = lazyWithReload(
  () => import("@/pages/admin/documents/AdminSampleTestingDocumentsPage"),
);
const AdminLabClearancePage = lazyWithReload(
  () => import("@/pages/admin/documents/AdminLabClearancePage"),
);
const AdminMyProfilePage = lazyWithReload(() => import("@/pages/admin/profile/AdminMyProfilePage"));
const UserManagementAllPage = lazyWithReload(
  () => import("@/pages/admin/user-management/UserManagementAllPage"),
);
const UserManagementStudentPage = lazyWithReload(
  () => import("@/pages/admin/user-management/UserManagementStudentPage"),
);
const UserManagementLecturerPage = lazyWithReload(
  () => import("@/pages/admin/user-management/UserManagementLecturerPage"),
);
const UserManagementAdminPage = lazyWithReload(
  () => import("@/pages/admin/user-management/UserManagementAdminPage"),
);
const UserManagementStaffPage = lazyWithReload(
  () => import("@/pages/admin/user-management/UserManagementStaffPage"),
);
const UserManagementGuestPage = lazyWithReload(
  () => import("@/pages/admin/user-management/UserManagementGuestPage"),
);
const TaskManagementAdvisorPage = lazyWithReload(
  () => import("@/pages/admin/task-management/TaskManagementAdvisorPage"),
);
const TaskManagementRoomPicPage = lazyWithReload(
  () => import("@/pages/admin/task-management/TaskManagementRoomPicPage"),
);
const NotFoundPage = lazyWithReload(() => import("@/pages/errors/NotFoundPage"));

function RoutePending() {
  return (
    <div className="flex min-h-[40vh] items-center justify-center text-slate-500">
      <Loader2 className="h-5 w-5 animate-spin" />
    </div>
  );
}

function withRouteSuspense(element: ReactNode) {
  return <Suspense fallback={<RoutePending />}>{element}</Suspense>;
}

function renderPage(PageComponent: ComponentType) {
  return withRouteSuspense(<PageComponent />);
}

function AuthLayoutOutlet() {
  return (
    <AuthLayout>
      <Outlet />
    </AuthLayout>
  );
}

function RootRedirect() {
  return <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  { path: "/", element: <RootRedirect /> },
  {
    element: <AuthLayoutOutlet />,
    children: [
      { path: "login", element: renderPage(LoginPage) },
      { path: "forgot-password", element: renderPage(ForgotPasswordPage) },
      { path: "signup-guest", element: renderPage(SignupGuestPage) },
      { path: "signup-guest/verify/:key", element: renderPage(SignupGuestVerifyPage) },
      { path: "reset-password/:uid/:token", element: renderPage(ResetPasswordPage) },
    ],
  },
  {
    element: (
      <RequireAuth>
        <UserLayout />
      </RequireAuth>
    ),
    children: [
      {
        path: "dashboard",
        element: (
          <RequireMenuAccess menuId="dashboard">
            <Outlet />
          </RequireMenuAccess>
        ),
        children: [
          { index: true, element: renderPage(DashboardHomePage) },
          { path: "overview", element: renderPage(DashboardOverviewPage) },
          { path: "announcements", element: renderPage(DashboardAnnouncementsPage) },
          { path: "faq", element: renderPage(DashboardFaqPage) },
          { path: "organization-structure", element: renderPage(DashboardOrganizationStructurePage) },
        ],
      },
      {
        path: "schedule",
        element: (
          <RequireMenuAccess menuId="schedule">
            {renderPage(SchedulePage)}
          </RequireMenuAccess>
        ),
      },
      {
        path: "booking-rooms",
        element: (
          <RequireMenuAccess menuId="booking-rooms">
            <Outlet />
          </RequireMenuAccess>
        ),
        children: [
          {
            index: true,
            element: (
              <RequireFeatureScope featurePath="/booking-rooms" scope="requester">
                {renderPage(BookingRoomsListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "form",
            element: (
              <RequireFeatureScope featurePath="/booking-rooms" scope="requester">
                {renderPage(BookingRoomsFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval",
            element: (
              <RequireFeatureScope featurePath="/booking-rooms" scope="approval">
                {renderPage(BookingRoomsAllListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval/:id",
            element: (
              <RequireFeatureScope featurePath="/booking-rooms" scope="approval">
                {renderPage(BookingRoomsDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id/edit",
            element: (
              <RequireFeatureScope featurePath="/booking-rooms" scope="requester">
                {renderPage(BookingRoomsFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id",
            element: (
              <RequireFeatureScope featurePath="/booking-rooms" scope="requester">
                {renderPage(BookingRoomsDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "rooms",
            element: renderPage(RoomsListPage),
          },
          {
            path: "rooms/:id",
            element: renderPage(RoomDetailPage),
          },
          {
            path: "equipment",
            element: renderPage(BookingEquipmentListPage),
          },
          {
            path: "equipment/:id",
            element: renderPage(BookingEquipmentDetailPage),
          },
          {
            path: "materials",
            element: renderPage(BookingMaterialListPage),
          },
          {
            path: "materials/:id",
            element: renderPage(BookingMaterialDetailPage),
          },
          {
            path: "software",
            element: renderPage(BookingSoftwareListPage),
          },
        ],
      },
      {
        path: "sample-testing",
        element: (
          <RequireMenuAccess menuId="sample-testing">
            <Outlet />
          </RequireMenuAccess>
        ),
        children: [
          {
            index: true,
            element: (
              <RequireFeatureScope featurePath="/sample-testing" scope="requester">
                {renderPage(SampleTestingListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "form",
            element: (
              <RequireFeatureScope featurePath="/sample-testing" scope="requester">
                {renderPage(SampleTestingFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id/edit",
            element: (
              <RequireFeatureScope featurePath="/sample-testing" scope="requester">
                {renderPage(SampleTestingFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id",
            element: (
              <RequireFeatureScope featurePath="/sample-testing" scope="requester">
                {renderPage(SampleTestingDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval",
            element: (
              <RequireFeatureScope featurePath="/sample-testing" scope="approval">
                {renderPage(SampleTestingAllListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval/:id",
            element: (
              <RequireFeatureScope featurePath="/sample-testing" scope="approval">
                {renderPage(SampleTestingDetailPage)}
              </RequireFeatureScope>
            ),
          },
        ],
      },
      {
        path: "borrow-equipment",
        element: (
          <RequireMenuAccess menuId="borrow-equipment">
            <Outlet />
          </RequireMenuAccess>
        ),
        children: [
          {
            index: true,
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="requester">
                {renderPage(BorrowEquipmentListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "form",
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="requester">
                {renderPage(BorrowEquipmentFormPage)}
              </RequireFeatureScope>
            ),
          },
          { path: "equipment", element: renderPage(BorrowEquipmentAvailablePage) },
          {
            path: "approval",
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="approval">
                {renderPage(BorrowEquipmentAllListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval/:id",
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="approval">
                {renderPage(BorrowEquipmentDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id/edit",
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="requester">
                {renderPage(BorrowEquipmentFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "equipment/:id",
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="requester">
                {renderPage(BookingEquipmentDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id",
            element: (
              <RequireFeatureScope featurePath="/borrow-equipment" scope="requester">
                {renderPage(BorrowEquipmentDetailPage)}
              </RequireFeatureScope>
            ),
          },
        ],
      },
      {
        path: "notifications",
        element: (
          <RequireMenuAccess menuId="notifications">
            {renderPage(NotificationsPage)}
          </RequireMenuAccess>
        ),
      },
      {
        path: "my-profile",
        element: (
          <RequireMenuAccess menuId="my-profile">
            <Outlet />
          </RequireMenuAccess>
        ),
        children: [
          { index: true, element: renderPage(MyProfilePage) },
          { path: "edit", element: renderPage(MyProfilePage) },
          { path: "security", element: renderPage(MyProfilePage) },
        ],
      },
    ],
  },
  {
    path: "/admin",
    element: (
      <RequireAuth>
        <RequireAdmin>
          <AdminLayout />
        </RequireAdmin>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="home" replace /> },
      { path: "home", element: renderPage(AdminHomePage) },
      { path: "schedules", element: renderPage(AdminSchedulePage) },
      { path: "my-profile", element: renderPage(AdminMyProfilePage) },
      {
        path: "information",
        children: [
          { index: true, element: <Navigate to="announcements" replace /> },
          { path: "schedules", element: <Navigate to="/admin/schedules" replace /> },
          { path: "announcements", element: renderPage(AdminAnnouncementPage) },
          { path: "faq", element: renderPage(AdminFaqPage) },
        ],
      },
      {
        path: "inventory",
        children: [
          { index: true, element: <Navigate to="equipment" replace /> },
          { path: "equipment", element: renderPage(AdminEquipmentPage) },
          { path: "materials", element: renderPage(AdminMaterialPage) },
          { path: "software", element: renderPage(AdminSoftwarePage) },
          { path: "rooms", element: renderPage(AdminRoomPage) },
        ],
      },
      {
        path: "history",
        children: [
          { path: "room-bookings", element: renderPage(AdminRoomBookingHistoryPage) },
          { path: "equipment-borrows", element: renderPage(AdminEquipmentBorrowHistoryPage) },
          { path: "sample-testing", element: renderPage(AdminSampleTestingHistoryPage) },
        ],
      },
      {
        path: "documents",
        children: [
          { index: true, element: <Navigate to="sample-testing" replace /> },
          { path: "sample-testing", element: renderPage(AdminSampleTestingDocumentsPage) },
          { path: "lab-clearance", element: renderPage(AdminLabClearancePage) },
        ],
      },
      {
        path: "user-management",
        children: [
          { index: true, element: <Navigate to="list-users" replace /> },
          { path: "all", element: <Navigate to="/admin/user-management/list-users" replace /> },
          { path: "list-users", element: renderPage(UserManagementAllPage) },
          { path: "student", element: <Navigate to="/admin/user-management/role/student" replace /> },
          { path: "lecturer", element: <Navigate to="/admin/user-management/role/lecturer" replace /> },
          { path: "admin", element: <Navigate to="/admin/user-management/role/admin" replace /> },
          { path: "staff", element: <Navigate to="/admin/user-management/role/staff" replace /> },
          { path: "guest", element: <Navigate to="/admin/user-management/role/guest" replace /> },
          { path: "role/student", element: renderPage(UserManagementStudentPage) },
          { path: "role/lecturer", element: renderPage(UserManagementLecturerPage) },
          { path: "role/admin", element: renderPage(UserManagementAdminPage) },
          { path: "role/staff", element: renderPage(UserManagementStaffPage) },
          { path: "role/guest", element: renderPage(UserManagementGuestPage) },
          {
            path: "task/dosen-pembimbing",
            element: <Navigate to="/admin/task-management/dosen-pembimbing" replace />,
          },
          {
            path: "task/pic-ruangan",
            element: <Navigate to="/admin/task-management/pic-ruangan" replace />,
          },
        ],
      },
      {
        path: "task-management",
        children: [
          { index: true, element: <Navigate to="dosen-pembimbing" replace /> },
          { path: "dosen-pembimbing", element: renderPage(TaskManagementAdvisorPage) },
          { path: "pic-ruangan", element: renderPage(TaskManagementRoomPicPage) },
        ],
      },
    ],
  },
  { path: "*", element: renderPage(NotFoundPage) },
]);
