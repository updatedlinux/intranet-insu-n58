'use strict';

/**
 * Carpetas espejo por área. Cada fase en runSql separado: SQL Server valida
 * columnas al compilar el lote completo (ver migración 12).
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
      BEGIN
        ALTER TABLE dbo.Folders ADD mirrorAreaId INT NULL;
      END;
    `)
    .then(() =>
      db.runSql(`
        IF COL_LENGTH('dbo.Folders', 'areaOrphanedAt') IS NULL
        BEGIN
          ALTER TABLE dbo.Folders ADD areaOrphanedAt DATETIME2 NULL;
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        IF COL_LENGTH('dbo.Folders', 'isAreaMirror') IS NULL
        BEGIN
          ALTER TABLE dbo.Folders ADD isAreaMirror BIT NOT NULL
            CONSTRAINT DF_Folders_isAreaMirror DEFAULT (0);
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Folders_mirrorAreaId'
        )
        BEGIN
          ALTER TABLE dbo.Folders
            ADD CONSTRAINT FK_Folders_mirrorAreaId
            FOREIGN KEY (mirrorAreaId) REFERENCES dbo.Areas (id);
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes WHERE name = 'UQ_Folders_mirrorAreaId_active'
        )
        BEGIN
          CREATE UNIQUE INDEX UQ_Folders_mirrorAreaId_active
            ON dbo.Folders (mirrorAreaId)
            WHERE mirrorAreaId IS NOT NULL AND isAreaMirror = 1 AND isActive = 1;
        END;
      `),
    );
};

exports.down = function (db) {
  return db
    .runSql(`
      IF EXISTS (
        SELECT 1 FROM sys.indexes WHERE name = 'UQ_Folders_mirrorAreaId_active'
      )
        DROP INDEX UQ_Folders_mirrorAreaId_active ON dbo.Folders;
    `)
    .then(() =>
      db.runSql(`
        IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Folders_mirrorAreaId')
          ALTER TABLE dbo.Folders DROP CONSTRAINT FK_Folders_mirrorAreaId;
      `),
    )
    .then(() =>
      db.runSql(`
        IF COL_LENGTH('dbo.Folders', 'isAreaMirror') IS NOT NULL
        BEGIN
          ALTER TABLE dbo.Folders DROP CONSTRAINT IF EXISTS DF_Folders_isAreaMirror;
          ALTER TABLE dbo.Folders DROP COLUMN isAreaMirror;
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        IF COL_LENGTH('dbo.Folders', 'areaOrphanedAt') IS NOT NULL
          ALTER TABLE dbo.Folders DROP COLUMN areaOrphanedAt;
      `),
    )
    .then(() =>
      db.runSql(`
        IF COL_LENGTH('dbo.Folders', 'mirrorAreaId') IS NOT NULL
          ALTER TABLE dbo.Folders DROP COLUMN mirrorAreaId;
      `),
    );
};

exports._meta = {
  version: 1,
};
