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
  return db
    .runSql(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE name = N'Infraestructura Tecnológica')
    BEGIN
      INSERT INTO dbo.Areas (name, description, parentAreaId, isActive)
      VALUES (
        N'Infraestructura Tecnológica',
        N'Soporte técnico y mesa de ayuda TI',
        NULL,
        1
      );
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE name = N'TI')
    BEGIN
      INSERT INTO dbo.Areas (name, description, parentAreaId, isActive)
      VALUES (N'TI', N'Área de tecnología (alias)', NULL, 1);
    END;
  `)
    .then(() =>
      db.runSql(`
      IF OBJECT_ID('dbo.Tickets', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.Tickets (
          id INT IDENTITY(1, 1) NOT NULL,
          code NVARCHAR(20) NOT NULL,
          requesterId INT NOT NULL,
          assignedTo INT NULL,
          title NVARCHAR(255) NOT NULL,
          description NVARCHAR(MAX) NOT NULL,
          category NVARCHAR(40) NOT NULL,
          priority NVARCHAR(20) NOT NULL,
          status NVARCHAR(20) NOT NULL CONSTRAINT DF_Tickets_status DEFAULT (N'OPEN'),
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_Tickets_createdAt DEFAULT (SYSUTCDATETIME()),
          updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Tickets_updatedAt DEFAULT (SYSUTCDATETIME()),
          resolvedAt DATETIME2 NULL,
          closedAt DATETIME2 NULL,
          CONSTRAINT PK_Tickets PRIMARY KEY CLUSTERED (id),
          CONSTRAINT UQ_Tickets_code UNIQUE (code),
          CONSTRAINT FK_Tickets_requesterId FOREIGN KEY (requesterId) REFERENCES dbo.Users (id),
          CONSTRAINT FK_Tickets_assignedTo FOREIGN KEY (assignedTo) REFERENCES dbo.Users (id),
          CONSTRAINT CK_Tickets_category CHECK (
            category IN (N'Soporte', N'Acceso', N'Equipos', N'Software', N'Otros')
          ),
          CONSTRAINT CK_Tickets_priority CHECK (
            priority IN (N'Low', N'Medium', N'High', N'Critical')
          ),
          CONSTRAINT CK_Tickets_status CHECK (
            status IN (N'OPEN', N'IN_PROGRESS', N'ON_HOLD', N'RESOLVED', N'CLOSED')
          )
        );

        CREATE INDEX IX_Tickets_requesterId ON dbo.Tickets (requesterId);
        CREATE INDEX IX_Tickets_assignedTo ON dbo.Tickets (assignedTo);
        CREATE INDEX IX_Tickets_status ON dbo.Tickets (status);
        CREATE INDEX IX_Tickets_createdAt ON dbo.Tickets (createdAt DESC);
      END;
    `),
    )
    .then(() =>
      db.runSql(`
      IF OBJECT_ID('dbo.TicketComments', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.TicketComments (
          id INT IDENTITY(1, 1) NOT NULL,
          ticketId INT NOT NULL,
          userId INT NOT NULL,
          message NVARCHAR(MAX) NOT NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_TicketComments_createdAt DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT PK_TicketComments PRIMARY KEY CLUSTERED (id),
          CONSTRAINT FK_TicketComments_ticketId FOREIGN KEY (ticketId) REFERENCES dbo.Tickets (id) ON DELETE CASCADE,
          CONSTRAINT FK_TicketComments_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id)
        );

        CREATE INDEX IX_TicketComments_ticketId ON dbo.TicketComments (ticketId, createdAt);
      END;
    `),
    )
    .then(() =>
      db.runSql(`
      IF OBJECT_ID('dbo.CK_Notifications_type', 'C') IS NOT NULL
        ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_type;

      ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_type CHECK (
        type IN (
          N'ANNOUNCEMENT',
          N'DOCUMENT_PENDING',
          N'DOCUMENT_APPROVED',
          N'DOCUMENT_REJECTED',
          N'TICKET_CREATED',
          N'TICKET_ASSIGNED',
          N'TICKET_COMMENT',
          N'TICKET_RESOLVED',
          N'SYSTEM'
        )
      );

      IF OBJECT_ID('dbo.CK_Notifications_resourceType', 'C') IS NOT NULL
        ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_resourceType;

      ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_resourceType CHECK (
        resourceType IS NULL
        OR resourceType IN (N'announcement', N'document', N'folder', N'ticket')
      );
    `),
    );
};

exports.down = function (db) {
  return db
    .runSql(`
    DROP TABLE IF EXISTS dbo.TicketComments;
    DROP TABLE IF EXISTS dbo.Tickets;
  `)
    .then(() =>
      db.runSql(`
    DELETE FROM dbo.Areas WHERE name IN (N'TI', N'Infraestructura Tecnológica');
  `),
    );
};

exports._meta = {
  version: 1,
};
