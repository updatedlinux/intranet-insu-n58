import { Link } from 'react-router-dom';

interface PageHeaderProps {
  title: string;
  breadcrumbParent?: string;
  breadcrumbCurrent?: string;
  breadcrumbParentHref?: string;
}

export function PageHeader({
  title,
  breadcrumbParent = 'Dashboard',
  breadcrumbCurrent = 'Intranet',
  breadcrumbParentHref = '/',
}: PageHeaderProps) {
  return (
    <div className="title-wrapper m3-page-header pt-30">
      <div className="row align-items-center">
        <div className="col-md-6">
          <div className="title">
            <h2>{title}</h2>
          </div>
        </div>
        <div className="col-md-6">
          <div className="breadcrumb-wrapper">
            <nav aria-label="breadcrumb">
              <ol className="breadcrumb">
                <li className="breadcrumb-item">
                  <Link to={breadcrumbParentHref}>{breadcrumbParent}</Link>
                </li>
                <li className="breadcrumb-item active" aria-current="page">
                  {breadcrumbCurrent}
                </li>
              </ol>
            </nav>
          </div>
        </div>
      </div>
    </div>
  );
}
