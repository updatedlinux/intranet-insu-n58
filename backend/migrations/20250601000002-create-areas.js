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
    CREATE TABLE dbo.Areas (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(200) NOT NULL,
      description NVARCHAR(500) NULL,
      parentAreaId INT NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Areas_isActive DEFAULT (1),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Areas_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Areas_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Areas PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Areas_parentAreaId FOREIGN KEY (parentAreaId) REFERENCES dbo.Areas (id)
    );

    CREATE INDEX IX_Areas_parentAreaId ON dbo.Areas (parentAreaId);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.Areas;
  `);
};

exports._meta = {
  version: 1,
};
