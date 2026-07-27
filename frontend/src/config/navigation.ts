import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  Users,
  Megaphone,
  FolderOpen,
  UserCircle,
  LifeBuoy,
  Kanban,
  GraduationCap,
  MessageCircle,
  SearchCheck,
} from 'lucide-react';
import { isAdminRole } from './roles';

export interface NavChildItem {
  id: string;
  path: string;
  label: string;
  ready?: boolean;
}

export interface NavMenuItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Enlace directo (sin submenú) */
  path?: string;
  ready?: boolean;
  children?: NavChildItem[];
}

const SOPORTE_TI_MENU: NavMenuItem = {
  id: 'soporte-ti',
  label: 'Soporte TI',
  icon: LifeBuoy,
  children: [
    {
      id: 'service-desk',
      path: '/service-desk',
      label: 'Solicitud de Soporte TI',
      ready: true,
    },
  ],
};

const ACTIVIDADES_MENU: NavMenuItem = {
  id: 'actividades',
  label: 'Actividades',
  icon: Kanban,
  children: [
    {
      id: 'actividades-tareas',
      path: '/actividades',
      label: 'Gestión de Tareas',
      ready: true,
    },
  ],
};

const METRICAS_NAV_ITEM: NavChildItem = {
  id: 'actividades-metricas',
  path: '/actividades/metricas',
  label: 'Métricas',
  ready: true,
};

/** Menú colaborador — sin sección administrativa */
export const COLLABORATOR_NAV: NavMenuItem[] = [
  {
    id: 'dashboard',
    label: 'Inicio',
    icon: LayoutDashboard,
    path: '/',
    ready: true,
  },
  {
    id: 'comunicacion',
    label: 'Comunicación',
    icon: Megaphone,
    children: [
      { id: 'comunicados', path: '/comunicados', label: 'Comunicados', ready: true },
      { id: 'reuniones', path: '/reuniones', label: 'Reuniones', ready: true },
      { id: 'solicitudes', path: '/solicitudes', label: 'Solicitudes', ready: true },
      { id: 'eventos', path: '/eventos', label: 'Eventos', ready: true },
    ],
  },
  SOPORTE_TI_MENU,
  ACTIVIDADES_MENU,
  {
    id: 'recursos',
    label: 'Recursos',
    icon: FolderOpen,
    children: [
      { id: 'documentos', path: '/documentos', label: 'Documentos', ready: true },
      { id: 'directorio', path: '/directorio', label: 'Directorio', ready: true },
    ],
  },
  {
    id: 'cuenta',
    label: 'Mi cuenta',
    icon: UserCircle,
    children: [
      { id: 'perfil', path: '/mi-perfil', label: 'Mi perfil', ready: true },
      { id: 'password', path: '/cambiar-contrasena', label: 'Contraseña', ready: true },
    ],
  },
  {
    id: 'chat',
    label: 'Chat Insular',
    icon: MessageCircle,
    path: '/messenger',
    ready: true,
  },
  {
    id: 'consulta-seniat',
    label: 'Consulta Seniat',
    icon: SearchCheck,
    path: '/consulta-seniat',
    ready: true,
  },
];

function buildLearningMenu(canManage: boolean): NavMenuItem {
  const children: NavChildItem[] = [
    { id: 'learning-catalog', path: '/learning', label: 'Mis cursos', ready: true },
  ];
  if (canManage) {
    children.push({
      id: 'learning-gestion',
      path: '/learning/gestion',
      label: 'Gestión de cursos',
      ready: true,
    });
  }
  return {
    id: 'learning-menu',
    label: 'Insular Learning',
    icon: GraduationCap,
    children,
  };
}

