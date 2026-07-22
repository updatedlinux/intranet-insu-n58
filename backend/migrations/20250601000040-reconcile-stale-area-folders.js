'use strict';

/**
 * Marca carpetas cuyo área ya no existe (p. ej. Dirección General eliminada)
 * y reubica espejos bajo padres válidos o bajo Repositorio.
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
      UPDATE f
      SET
        mirrorAreaId = NULL,
        areaOrphanedAt = COALESCE(f.areaOrphanedAt, SYSUTCDATETIME()),
        areaId = NULL,
        name = CASE
          WHEN f.name LIKE N'% · Área eliminada' THEN f.name
          ELSE f.name + N' · Área eliminada'
        END,
        description = CASE
          WHEN f.description LIKE N'%(área eliminada)%' THEN f.description
          ELSE COALESCE(f.description, N'') + N' (área eliminada)'
        END,
        updatedAt = SYSUTCDATETIME()
      FROM dbo.Folders f
      WHERE f.areaOrphanedAt IS NULL
        AND (
          (f.mirrorAreaId IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM dbo.Areas a WHERE a.id = f.mirrorAreaId
          ))
          OR (f.areaId IS NOT NULL AND NOT EXISTS (
            SELECT 1 FROM dbo.Areas a WHERE a.id = f.areaId
          ))
        );
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
          WHERE f.mirrorAreaId = a.id AND f.isAreaMirror = 1 AND f.areaOrphanedAt IS NULL
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
        WHILE @pass < 16
        BEGIN
          UPDATE f
          SET f.parentFolderId = COALESCE(pf.id, @rootId),
              f.updatedAt = SYSUTCDATETIME()
          FROM dbo.Folders f
          INNER JOIN dbo.Areas a ON a.id = f.mirrorAreaId
          LEFT JOIN dbo.Areas pa ON pa.id = a.parentAreaId
          LEFT JOIN dbo.Folders pf ON pf.mirrorAreaId = pa.id AND pf.isAreaMirror = 1 AND pf.isActive = 1 AND pf.areaOrphanedAt IS NULL
          WHERE f.isAreaMirror = 1
            AND f.isActive = 1
            AND f.areaOrphanedAt IS NULL
            AND f.parentFolderId <> COALESCE(pf.id, @rootId);

          SET @pass = @pass + 1;
        END;
      `),
    );
};

exports.down = function () {
  return null;
};

exports._meta = {
  version: 1,
};
