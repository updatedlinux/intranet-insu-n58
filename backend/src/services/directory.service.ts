import {
  findActiveAreas,
  findActivePositionsByArea,
  type AreaOption,
  type PositionOption,
} from '../repositories/catalog.repository';
import {
  listDirectoryEntries,
  type DirectoryEntryRow,
  type DirectoryListFilters,
} from '../repositories/directory.repository';
import { resolvePublicAvatarUrl } from '../utils/avatar-url';

export interface PublicDirectoryEntry {
  id: number;
  fullName: string;
  firstName: string;
  lastName: string;
  email: string;
  areaId: number;
  areaName: string;
  positionId: number;
  positionName: string;
  avatarUrl: string | null;
}

export interface DirectoryListResult {
  items: PublicDirectoryEntry[];
  filterOptions: {
    areas: AreaOption[];
    positions: PositionOption[];
  };
}

function toPublic(row: DirectoryEntryRow): PublicDirectoryEntry {
  return {
    id: row.id,
    fullName: `${row.firstName} ${row.lastName}`.trim(),
    firstName: row.firstName,
    lastName: row.lastName,
    email: row.email,
    areaId: row.areaId,
    areaName: row.areaName,
    positionId: row.positionId,
    positionName: row.positionName,
    avatarUrl: resolvePublicAvatarUrl(row.id, row.avatarUrl),
  };
}

export async function listDirectoryService(
  filters: DirectoryListFilters,
): Promise<DirectoryListResult> {
  const [rows, areas, positions] = await Promise.all([
    listDirectoryEntries(filters),
    findActiveAreas(),
    findActivePositionsByArea(filters.areaId),
  ]);

  return {
    items: rows.map(toPublic),
    filterOptions: { areas, positions },
  };
}
