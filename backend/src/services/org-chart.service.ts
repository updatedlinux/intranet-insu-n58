import {
  listActiveAreasForOrgChart,
  type OrgChartAreaRow,
} from '../repositories/org-chart.repository';

export interface OrgChartNode {
  id: number;
  name: string;
  children: OrgChartNode[];
}

function sortTree(nodes: OrgChartNode[]): void {
  nodes.sort((a, b) => a.name.localeCompare(b.name, 'es'));
  for (const node of nodes) {
    sortTree(node.children);
  }
}

export function buildOrgChartTree(areas: OrgChartAreaRow[]): OrgChartNode[] {
  const map = new Map<number, OrgChartNode>();

  for (const area of areas) {
    map.set(area.id, { id: area.id, name: area.name, children: [] });
  }

  const roots: OrgChartNode[] = [];

  for (const area of areas) {
    const node = map.get(area.id)!;
    if (area.parentAreaId == null || !map.has(area.parentAreaId)) {
      roots.push(node);
    } else {
      map.get(area.parentAreaId)!.children.push(node);
    }
  }

  sortTree(roots);
  return roots;
}

export async function getOrgChartService(): Promise<{ tree: OrgChartNode[]; totalAreas: number }> {
  const areas = await listActiveAreasForOrgChart();
  return {
    tree: buildOrgChartTree(areas),
    totalAreas: areas.length,
  };
}
