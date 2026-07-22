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
    CREATE TABLE dbo.DocumentLogs (
      id INT IDENTITY(1, 1) NOT NULL,
      documentId INT NOT NULL,
      userId INT NOT NULL,
      action NVARCHAR(20) NOT NULL,
      ipAddress NVARCHAR(45) NULL,
      userAgent NVARCHAR(500) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_DocumentLogs_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_DocumentLogs PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_DocumentLogs_documentId FOREIGN KEY (documentId) REFERENCES dbo.Documents (id),
      CONSTRAINT FK_DocumentLogs_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT CK_DocumentLogs_action CHECK (
        action IN (N'DOWNLOAD', N'VIEW', N'UPLOAD', N'UPDATE', N'DELETE')
      )
    );

    CREATE INDEX IX_DocumentLogs_documentId ON dbo.DocumentLogs (documentId);
    CREATE INDEX IX_DocumentLogs_userId ON dbo.DocumentLogs (userId);
    CREATE INDEX IX_DocumentLogs_createdAt ON dbo.DocumentLogs (createdAt);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.DocumentLogs;
  `);
};

exports._meta = {
  version: 1,
};
