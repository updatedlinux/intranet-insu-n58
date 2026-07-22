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
    IF OBJECT_ID('dbo.TicketAttachments', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TicketAttachments (
        id INT IDENTITY(1, 1) NOT NULL,
        ticketId INT NOT NULL,
        fileName NVARCHAR(255) NOT NULL,
        fileKey NVARCHAR(500) NOT NULL,
        fileSize BIGINT NOT NULL,
        mimeType NVARCHAR(100) NOT NULL,
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_TicketAttachments_createdAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_TicketAttachments PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_TicketAttachments_ticketId FOREIGN KEY (ticketId) REFERENCES dbo.Tickets (id) ON DELETE CASCADE
      );

      CREATE INDEX IX_TicketAttachments_ticketId ON dbo.TicketAttachments (ticketId);
    END;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.TicketAttachments;
  `);
};

exports._meta = {
  version: 1,
};
