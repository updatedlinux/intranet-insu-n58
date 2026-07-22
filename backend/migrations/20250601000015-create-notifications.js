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
    IF OBJECT_ID('dbo.Notifications', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.Notifications (
        id INT IDENTITY(1, 1) NOT NULL,
        userId INT NOT NULL,
        type NVARCHAR(40) NOT NULL,
        title NVARCHAR(255) NOT NULL,
        message NVARCHAR(500) NOT NULL,
        resourceType NVARCHAR(40) NULL,
        resourceId INT NULL,
        isRead BIT NOT NULL CONSTRAINT DF_Notifications_isRead DEFAULT (0),
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_Notifications_createdAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_Notifications PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_Notifications_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
        CONSTRAINT CK_Notifications_type CHECK (
          type IN (
            N'ANNOUNCEMENT',
            N'DOCUMENT_PENDING',
            N'DOCUMENT_APPROVED',
            N'DOCUMENT_REJECTED',
            N'SYSTEM'
          )
        ),
        CONSTRAINT CK_Notifications_resourceType CHECK (
          resourceType IS NULL
          OR resourceType IN (N'announcement', N'document', N'folder')
        )
      );

      CREATE INDEX IX_Notifications_userId_createdAt
        ON dbo.Notifications (userId, createdAt DESC);

      CREATE INDEX IX_Notifications_userId_isRead
        ON dbo.Notifications (userId, isRead)
        WHERE isRead = 0;
    END;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.Notifications;
  `);
};

exports._meta = {
  version: 1,
};
