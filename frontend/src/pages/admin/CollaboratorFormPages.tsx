import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import { createCollaborator, fetchCollaborator, updateCollaborator } from '../../api/collaborators';
import { deleteUserAvatar, uploadUserAvatar } from '../../api/users';
import {
  CollaboratorForm,
  type CollaboratorFormValues,
} from '../../components/admin/CollaboratorForm';
import { PageHeader } from '../../components/layout';

export function CollaboratorCreatePage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [warningMessage, setWarningMessage] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const handleSubmit = async (values: CollaboratorFormValues) => {
    setLoading(true);
    setError('');
    try {
      const res = await createCollaborator({
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        roleId: Number.parseInt(values.roleId, 10),
        areaId: Number.parseInt(values.areaId, 10),
        positionId: Number.parseInt(values.positionId, 10),
        isActive: values.isActive,
      });
      if (avatarFile) {
        await uploadUserAvatar(res.collaborator.id, avatarFile);
      }
      if (res.emailSent) {
        setSuccessMessage(
          `Colaborador creado. Se envió un correo a ${res.collaborator.email} con la contraseña temporal.`,
        );
      } else {
        setWarningMessage(
          `Colaborador creado, pero no se pudo enviar el correo de bienvenida a ${res.collaborator.email}. Verifique SMTP.`,
        );
      }
      setTimeout(() => navigate(`/admin/colaboradores/${res.collaborator.id}`), 2000);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo crear el colaborador');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <PageHeader
        title="Nuevo colaborador"
        breadcrumbParent="Colaboradores"
        breadcrumbCurrent="Alta"
        breadcrumbParentHref="/admin/colaboradores"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      {successMessage && (
        <div className="admin-alert admin-alert--success mb-20">{successMessage}</div>
      )}
      {warningMessage && (
        <div className="admin-alert admin-alert--warning mb-20">{warningMessage}</div>
      )}
      <CollaboratorForm
        submitLabel="Crear colaborador"
        loading={loading}
        avatarFile={avatarFile}
        onAvatarFileChange={setAvatarFile}
        onSubmit={handleSubmit}
        onCancel={() => navigate('/admin/colaboradores')}
      />
    </>
  );
}

export function CollaboratorEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState('');
  const [initialValues, setInitialValues] = useState<Partial<CollaboratorFormValues>>();
  const [initialPosition, setInitialPosition] = useState<{ id: number; name: string }>();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarRemovePending, setAvatarRemovePending] = useState(false);

  useEffect(() => {
    const userId = Number.parseInt(id ?? '', 10);
    if (Number.isNaN(userId)) {
      setError('Identificador inválido');
      setFetching(false);
      return;
    }
    void (async () => {
      try {
        const res = await fetchCollaborator(userId);
        const c = res.collaborator;
        setInitialValues({
          firstName: c.firstName,
          lastName: c.lastName,
          email: c.email,
          roleId: String(c.role.id),
          areaId: String(c.area.id),
          positionId: String(c.position.id),
          isActive: c.isActive,
        });
        setInitialPosition({ id: c.position.id, name: c.position.name });
        setAvatarUrl(c.avatarUrl);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'No se pudo cargar el colaborador');
      } finally {
        setFetching(false);
      }
    })();
  }, [id]);

  const handleSubmit = async (values: CollaboratorFormValues) => {
    const userId = Number.parseInt(id ?? '', 10);
    setLoading(true);
    setError('');
    try {
      await updateCollaborator(userId, {
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        email: values.email.trim(),
        roleId: Number.parseInt(values.roleId, 10),
        areaId: Number.parseInt(values.areaId, 10),
        positionId: Number.parseInt(values.positionId, 10),
      });
      if (avatarRemovePending) {
        await deleteUserAvatar(userId);
      } else if (avatarFile) {
        const res = await uploadUserAvatar(userId, avatarFile);
        setAvatarUrl(res.avatarUrl);
      }
      navigate(`/admin/colaboradores/${userId}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el colaborador');
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return <p className="text-gray">Cargando…</p>;
  }

  if (!initialValues) {
    return (
      <>
        <div className="admin-alert admin-alert--error mb-20">
          {error || 'Colaborador no encontrado'}
        </div>
        <Link to="/admin/colaboradores" className="admin-btn admin-btn--ghost">
          Volver al listado
        </Link>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Editar colaborador"
        breadcrumbParent="Colaboradores"
        breadcrumbCurrent="Edición"
        breadcrumbParentHref="/admin/colaboradores"
      />
      {error && <div className="admin-alert admin-alert--error mb-20">{error}</div>}
      <CollaboratorForm
        initialValues={initialValues}
        initialPosition={initialPosition}
        mode="edit"
        userId={Number.parseInt(id ?? '', 10)}
        avatarUrl={avatarUrl}
        avatarFile={avatarFile}
        avatarRemovePending={avatarRemovePending}
        onAvatarFileChange={(file) => {
          setAvatarFile(file);
          if (file) setAvatarRemovePending(false);
        }}
        onAvatarRemove={() => {
          setAvatarRemovePending(true);
          setAvatarFile(null);
        }}
        submitLabel="Guardar cambios"
        loading={loading}
        onSubmit={handleSubmit}
        onCancel={() => navigate(`/admin/colaboradores/${id}`)}
      />
    </>
  );
}
