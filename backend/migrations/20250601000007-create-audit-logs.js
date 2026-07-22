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
    CREATE TABLE dbo.AuditLogs (
      id INT IDENTITY(1, 1) NOT NULL,
      action NVARCHAR(100) NOT NULL,
      actorUserId INT NULL,
      entityType NVARCHAR(50) NULL,
      entityId INT NULL,
      detail NVARCHAR(1000) NULL,
      ipAddress NVARCHAR(45) NULL,
      userAgent NVARCHAR(500) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_AuditLogs_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_AuditLogs PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_AuditLogs_actorUserId FOREIGN KEY (actorUserId) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_AuditLogs_action ON dbo.AuditLogs (action);
    CREATE INDEX IX_AuditLogs_actorUserId ON dbo.AuditLogs (actorUserId);
    CREATE INDEX IX_AuditLogs_entityType_entityId ON dbo.AuditLogs (entityType, entityId);
    CREATE INDEX IX_AuditLogs_createdAt ON dbo.AuditLogs (createdAt DESC);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.AuditLogs;
  `);
};

exports._meta = {
  version: 1,
};
