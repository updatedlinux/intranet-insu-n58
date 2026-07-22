import { PageHeader } from '../components/layout';

interface ModulePlaceholderPageProps {
  title: string;
  description?: string;
}

export function ModulePlaceholderPage({ title, description }: ModulePlaceholderPageProps) {
  return (
    <>
      <PageHeader title={title} breadcrumbParent="Inicio" breadcrumbCurrent={title} />
      <div className="card-style mb-30">
        <p className="text-sm text-gray mb-0">
          {description ?? (
            <>
              El módulo <strong>{title}</strong> estará disponible próximamente.
            </>
          )}
        </p>
      </div>
    </>
  );
}
