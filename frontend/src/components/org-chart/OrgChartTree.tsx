import type { OrgChartNode } from '../../api/org-chart.types';
import { BRAND_LOGO_NEGATIVE_SRC } from '../../config/brand';
import { ORG_CHART_LEGAL_NOTICE } from './org-chart-legal-notice';

interface OrgChartTreeProps {
  nodes: OrgChartNode[];
  highlightAreaId?: number | null;
  compact?: boolean;
  showLegalNotice?: boolean;
  forExport?: boolean;
}

function OrgChartBranch({
  node,
  highlightAreaId,
  compact,
}: {
  node: OrgChartNode;
  highlightAreaId?: number | null;
  compact?: boolean;
}) {
  const isHighlighted = highlightAreaId != null && node.id === highlightAreaId;
  const hasChildren = node.children.length > 0;

  return (
    <li className={`org-chart__branch${hasChildren ? ' has-children' : ''}`}>
      <div
        className={`org-chart__node${isHighlighted ? ' is-highlighted' : ''}${compact ? ' is-compact' : ''}`}
        title={node.name}
      >
        {node.name}
      </div>
      {hasChildren ? (
        <ul
          className={`org-chart__children${node.children.length >= 4 ? ' org-chart__children--many' : ''}`}
        >
          {node.children.map((child) => (
            <OrgChartBranch
              key={child.id}
              node={child}
              highlightAreaId={highlightAreaId}
              compact={compact}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function OrgChartTree({
  nodes,
  highlightAreaId,
  compact = false,
  showLegalNotice = false,
  forExport = false,
}: OrgChartTreeProps) {
  if (nodes.length === 0) {
    return <p className="org-chart__empty">No hay áreas activas configuradas.</p>;
  }

  return (
    <div
      className={`org-chart${compact ? ' org-chart--compact' : ''}${forExport ? ' org-chart--export' : ''}`}
    >
      <div className="org-chart__brand">
        <img
          src={BRAND_LOGO_NEGATIVE_SRC}
          alt="Insular"
          className="org-chart__logo"
          draggable={false}
        />
      </div>
      <ul className="org-chart__roots org-chart__roots--with-brand">
        {nodes.map((node) => (
          <OrgChartBranch
            key={node.id}
            node={node}
            highlightAreaId={highlightAreaId}
            compact={compact}
          />
        ))}
      </ul>
      {showLegalNotice ? (
        <footer className="org-chart__legal">
          {ORG_CHART_LEGAL_NOTICE.map((line) => (
            <span key={line}>{line}</span>
          ))}
        </footer>
      ) : null}
    </div>
  );
}
