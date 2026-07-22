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
    CREATE TABLE dbo.Tags (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Tags_isActive DEFAULT (1),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Tags_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Tags_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Tags PRIMARY KEY CLUSTERED (id),
      CONSTRAINT UQ_Tags_name UNIQUE (name)
    );

    CREATE TABLE dbo.DocumentTags (
      id INT IDENTITY(1, 1) NOT NULL,
      documentId INT NOT NULL,
      tagId INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_DocumentTags_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_DocumentTags PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_DocumentTags_documentId FOREIGN KEY (documentId) REFERENCES dbo.Documents (id) ON DELETE CASCADE,
      CONSTRAINT FK_DocumentTags_tagId FOREIGN KEY (tagId) REFERENCES dbo.Tags (id),
      CONSTRAINT UQ_DocumentTags_document_tag UNIQUE (documentId, tagId)
    );

    CREATE INDEX IX_DocumentTags_documentId ON dbo.DocumentTags (documentId);
    CREATE INDEX IX_DocumentTags_tagId ON dbo.DocumentTags (tagId);

    INSERT INTO dbo.Tags (name, description, isActive) VALUES
      (N'Legal', N'Documentación legal y normativa', 1),
      (N'Operaciones', N'Procedimientos y operación', 1),
      (N'Manuales', N'Manuales e instructivos', 1),
      (N'Vigente', N'Versión o documento vigente', 1);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.DocumentTags;
    DROP TABLE IF EXISTS dbo.Tags;
  `);
};

exports._meta = {
  version: 1,
};
