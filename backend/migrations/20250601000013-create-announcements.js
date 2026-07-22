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
    IF OBJECT_ID('dbo.Announcements', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Announcements (
        id INT IDENTITY(1, 1) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        content NVARCHAR(MAX) NOT NULL,
        summary NVARCHAR(500) NOT NULL,
        imageUrl NVARCHAR(512) NULL,
        category NVARCHAR(20) NOT NULL,
        targetAreaId INT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_Announcements_status DEFAULT (N'DRAFT'),
        createdBy INT NOT NULL,
        publishedAt DATETIME2 NULL,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_Announcements_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Announcements_updatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Announcements PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_Announcements_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id),
        CONSTRAINT FK_Announcements_targetAreaId FOREIGN KEY (targetAreaId) REFERENCES dbo.Areas (id),
        CONSTRAINT CK_Announcements_category CHECK (
          category IN (N'NOTICIA', N'CIRCULAR', N'EVENTO', N'URGENTE')
        ),
        CONSTRAINT CK_Announcements_status CHECK (
          status IN (N'DRAFT', N'PUBLISHED', N'ARCHIVED')
        )
      );

      CREATE INDEX IX_Announcements_status_publishedAt
        ON dbo.Announcements (status, publishedAt DESC);

      CREATE INDEX IX_Announcements_targetAreaId
        ON dbo.Announcements (targetAreaId)
        WHERE targetAreaId IS NOT NULL;
    END;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.Announcements;
  `);
};

exports._meta = {
  version: 1,
};
