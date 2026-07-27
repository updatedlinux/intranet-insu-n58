import sql from 'mssql';
import { getPool } from '../config/database';

export interface SeniatLookupRow {
  id: number;
  cedula: string;
  rif: string;
  nombre: string;
  sexo: string | null;
  source: string;
  consultedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

export async function findSeniatLookupByCedula(cedula: string): Promise<SeniatLookupRow | null> {
  const pool = getPool();
  const result = await pool
    .request()
    .input('cedula', sql.NVarChar(20), cedula)
    .query<SeniatLookupRow>(`
      SELECT id, cedula, rif, nombre, sexo, source, consultedAt, createdAt, updatedAt
      FROM dbo.SeniatLookups
      WHERE cedula = @cedula
    `);
  return result.recordset[0] ?? null;
}

export async function upsertSeniatLookup(input: {
  cedula: string;
  rif: string;
  nombre: string;
  sexo: string | null;
  source?: string;
}): Promise<void> {
  const pool = getPool();
  await pool
    .request()
    .input('cedula', sql.NVarChar(20), input.cedula)
    .input('rif', sql.NVarChar(20), input.rif)
    .input('nombre', sql.NVarChar(300), input.nombre)
    .input('sexo', sql.NVarChar(20), input.sexo)
    .input('source', sql.NVarChar(20), input.source || 'SENIAT')
    .query(`
      MERGE dbo.SeniatLookups AS target
      USING (SELECT @cedula AS cedula) AS source
      ON target.cedula = source.cedula
      WHEN MATCHED THEN
        UPDATE SET
          rif = @rif,
          nombre = @nombre,
          sexo = @sexo,
          source = @source,
          consultedAt = SYSUTCDATETIME(),
          updatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN
        INSERT (cedula, rif, nombre, sexo, source, consultedAt, createdAt, updatedAt)
        VALUES (@cedula, @rif, @nombre, @sexo, @source, SYSUTCDATETIME(), SYSUTCDATETIME(), SYSUTCDATETIME());
    `);
}