/** Menú administrador */
export const ADMIN_NAV: NavMenuItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    path: '/',
    ready: true,
  },
  {
    id: 'administracion',
    label: 'Administración',
    icon: Users,
    children: [
      { id: 'colaboradores', path: '/admin/colaboradores', label: 'Colaboradores', ready: true },
      { id: 'areas', path: '/admin/areas', label: 'Áreas', ready: true },
      { id: 'positions', path: '/admin/positions', label: 'Cargos', ready: true },
      { id: 'tags', path: '/admin/tags', label: 'Etiquetas', ready: true },
      {
        id: 'area-access',
        path: '/admin/area-access',
        label: 'Acceso entre áreas',
        ready: true,
      },
      {
        id: 'chat-exceptions',
        path: '/admin/chat-exceptions',
        label: 'Excepciones de chat',
        ready: true,
      },
      {
        id: 'ticket-categories',
        path: '/admin/ticket-categories',
        label: 'Categorías Soporte TI',
        ready: true,
      },
      {
        id: 'inventory-categories',
        path: '/admin/inventory-categories',
        label: 'Categorías de inventario',
        ready: true,
      },
    ],
  },
  {
    id: 'comunicacion',
    label: 'Comunicación',
    icon: Megaphone,
    children: [
      { id: 'comunicados', path: '/comunicados', label: 'Comunicados', ready: true },
      { id: 'reuniones', path: '/reuniones', label: 'Reuniones', ready: true },
      { id: 'eventos', path: '/eventos', label: 'Eventos', ready: true },
      { id: 'eventos-admin', path: '/admin/eventos', label: 'Gestión de Eventos', ready: true },
      { id: 'solicitudes', path: '/solicitudes', label: 'Solicitudes', ready: true },
    ],
  },
  SOPORTE_TI_MENU,
  ACTIVIDADES_MENU,
  {
    id: 'recursos',
    label: 'Recursos',
    icon: FolderOpen,
    children: [
      { id: 'documentos', path: '/documentos', label: 'Documentos', ready: true },
      { id: 'directorio', path: '/directorio', label: 'Directorio', ready: true },
    ],
  },
  {
    id: 'cuenta',
    label: 'Mi cuenta',
    icon: UserCircle,
    children: [
      { id: 'perfil', path: '/mi-perfil', label: 'Mi perfil', ready: true },
      { id: 'password', path: '/cambiar-contrasena', label: 'Contraseña', ready: true },
    ],
  },
  {
    id: 'chat',
    label: 'Chat Insular',
    icon: MessageCircle,
    path: '/messenger',
    ready: true,
  },
  {
    id: 'consulta-seniat',
    label: 'Consulta Seniat',
    icon: SearchCheck,
    path: '/consulta-seniat',
    ready: true,
  },
];

export function getNavForRole(roleName: string): NavMenuItem[] {
  return isAdminRole(roleName) ? ADMIN_NAV : COLLABORATOR_NAV;
}

/** Inyecta la mesa de ayuda TI cuando el usuario pertenece al área de soporte. */
export function getNavForUser(
  roleName: string,
  isItAgent: boolean,
  canViewMetrics: boolean,
  canManageLearningNav = false,
): NavMenuItem[] {
  let base = getNavForRole(roleName);

  if (!base.some((i) => i.id === 'learning-menu')) {
    const recursosIdx = base.findIndex((i) => i.id === 'recursos');
    const insertAt = recursosIdx >= 0 ? recursosIdx + 1 : base.length;
    base = [
      ...base.slice(0, insertAt),
      buildLearningMenu(canManageLearningNav),
      ...base.slice(insertAt),
    ];
  }

  base = base.map((item) => {
    if (item.id !== 'actividades' || !item.children) return item;
    const children = [...item.children];
    if (canViewMetrics && !children.some((c) => c.id === 'actividades-metricas')) {
      children.push(METRICAS_NAV_ITEM);
    }
    return { ...item, children };
  });

  const showTiInventory = isItAgent || isAdminRole(roleName);

  if (!showTiInventory) return base;

  return base.map((item) => {
    if (item.id !== 'soporte-ti' || !item.children) return item;
    if (item.children.some((c) => c.id === 'service-desk-gestion')) return item;

    const children = [...item.children!];
    if (!children.some((c) => c.id === 'service-desk-gestion')) {
      children.push({
        id: 'service-desk-gestion',
        path: '/service-desk/gestion',
        label: 'Mesa de ayuda TI',
        ready: true,
      });
    }
    if (!children.some((c) => c.id === 'ti-inventario')) {
      children.push({
        id: 'ti-inventario',
        path: '/ti/inventario',
        label: 'Inventario',
        ready: true,
      });
    }
    return { ...item, children };
  });
}

export function isPathActive(pathname: string, item: NavMenuItem): boolean {
  if (item.path) {
    return item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
  }
  return item.children?.some((child) => isChildPathActive(pathname, child.path)) ?? false;
}

export function isChildPathActive(pathname: string, path: string): boolean {
  if (path === '/') return pathname === '/';
  if (pathname === path) return true;
  if (!pathname.startsWith(`${path}/`)) return false;
  // Rama de gestión TI es un ítem de menú aparte, no hijo de la solicitud de soporte
  if (path === '/service-desk' && pathname.startsWith('/service-desk/gestion')) {
    return false;
  }
  if (path === '/actividades' && pathname.startsWith('/actividades/metricas')) {
    return false;
  }
  if (path === '/learning' && pathname.startsWith('/learning/gestion')) {
    return false;
  }
  if (path === '/eventos' && pathname.startsWith('/admin/eventos')) {
    return false;
  }
  return true;
}

export const AXERO_ASSETS = '/axero/assets';

export function axeroImage(path: string): string {
  return `${AXERO_ASSETS}/images/${path}`;
}

export function getOpenMenuIds(pathname: string, items: NavMenuItem[]): string[] {
  return items
    .filter((item) => item.children?.some((c) => isChildPathActive(pathname, c.path)))
    .map((item) => item.id);
}
