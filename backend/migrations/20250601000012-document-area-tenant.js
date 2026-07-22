'use strict';

/**
 * Modelo documental por Área (tenant lógico):
 * - Positions.isLeader distingue gerente/líder vs colaborador
 * - Documents: estado, archivo en línea (sin versionado), areaId, aprobación
 * - AreaAccess: excepciones entre áreas
 * - Carpetas raíz por área bajo Repositorio
 *
 * Nota: SQL Server valida columnas al compilar el lote completo; por eso cada
 * fase va en un runSql separado (ALTER antes de UPDATE).
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
      IF COL_LENGTH('dbo.Positions', 'isLeader') IS NULL
      BEGIN
        ALTER TABLE dbo.Positions
        ADD isLeader BIT NOT NULL CONSTRAINT DF_Positions_isLeader DEFAULT (0);
      END;
    `)
    .then(() =>
      db.runSql(`
        IF COL_LENGTH('dbo.Documents', 'status') IS NULL
          ALTER TABLE dbo.Documents ADD status NVARCHAR(20) NULL;
        IF COL_LENGTH('dbo.Documents', 'fileName') IS NULL
          ALTER TABLE dbo.Documents ADD fileName NVARCHAR(255) NULL;
        IF COL_LENGTH('dbo.Documents', 'fileKey') IS NULL
          ALTER TABLE dbo.Documents ADD fileKey NVARCHAR(512) NULL;
        IF COL_LENGTH('dbo.Documents', 'fileSize') IS NULL
          ALTER TABLE dbo.Documents ADD fileSize BIGINT NULL;
        IF COL_LENGTH('dbo.Documents', 'mimeType') IS NULL
          ALTER TABLE dbo.Documents ADD mimeType NVARCHAR(127) NULL;
        IF COL_LENGTH('dbo.Documents', 'areaId') IS NULL
          ALTER TABLE dbo.Documents ADD areaId INT NULL;
        IF COL_LENGTH('dbo.Documents', 'approvedBy') IS NULL
          ALTER TABLE dbo.Documents ADD approvedBy INT NULL;
        IF COL_LENGTH('dbo.Documents', 'rejectedBy') IS NULL
          ALTER TABLE dbo.Documents ADD rejectedBy INT NULL;
        IF COL_LENGTH('dbo.Documents', 'approvedAt') IS NULL
          ALTER TABLE dbo.Documents ADD approvedAt DATETIME2 NULL;
        IF COL_LENGTH('dbo.Documents', 'rejectedAt') IS NULL
          ALTER TABLE dbo.Documents ADD rejectedAt DATETIME2 NULL;
        IF COL_LENGTH('dbo.Documents', 'rejectionReason') IS NULL
          ALTER TABLE dbo.Documents ADD rejectionReason NVARCHAR(500) NULL;
      `),
    )
    .then(() =>
      db.runSql(`
        IF OBJECT_ID('dbo.DocumentVersions', 'U') IS NOT NULL
           AND COL_LENGTH('dbo.Documents', 'currentVersionId') IS NOT NULL
        BEGIN
          UPDATE d
          SET
            d.fileName = v.fileName,
            d.fileKey = v.fileKey,
            d.fileSize = v.fileSize,
            d.mimeType = v.mimeType,
            d.status = N'APPROVED',
            d.areaId = f.areaId,
            d.approvedAt = v.createdAt,
            d.approvedBy = v.createdBy
          FROM dbo.Documents d
          INNER JOIN dbo.DocumentVersions v ON d.currentVersionId = v.id
          INNER JOIN dbo.Folders f ON d.folderId = f.id;
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        UPDATE dbo.Documents SET status = N'APPROVED' WHERE status IS NULL;

        IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_Documents_status')
        BEGIN
          ALTER TABLE dbo.Documents ADD CONSTRAINT DF_Documents_status DEFAULT (N'PENDING') FOR status;
        END;

        UPDATE dbo.Documents SET status = N'APPROVED' WHERE status IS NULL;

        IF COL_LENGTH('dbo.Documents', 'status') IS NOT NULL
          ALTER TABLE dbo.Documents ALTER COLUMN status NVARCHAR(20) NOT NULL;
      `),
    )
    .then(() =>
      db.runSql(`
        IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Documents_currentVersionId')
          ALTER TABLE dbo.Documents DROP CONSTRAINT FK_Documents_currentVersionId;

        IF COL_LENGTH('dbo.Documents', 'currentVersionId') IS NOT NULL
          ALTER TABLE dbo.Documents DROP COLUMN currentVersionId;

        IF OBJECT_ID('dbo.DocumentVersions', 'U') IS NOT NULL
          DROP TABLE dbo.DocumentVersions;
      `),
    )
    .then(() =>
      db.runSql(`
        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Documents_areaId')
          ALTER TABLE dbo.Documents
          ADD CONSTRAINT FK_Documents_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id);

        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Documents_approvedBy')
          ALTER TABLE dbo.Documents
          ADD CONSTRAINT FK_Documents_approvedBy FOREIGN KEY (approvedBy) REFERENCES dbo.Users (id);

        IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_Documents_rejectedBy')
          ALTER TABLE dbo.Documents
          ADD CONSTRAINT FK_Documents_rejectedBy FOREIGN KEY (rejectedBy) REFERENCES dbo.Users (id);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Documents_status' AND object_id = OBJECT_ID('dbo.Documents'))
          CREATE INDEX IX_Documents_status ON dbo.Documents (status);

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Documents_areaId' AND object_id = OBJECT_ID('dbo.Documents'))
          CREATE INDEX IX_Documents_areaId ON dbo.Documents (areaId);
      `),
    )
    .then(() =>
      db.runSql(`
        IF OBJECT_ID('dbo.AreaAccess', 'U') IS NULL
        BEGIN
          CREATE TABLE dbo.AreaAccess (
            id INT IDENTITY(1, 1) NOT NULL,
            sourceAreaId INT NOT NULL,
            targetAreaId INT NOT NULL,
            canRead BIT NOT NULL CONSTRAINT DF_AreaAccess_canRead DEFAULT (0),
            canUpload BIT NOT NULL CONSTRAINT DF_AreaAccess_canUpload DEFAULT (0),
            canApprove BIT NOT NULL CONSTRAINT DF_AreaAccess_canApprove DEFAULT (0),
            isActive BIT NOT NULL CONSTRAINT DF_AreaAccess_isActive DEFAULT (1),
            createdAt DATETIME2 NOT NULL CONSTRAINT DF_AreaAccess_createdAt DEFAULT (SYSUTCDATETIME()),
            updatedAt DATETIME2 NOT NULL CONSTRAINT DF_AreaAccess_updatedAt DEFAULT (SYSUTCDATETIME()),
            CONSTRAINT PK_AreaAccess PRIMARY KEY CLUSTERED (id),
            CONSTRAINT FK_AreaAccess_sourceAreaId FOREIGN KEY (sourceAreaId) REFERENCES dbo.Areas (id),
            CONSTRAINT FK_AreaAccess_targetAreaId FOREIGN KEY (targetAreaId) REFERENCES dbo.Areas (id),
            CONSTRAINT UQ_AreaAccess_source_target UNIQUE (sourceAreaId, targetAreaId),
            CONSTRAINT CK_AreaAccess_not_same CHECK (sourceAreaId <> targetAreaId)
          );

          CREATE INDEX IX_AreaAccess_sourceAreaId ON dbo.AreaAccess (sourceAreaId);
          CREATE INDEX IX_AreaAccess_targetAreaId ON dbo.AreaAccess (targetAreaId);
        END;
      `),
    )
    .then(() =>
      db.runSql(`
        DECLARE @rootId INT = (
          SELECT TOP 1 id FROM dbo.Folders
          WHERE parentFolderId IS NULL AND isActive = 1
          ORDER BY id
        );

        IF @rootId IS NOT NULL
        BEGIN
          INSERT INTO dbo.Folders (name, description, parentFolderId, areaId, isActive)
          SELECT
            a.name,
            N'Repositorio documental de ' + a.name,
            @rootId,
            a.id,
            1
          FROM dbo.Areas a
          WHERE a.isActive = 1
            AND NOT EXISTS (
              SELECT 1 FROM dbo.Folders f
              WHERE f.parentFolderId = @rootId AND f.areaId = a.id AND f.isActive = 1
            );
        END;
      `),
    );
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.AreaAccess;

    IF COL_LENGTH('dbo.Documents', 'status') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.Documents DROP CONSTRAINT IF EXISTS DF_Documents_status;
      ALTER TABLE dbo.Documents DROP CONSTRAINT IF EXISTS FK_Documents_areaId;
      ALTER TABLE dbo.Documents DROP CONSTRAINT IF EXISTS FK_Documents_approvedBy;
      ALTER TABLE dbo.Documents DROP CONSTRAINT IF EXISTS FK_Documents_rejectedBy;
      ALTER TABLE dbo.Documents DROP COLUMN status;
      ALTER TABLE dbo.Documents DROP COLUMN fileName;
      ALTER TABLE dbo.Documents DROP COLUMN fileKey;
      ALTER TABLE dbo.Documents DROP COLUMN fileSize;
      ALTER TABLE dbo.Documents DROP COLUMN mimeType;
      ALTER TABLE dbo.Documents DROP COLUMN areaId;
      ALTER TABLE dbo.Documents DROP COLUMN approvedBy;
      ALTER TABLE dbo.Documents DROP COLUMN rejectedBy;
      ALTER TABLE dbo.Documents DROP COLUMN approvedAt;
      ALTER TABLE dbo.Documents DROP COLUMN rejectedAt;
      ALTER TABLE dbo.Documents DROP COLUMN rejectionReason;
    END;

    IF COL_LENGTH('dbo.Positions', 'isLeader') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.Positions DROP CONSTRAINT IF EXISTS DF_Positions_isLeader;
      ALTER TABLE dbo.Positions DROP COLUMN isLeader;
    END;
  `);
};

exports._meta = {
  version: 1,
};
