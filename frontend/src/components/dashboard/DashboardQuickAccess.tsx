import { Link } from 'react-router-dom';
import {
  BookOpen,
  CalendarDays,
  ClipboardList,
  FileText,
  Headphones,
  LayoutGrid,
  Settings,
  Users,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import type { DashboardQuickAccessItem } from '../../api/dashboard.types';

const ICONS: Record<string, LucideIcon> = {
  tasks: ClipboardList,
  requests: FileText,
  tickets: Headphones,
  meetings: CalendarDays,
  learning: BookOpen,
  documents: FileText,
  inbox: FileText,
  kanban: LayoutGrid,
  'desk-manage': Headphones,
  inventory: Wrench,
  'new-ticket': Headphones,
  admin: Settings,
  users: Users,
  areas: Users,
  announcements: FileText,
  metrics: LayoutGrid,
};

interface Props {
  items: DashboardQuickAccessItem[];
}

export function DashboardQuickAccess({ items }: Props) {
  return (
    <div className="collab-quick-grid">
      {items.map((item) => {
        const Icon = ICONS[item.key] ?? FileText;
        return (
          <Link key={item.key} to={item.href} className="collab-quick-card">
            <span className="collab-quick-card__icon" aria-hidden>
              <Icon size={22} strokeWidth={1.75} />
            </span>
            <span className="collab-quick-card__label">{item.label}</span>
            <span className="collab-quick-card__desc">{item.description}</span>
          </Link>
        );
      })}
    </div>
  );
}
