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
    IF OBJECT_ID('dbo.ChatAreaAccess', 'U') IS NULL
    CREATE TABLE dbo.ChatAreaAccess (
      id INT IDENTITY(1, 1) NOT NULL,
      userId INT NOT NULL,
      areaId INT NOT NULL,
      notes NVARCHAR(500) NULL,
      isActive BIT NOT NULL CONSTRAINT DF_ChatAreaAccess_isActive DEFAULT (1),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_ChatAreaAccess_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_ChatAreaAccess_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_ChatAreaAccess PRIMARY KEY (id),
      CONSTRAINT FK_ChatAreaAccess_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT FK_ChatAreaAccess_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id),
      CONSTRAINT UQ_ChatAreaAccess_user_area UNIQUE (userId, areaId)
    );

    CREATE INDEX IX_ChatAreaAccess_userId ON dbo.ChatAreaAccess (userId);
    CREATE INDEX IX_ChatAreaAccess_areaId ON dbo.ChatAreaAccess (areaId);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.ChatAreaAccess', 'U') IS NOT NULL DROP TABLE dbo.ChatAreaAccess;
  `);
};

exports._meta = { version: 1 };
