export interface OrgChartNode {
  id: number;
  name: string;
  children: OrgChartNode[];
}

export interface OrgChartResponse {
  tree: OrgChartNode[];
  totalAreas: number;
}
