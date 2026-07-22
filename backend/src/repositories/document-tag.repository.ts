import sql from 'mssql';
import { getPool } from '../config/database';

export interface DocumentTagLinkRow {
  documentId: number;
  tagId: number;
  tagName: string;
}

export async function findActiveTagsByIds(
  tagIds: number[],
): Promise<{ id: number; name: string }[]> {
  if (tagIds.length === 0) return [];

  const pool = getPool();
  const request = pool.request();
  const placeholders = tagIds.map((id, i) => {
    const key = `tagId${i}`;
    request.input(key, sql.Int, id);
    return `@${key}`;
  });

  const result = await request.query<{ id: number; name: string }>(`
    SELECT id, name
    FROM dbo.Tags
    WHERE isActive = 1 AND id IN (${placeholders.join(', ')})
  `);

  return result.recordset;
}

export async function replaceDocumentTags(documentId: number, tagIds: number[]): Promise<void> {
  const pool = getPool();
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    await new sql.Request(transaction)
      .input('documentId', sql.Int, documentId)
      .query('DELETE FROM dbo.DocumentTags WHERE documentId = @documentId');

    const uniqueIds = [...new Set(tagIds)];
    for (const tagId of uniqueIds) {
      await new sql.Request(transaction)
        .input('documentId', sql.Int, documentId)
        .input('tagId', sql.Int, tagId).query(`
          INSERT INTO dbo.DocumentTags (documentId, tagId)
          VALUES (@documentId, @tagId)
        `);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

export async function listTagsForDocuments(documentIds: number[]): Promise<DocumentTagLinkRow[]> {
  if (documentIds.length === 0) return [];

  const pool = getPool();
  const request = pool.request();
  const placeholders = documentIds.map((id, i) => {
    const key = `docId${i}`;
    request.input(key, sql.Int, id);
    return `@${key}`;
  });

  const result = await request.query<DocumentTagLinkRow>(`
    SELECT dt.documentId, dt.tagId, t.name AS tagName
    FROM dbo.DocumentTags dt
    INNER JOIN dbo.Tags t ON t.id = dt.tagId
    WHERE dt.documentId IN (${placeholders.join(', ')})
      AND t.isActive = 1
    ORDER BY t.name
  `);

  return result.recordset;
}

export async function appendDocumentTag(documentId: number, tagId: number): Promise<void> {
  const pool = getPool();
  await pool.request().input('documentId', sql.Int, documentId).input('tagId', sql.Int, tagId)
    .query(`
      IF NOT EXISTS (
        SELECT 1 FROM dbo.DocumentTags WHERE documentId = @documentId AND tagId = @tagId
      )
      BEGIN
        INSERT INTO dbo.DocumentTags (documentId, tagId)
        VALUES (@documentId, @tagId)
      END
    `);
}
