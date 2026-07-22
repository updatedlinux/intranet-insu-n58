'use strict';

let dbm;
let type;
let seed;

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = function (db) {
  return db.runSql(`
    CREATE TABLE dbo.Folders (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(200) NOT NULL,
      description NVARCHAR(500) NULL,
      parentFolderId INT NULL,
      areaId INT NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Folders_isActive DEFAULT (1),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Folders_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Folders_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Folders PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Folders_parentFolderId FOREIGN KEY (parentFolderId) REFERENCES dbo.Folders (id),
      CONSTRAINT FK_Folders_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id)
    );

    CREATE INDEX IX_Folders_parentFolderId ON dbo.Folders (parentFolderId);
    CREATE INDEX IX_Folders_areaId ON dbo.Folders (areaId);

    CREATE TABLE dbo.Documents (
      id INT IDENTITY(1, 1) NOT NULL,
      folderId INT NOT NULL,
      name NVARCHAR(255) NOT NULL,
      description NVARCHAR(1000) NULL,
      currentVersionId INT NULL,
      createdBy INT NOT NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Documents_isActive DEFAULT (1),
      tags NVARCHAR(500) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Documents_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Documents_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Documents PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Documents_folderId FOREIGN KEY (folderId) REFERENCES dbo.Folders (id),
      CONSTRAINT FK_Documents_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_Documents_folderId ON dbo.Documents (folderId);
    CREATE INDEX IX_Documents_createdBy ON dbo.Documents (createdBy);

    CREATE TABLE dbo.DocumentVersions (
      id INT IDENTITY(1, 1) NOT NULL,
      documentId INT NOT NULL,
      versionNumber INT NOT NULL,
      fileName NVARCHAR(255) NOT NULL,
      fileKey NVARCHAR(512) NOT NULL,
      fileSize BIGINT NOT NULL,
      mimeType NVARCHAR(127) NOT NULL,
      createdBy INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_DocumentVersions_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_DocumentVersions PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_DocumentVersions_documentId FOREIGN KEY (documentId) REFERENCES dbo.Documents (id),
      CONSTRAINT FK_DocumentVersions_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id),
      CONSTRAINT UQ_DocumentVersions_document_version UNIQUE (documentId, versionNumber)
    );

    CREATE INDEX IX_DocumentVersions_documentId ON dbo.DocumentVersions (documentId);

    ALTER TABLE dbo.Documents
    ADD CONSTRAINT FK_Documents_currentVersionId FOREIGN KEY (currentVersionId)
      REFERENCES dbo.DocumentVersions (id);

    INSERT INTO dbo.Folders (name, description, parentFolderId, areaId, isActive)
    VALUES (
      N'Repositorio',
      N'Carpeta raíz del repositorio documental',
      NULL,
      NULL,
      1
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
    ALTER TABLE dbo.Documents DROP CONSTRAINT IF EXISTS FK_Documents_currentVersionId;
    DROP TABLE IF EXISTS dbo.DocumentVersions;
    DROP TABLE IF EXISTS dbo.Documents;
    DROP TABLE IF EXISTS dbo.Folders;
  `);
};

exports._meta = {
  version: 1,
};
