'use strict';

/**
 * Backfill de carpetas espejo y jerarquía. Fases separadas por limitación de
 * compilación por lote en SQL Server.
 */
let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db
    .runSql(`
      IF COL_LENGTH('dbo.Folders', 'mirrorAreaId') IS NULL
        ALTER TABLE dbo.Folders ADD mirrorAreaId INT NULL;
      IF COL_LENGTH('dbo.Folders', 'areaOrphanedAt') IS NULL
        ALTER TABLE dbo.Folders ADD areaOrphanedAt DATETIME2 NULL;
      IF COL_LENGTH('dbo.Folders', 'isAreaMirror') IS NULL
        ALTER TABLE dbo.Folders ADD isAreaMirror BIT NOT NULL
          CONSTRAINT DF_Folders_isAreaMirror_backfill DEFAULT (0);
    `)
    .then(() =>
      db.runSql(`
        DECLARE @rootId INT = (
          SELECT TOP 1 id FROM dbo.Folders
          WHERE parentFolderId IS NULL AND isActive = 1
          ORDER BY id
        );

        IF @rootId IS NULL
          RETURN;

        UPDATE f
        SET
          isAreaMirror = 1,
          mirrorAreaId = f.areaId
        FROM dbo.Folders f
        INNER JOIN dbo.Areas a ON a.id = f.areaId
        WHERE f.isActive = 1
          AND f.areaId IS NOT NULL
          AND f.parentFolderId = @rootId
          AND f.isAreaMirror = 0;
      `),
    )
    .then(() =>
      db.runSql(`
        DECLARE @rootId INT = (
          SELECT TOP 1 id FROM dbo.Folders
          WHERE parentFolderId IS NULL AND isActive = 1
          ORDER BY id
        );

        IF @rootId IS NULL
          RETURN;

        INSERT INTO dbo.Folders (name, description, parentFolderId, areaId, isActive, isAreaMirror, mirrorAreaId)
        SELECT
          a.name,
          N'Repositorio documental de ' + a.name,
          @rootId,
          a.id,
          CASE WHEN a.isActive = 1 THEN 1 ELSE 0 END,
          1,
          a.id
        FROM dbo.Areas a
        WHERE NOT EXISTS (
          SELECT 1 FROM dbo.Folders f
          WHERE f.mirrorAreaId = a.id AND f.isAreaMirror = 1
        );
      `),
    )
    .then(() =>
      db.runSql(`
        DECLARE @rootId INT = (
          SELECT TOP 1 id FROM dbo.Folders
          WHERE parentFolderId IS NULL AND isActive = 1
          ORDER BY id
        );

        IF @rootId IS NULL
          RETURN;

        DECLARE @pass INT = 0;
        WHILE @pass < 8
        BEGIN
          UPDATE f
          SET f.parentFolderId = COALESCE(pf.id, @rootId),
              f.updatedAt = SYSUTCDATETIME()
          FROM dbo.Folders f
          INNER JOIN dbo.Areas a ON a.id = f.mirrorAreaId
          LEFT JOIN dbo.Areas pa ON pa.id = a.parentAreaId
          LEFT JOIN dbo.Folders pf ON pf.mirrorAreaId = pa.id AND pf.isAreaMirror = 1 AND pf.isActive = 1
          WHERE f.isAreaMirror = 1
            AND f.isActive = 1
            AND f.parentFolderId <> COALESCE(pf.id, @rootId);

          SET @pass = @pass + 1;
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        IF NOT EXISTS (SELECT 1 FROM dbo.Tags WHERE LOWER(name) = LOWER(N'Área eliminada'))
        BEGIN
          INSERT INTO dbo.Tags (name, description, isActive)
          VALUES (
            N'Área eliminada',
            N'El área organizacional asociada ya no existe; el archivo se conserva por seguridad.',
            1
          );
        END;
      `),
    );
};

exports.down = function (db) {
  return db
    .runSql(`
      UPDATE dbo.Folders SET isAreaMirror = 0, mirrorAreaId = NULL WHERE isAreaMirror = 1;
    `)
    .then(() =>
      db.runSql(`
        DELETE FROM dbo.Tags WHERE name = N'Área eliminada';
      `),
    );
};

exports._meta = {
  version: 1,
};
