import { Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { MustChangePasswordGuard } from './components/auth/MustChangePasswordGuard';
import { RoleGuard } from './components/auth/RoleGuard';
import { AppLayout } from './components/layout/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { DashboardPage } from './pages/DashboardPage';
import { DocumentsExplorerPage } from './pages/documents/DocumentsExplorerPage';
import { DirectoryPage } from './pages/directory/DirectoryPage';
import { AnnouncementsFeedPage } from './pages/announcements/AnnouncementsFeedPage';
import { AnnouncementDetailPage } from './pages/announcements/AnnouncementDetailPage';
import {
  AnnouncementCreatePage,
  AnnouncementEditPage,
} from './pages/announcements/AnnouncementFormPages';
import { AnnouncementsManagePage } from './pages/announcements/AnnouncementsManagePage';
import { ChangePasswordPage } from './pages/ChangePasswordPage';
import { ProfilePage } from './pages/collaborator/ProfilePage';
import { NotFoundPage } from './pages/NotFoundPage';
import { CollaboratorsListPage } from './pages/admin/CollaboratorsListPage';
import { CollaboratorDetailPage } from './pages/admin/CollaboratorDetailPage';
import { CollaboratorCreatePage, CollaboratorEditPage } from './pages/admin/CollaboratorFormPages';
import { AreasListPage } from './pages/admin/AreasListPage';
import { AreaCreatePage, AreaEditPage } from './pages/admin/AreaFormPages';
import { PositionsListPage } from './pages/admin/PositionsListPage';
import { PositionCreatePage, PositionEditPage } from './pages/admin/PositionFormPages';
import { TagsListPage } from './pages/admin/TagsListPage';
import { TagCreatePage, TagEditPage } from './pages/admin/TagFormPages';
import { AreaAccessListPage } from './pages/admin/AreaAccessListPage';
import { AreaAccessCreatePage, AreaAccessEditPage } from './pages/admin/AreaAccessFormPages';
import { TicketCategoriesListPage } from './pages/admin/TicketCategoriesListPage';
import {
  TicketCategoryCreatePage,
  TicketCategoryEditPage,
} from './pages/admin/TicketCategoryFormPages';
import { InventoryCategoriesPage } from './pages/admin/InventoryCategoriesPage';
import { MyTicketsPage } from './pages/service-desk/MyTicketsPage';
import { TicketCreatePage } from './pages/service-desk/TicketCreatePage';
import { TicketDetailPage } from './pages/service-desk/TicketDetailPage';
import { ServiceDeskManagePage } from './pages/service-desk/ServiceDeskManagePage';
import { ActivitiesPage } from './pages/activities/ActivitiesPage';
import { ActivitiesMetricsPage } from './pages/activities/ActivitiesMetricsPage';
import { MeetingsListPage } from './pages/meetings/MeetingsListPage';
import { RequestsPage } from './pages/requests/RequestsPage';
import { RequestDetailPage } from './pages/requests/RequestDetailPage';
import { InventoryPage } from './pages/ti-inventory/InventoryPage';
import { ItInventoryGuard } from './components/auth/ItInventoryGuard';
import { MeetingFormPage } from './pages/meetings/MeetingFormPage';
import { MeetingDetailPage } from './pages/meetings/MeetingDetailPage';
import { AreaLeaderGuard } from './components/auth/AreaLeaderGuard';
import { LearningManagerGuard } from './components/auth/LearningManagerGuard';
import { ADMIN_ROLES } from './config/roles';
import { LearningCatalogPage } from './pages/learning/LearningCatalogPage';
import { LearningCoursePage } from './pages/learning/LearningCoursePage';
import { LearningManageListPage } from './pages/learning/LearningManageListPage';
import { LearningCourseFormPage } from './pages/learning/LearningCourseFormPage';
import { LearningCourseStructurePage } from './pages/learning/LearningCourseStructurePage';
import { LearningCourseReportPage } from './pages/learning/LearningCourseReportPage';
import { MessengerPage } from './pages/messenger/MessengerPage';
import {
  ChatExceptionCreatePage,
  ChatExceptionEditPage,
} from './pages/admin/ChatExceptionFormPages';
import { ChatExceptionsListPage } from './pages/admin/ChatExceptionsListPage';
import { EventsManagePage } from './pages/admin/EventsManagePage';
import { EventCreatePage, EventEditPage } from './pages/admin/EventFormPages';
import { EventsListPage } from './pages/events/EventsListPage';
import { EventDetailPage } from './pages/events/EventDetailPage';

function AdminRoutes() {
  return (
    <RoleGuard allowedRoles={[...ADMIN_ROLES]}>
      <Routes>
        <Route path="colaboradores" element={<CollaboratorsListPage />} />
        <Route path="colaboradores/nuevo" element={<CollaboratorCreatePage />} />
        <Route path="colaboradores/:id" element={<CollaboratorDetailPage />} />
        <Route path="colaboradores/:id/editar" element={<CollaboratorEditPage />} />
        <Route path="areas" element={<AreasListPage />} />
        <Route path="areas/nuevo" element={<AreaCreatePage />} />
        <Route path="areas/:id/editar" element={<AreaEditPage />} />
        <Route path="positions" element={<PositionsListPage />} />
        <Route path="positions/nuevo" element={<PositionCreatePage />} />
        <Route path="positions/:id/editar" element={<PositionEditPage />} />
        <Route path="tags" element={<TagsListPage />} />
        <Route path="tags/nuevo" element={<TagCreatePage />} />
        <Route path="tags/:id/editar" element={<TagEditPage />} />
        <Route path="area-access" element={<AreaAccessListPage />} />
        <Route path="area-access/nuevo" element={<AreaAccessCreatePage />} />
        <Route path="area-access/:id/editar" element={<AreaAccessEditPage />} />
        <Route path="chat-exceptions" element={<ChatExceptionsListPage />} />
        <Route path="chat-exceptions/nuevo" element={<ChatExceptionCreatePage />} />
        <Route path="chat-exceptions/:id/editar" element={<ChatExceptionEditPage />} />
        <Route path="ticket-categories" element={<TicketCategoriesListPage />} />
        <Route path="ticket-categories/nuevo" element={<TicketCategoryCreatePage />} />
        <Route path="ticket-categories/:id/editar" element={<TicketCategoryEditPage />} />
        <Route path="inventory-categories" element={<InventoryCategoriesPage />} />
        <Route path="eventos" element={<EventsManagePage />} />
        <Route path="eventos/nuevo" element={<EventCreatePage />} />
        <Route path="eventos/:id/editar" element={<EventEditPage />} />
      </Routes>
    </RoleGuard>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/olvide-contrasena" element={<ForgotPasswordPage />} />
      <Route path="/restablecer-contrasena" element={<ResetPasswordPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route path="cambiar-contrasena" element={<ChangePasswordPage />} />
          <Route element={<MustChangePasswordGuard />}>
            <Route index element={<DashboardPage />} />
            <Route path="mi-perfil" element={<ProfilePage />} />
            <Route path="documentos" element={<DocumentsExplorerPage />} />
            <Route path="actividades" element={<ActivitiesPage />} />
            <Route
              path="actividades/metricas"
              element={
                <AreaLeaderGuard>
                  <ActivitiesMetricsPage />
                </AreaLeaderGuard>
              }
            />
            <Route path="comunicados" element={<AnnouncementsFeedPage />} />
            <Route path="comunicados/gestion" element={<AnnouncementsManagePage />} />
            <Route path="comunicados/gestion/nuevo" element={<AnnouncementCreatePage />} />
            <Route path="comunicados/gestion/:id/editar" element={<AnnouncementEditPage />} />
            <Route path="comunicados/:id" element={<AnnouncementDetailPage />} />
            <Route path="reuniones" element={<MeetingsListPage />} />
            <Route path="reuniones/nueva" element={<MeetingFormPage />} />
            <Route path="reuniones/:id" element={<MeetingDetailPage />} />
            <Route path="reuniones/:id/editar" element={<MeetingFormPage />} />
            <Route path="solicitudes" element={<RequestsPage />} />
            <Route path="solicitudes/:id" element={<RequestDetailPage />} />
            <Route path="service-desk" element={<MyTicketsPage />} />
            <Route path="service-desk/nuevo" element={<TicketCreatePage />} />
            <Route path="service-desk/gestion" element={<ServiceDeskManagePage />} />
            <Route
              path="ti/inventario"
              element={
                <ItInventoryGuard>
                  <InventoryPage />
                </ItInventoryGuard>
              }
            />
            <Route path="service-desk/gestion/:id" element={<TicketDetailPage manageMode />} />
            <Route path="service-desk/:id" element={<TicketDetailPage />} />
            <Route path="eventos" element={<EventsListPage />} />
            <Route path="eventos/:id" element={<EventDetailPage />} />
            <Route path="directorio" element={<DirectoryPage />} />
            <Route path="messenger" element={<MessengerPage />} />
            <Route path="learning" element={<LearningCatalogPage />} />
            <Route
              path="learning/gestion"
              element={
                <LearningManagerGuard>
                  <LearningManageListPage />
                </LearningManagerGuard>
              }
            />
            <Route
              path="learning/gestion/nuevo"
              element={
                <LearningManagerGuard>
                  <LearningCourseFormPage />
                </LearningManagerGuard>
              }
            />
            <Route
              path="learning/gestion/:courseId/editar"
              element={
                <LearningManagerGuard>
                  <LearningCourseFormPage />
                </LearningManagerGuard>
              }
            />
            <Route
              path="learning/gestion/:courseId/reporte"
              element={
                <LearningManagerGuard>
                  <LearningCourseReportPage />
                </LearningManagerGuard>
              }
            />
            <Route
              path="learning/gestion/:courseId"
              element={
                <LearningManagerGuard>
                  <LearningCourseStructurePage />
                </LearningManagerGuard>
              }
            />
            <Route path="learning/:courseId" element={<LearningCoursePage />} />
            <Route path="admin/*" element={<AdminRoutes />} />
          </Route>
        </Route>
      </Route>
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}

export default App;
