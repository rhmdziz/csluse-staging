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

const LoginPage = lazy(() => import("@/pages/auth/LoginPage"));
const ForgotPasswordPage = lazy(() => import("@/pages/auth/ForgotPasswordPage"));
const SignupGuestPage = lazy(() => import("@/pages/auth/SignupGuestPage"));
const SignupGuestVerifyPage = lazy(() => import("@/pages/auth/SignupGuestVerifyPage"));
const ResetPasswordPage = lazy(() => import("@/pages/auth/ResetPasswordPage"));
const DashboardHomePage = lazy(() => import("@/pages/dashboard/DashboardHomePage"));
const DashboardOverviewPage = lazy(
  () => import("@/pages/dashboard/overview/DashboardOverviewPage"),
);
const DashboardAnnouncementsPage = lazy(
  () => import("@/pages/dashboard/announcements/DashboardAnnouncementsPage"),
);
const DashboardFaqPage = lazy(() => import("@/pages/dashboard/faq/DashboardFaqPage"));
const DashboardOrganizationStructurePage = lazy(
  () => import("@/pages/dashboard/organization/DashboardOrganizationStructurePage"),
);
const SchedulePage = lazy(() => import("@/pages/dashboard/schedule/SchedulePage"));
const BookingRoomsListPage = lazy(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsListPage"),
);
const BookingRoomsAllListPage = lazy(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsAllListPage"),
);
const BookingRoomsFormPage = lazy(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsFormPage"),
);
const BookingRoomsDetailPage = lazy(
  () => import("@/pages/dashboard/booking-rooms/BookingRoomsDetailPage"),
);
const RoomsListPage = lazy(() => import("@/pages/dashboard/booking-rooms/RoomsListPage"));
const RoomDetailPage = lazy(() => import("@/pages/dashboard/booking-rooms/RoomDetailPage"));
const UseEquipmentListPage = lazy(
  () => import("@/pages/dashboard/use-equipment/UseEquipmentListPage"),
);
const UseEquipmentAllListPage = lazy(
  () => import("@/pages/dashboard/use-equipment/UseEquipmentAllListPage"),
);
const UseEquipmentFormPage = lazy(
  () => import("@/pages/dashboard/use-equipment/UseEquipmentFormPage"),
);
const EquipmentListPage = lazy(
  () => import("@/pages/dashboard/use-equipment/EquipmentListPage"),
);
const MaterialListPage = lazy(
  () => import("@/pages/dashboard/use-equipment/MaterialListPage"),
);
const MaterialDetailPage = lazy(
  () => import("@/pages/dashboard/use-equipment/MaterialDetailPage"),
);
const SoftwareListPage = lazy(() => import("@/pages/dashboard/use-equipment/SoftwareListPage"));
const EquipmentDetailPage = lazy(
  () => import("@/pages/dashboard/use-equipment/EquipmentDetailPage"),
);
const UseEquipmentDetailPage = lazy(
  () => import("@/pages/dashboard/use-equipment/UseEquipmentDetailPage"),
);
const SampleTestingListPage = lazy(
  () => import("@/pages/dashboard/sample-testing/SampleTestingListPage"),
);
const SampleTestingAllListPage = lazy(
  () => import("@/pages/dashboard/sample-testing/SampleTestingAllListPage"),
);
const SampleTestingFormPage = lazy(
  () => import("@/pages/dashboard/sample-testing/SampleTestingFormPage"),
);
const SampleTestingDetailPage = lazy(
  () => import("@/pages/dashboard/sample-testing/SampleTestingDetailPage"),
);
const BorrowEquipmentListPage = lazy(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentListPage"),
);
const BorrowEquipmentAllListPage = lazy(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentAllListPage"),
);
const BorrowEquipmentFormPage = lazy(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentFormPage"),
);
const BorrowEquipmentAvailablePage = lazy(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentAvailablePage"),
);
const BorrowEquipmentDetailPage = lazy(
  () => import("@/pages/dashboard/borrow-equipment/BorrowEquipmentDetailPage"),
);
const NotificationsPage = lazy(() => import("@/pages/dashboard/account/NotificationsPage"));
const MyProfilePage = lazy(() => import("@/pages/dashboard/account/MyProfilePage"));
const AdminHomePage = lazy(() => import("@/pages/admin/home/AdminHomePage"));
const AdminSchedulePage = lazy(() => import("@/pages/admin/schedules/AdminSchedulePage"));
const AdminAnnouncementPage = lazy(
  () => import("@/pages/admin/information/AdminAnnouncementPage"),
);
const AdminFaqPage = lazy(() => import("@/pages/admin/information/AdminFaqPage"));
const AdminEquipmentPage = lazy(() => import("@/pages/admin/inventory/AdminEquipmentPage"));
const AdminMaterialPage = lazy(() => import("@/pages/admin/inventory/AdminMaterialPage"));
const AdminSoftwarePage = lazy(() => import("@/pages/admin/inventory/AdminSoftwarePage"));
const AdminRoomPage = lazy(() => import("@/pages/admin/inventory/AdminRoomPage"));
const AdminRoomBookingHistoryPage = lazy(
  () => import("@/pages/admin/history/AdminRoomBookingHistoryPage"),
);
const AdminEquipmentUsageHistoryPage = lazy(
  () => import("@/pages/admin/history/AdminEquipmentUsageHistoryPage"),
);
const AdminEquipmentBorrowHistoryPage = lazy(
  () => import("@/pages/admin/history/AdminEquipmentBorrowHistoryPage"),
);
const AdminSampleTestingHistoryPage = lazy(
  () => import("@/pages/admin/history/AdminSampleTestingHistoryPage"),
);
const AdminSampleTestingDocumentsPage = lazy(
  () => import("@/pages/admin/documents/AdminSampleTestingDocumentsPage"),
);
const AdminLabClearancePage = lazy(
  () => import("@/pages/admin/documents/AdminLabClearancePage"),
);
const AdminMyProfilePage = lazy(() => import("@/pages/admin/profile/AdminMyProfilePage"));
const UserManagementAllPage = lazy(
  () => import("@/pages/admin/user-management/UserManagementAllPage"),
);
const UserManagementStudentPage = lazy(
  () => import("@/pages/admin/user-management/UserManagementStudentPage"),
);
const UserManagementLecturerPage = lazy(
  () => import("@/pages/admin/user-management/UserManagementLecturerPage"),
);
const UserManagementAdminPage = lazy(
  () => import("@/pages/admin/user-management/UserManagementAdminPage"),
);
const UserManagementStaffPage = lazy(
  () => import("@/pages/admin/user-management/UserManagementStaffPage"),
);
const UserManagementGuestPage = lazy(
  () => import("@/pages/admin/user-management/UserManagementGuestPage"),
);
const TaskManagementAdvisorPage = lazy(
  () => import("@/pages/admin/task-management/TaskManagementAdvisorPage"),
);
const TaskManagementRoomPicPage = lazy(
  () => import("@/pages/admin/task-management/TaskManagementRoomPicPage"),
);
const NotFoundPage = lazy(() => import("@/pages/errors/NotFoundPage"));

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
        ],
      },
      {
        path: "rooms",
        element: (
          <RequireMenuAccess menuId="booking-rooms">
            {renderPage(RoomsListPage)}
          </RequireMenuAccess>
        ),
      },
      {
        path: "rooms/:id",
        element: (
          <RequireMenuAccess menuId="booking-rooms">
            {renderPage(RoomDetailPage)}
          </RequireMenuAccess>
        ),
      },
      {
        path: "use-equipment",
        element: (
          <RequireMenuAccess menuId="use-equipment">
            <Outlet />
          </RequireMenuAccess>
        ),
        children: [
          {
            index: true,
            element: (
              <RequireFeatureScope featurePath="/use-equipment" scope="requester">
                {renderPage(UseEquipmentListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "form",
            element: (
              <RequireFeatureScope featurePath="/use-equipment" scope="requester">
                {renderPage(UseEquipmentFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval",
            element: (
              <RequireFeatureScope featurePath="/use-equipment" scope="approval">
                {renderPage(UseEquipmentAllListPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "approval/:id",
            element: (
              <RequireFeatureScope featurePath="/use-equipment" scope="approval">
                {renderPage(UseEquipmentDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id/edit",
            element: (
              <RequireFeatureScope featurePath="/use-equipment" scope="requester">
                {renderPage(UseEquipmentFormPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: ":id",
            element: (
              <RequireFeatureScope featurePath="/use-equipment" scope="requester">
                {renderPage(UseEquipmentDetailPage)}
              </RequireFeatureScope>
            ),
          },
          {
            path: "equipment",
            element: (
              <RequireMenuAccess menuId="use-equipment">
                {renderPage(EquipmentListPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: "equipment/:id",
            element: (
              <RequireMenuAccess menuId="use-equipment">
                {renderPage(EquipmentDetailPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: "software",
            element: (
              <RequireMenuAccess menuId="use-equipment">
                {renderPage(SoftwareListPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: "materials",
            element: (
              <RequireMenuAccess menuId="use-equipment">
                {renderPage(MaterialListPage)}
              </RequireMenuAccess>
            ),
          },
          {
            path: "materials/:id",
            element: (
              <RequireMenuAccess menuId="use-equipment">
                {renderPage(MaterialDetailPage)}
              </RequireMenuAccess>
            ),
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
                {renderPage(EquipmentDetailPage)}
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
          { path: "equipment-usage", element: renderPage(AdminEquipmentUsageHistoryPage) },
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
