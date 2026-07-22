'use strict';

/**
 * Reparación: adopta carpetas legadas, crea espejos faltantes y reubica jerarquía.
 * Complementa la migración 38 si áreas se crearon antes del sync en runtime.
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
      WHERE f.areaId IS NOT NULL
        AND f.areaOrphanedAt IS NULL
        AND (f.isAreaMirror = 0 OR f.mirrorAreaId IS NULL)
        AND NOT EXISTS (
          SELECT 1 FROM dbo.Folders x
          WHERE x.mirrorAreaId = f.areaId AND x.isAreaMirror = 1 AND x.id <> f.id
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
        WHILE @pass < 16
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
            AND f.areaOrphanedAt IS NULL
            AND f.parentFolderId <> COALESCE(pf.id, @rootId);

          SET @pass = @pass + 1;
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        UPDATE f
        SET f.isActive = 1, f.updatedAt = SYSUTCDATETIME()
        FROM dbo.Folders f
        INNER JOIN dbo.Areas a ON a.id = f.mirrorAreaId
        WHERE f.isAreaMirror = 1
          AND f.areaOrphanedAt IS NULL
          AND a.isActive = 1
          AND f.isActive = 0;
      `),
    );
};

exports.down = function () {
  return null;
};

exports._meta = {
  version: 1,
};
