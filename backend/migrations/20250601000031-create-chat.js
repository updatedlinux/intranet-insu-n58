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
    IF OBJECT_ID('dbo.ChatMessages', 'U') IS NOT NULL DROP TABLE dbo.ChatMessages;
    IF OBJECT_ID('dbo.ChatParticipants', 'U') IS NOT NULL DROP TABLE dbo.ChatParticipants;
    IF OBJECT_ID('dbo.ChatRooms', 'U') IS NOT NULL DROP TABLE dbo.ChatRooms;

    CREATE TABLE dbo.ChatRooms (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(200) NULL,
      isGroup BIT NOT NULL CONSTRAINT DF_ChatRooms_isGroup DEFAULT (0),
      areaId INT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_ChatRooms_createdAt DEFAULT (SYSUTCDATETIME()),
      lastMessageAt DATETIME2 NOT NULL CONSTRAINT DF_ChatRooms_lastMessageAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_ChatRooms PRIMARY KEY (id),
      CONSTRAINT FK_ChatRooms_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id)
    );

    CREATE UNIQUE INDEX UQ_ChatRooms_areaId_group
      ON dbo.ChatRooms (areaId)
      WHERE areaId IS NOT NULL;

    CREATE INDEX IX_ChatRooms_lastMessageAt ON dbo.ChatRooms (lastMessageAt DESC);

    CREATE TABLE dbo.ChatParticipants (
      id INT IDENTITY(1, 1) NOT NULL,
      roomId INT NOT NULL,
      userId INT NOT NULL,
      joinedAt DATETIME2 NOT NULL CONSTRAINT DF_ChatParticipants_joinedAt DEFAULT (SYSUTCDATETIME()),
      lastReadAt DATETIME2 NULL,
      CONSTRAINT PK_ChatParticipants PRIMARY KEY (id),
      CONSTRAINT FK_ChatParticipants_roomId FOREIGN KEY (roomId) REFERENCES dbo.ChatRooms (id) ON DELETE CASCADE,
      CONSTRAINT FK_ChatParticipants_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT UQ_ChatParticipants_room_user UNIQUE (roomId, userId)
    );

    CREATE INDEX IX_ChatParticipants_userId ON dbo.ChatParticipants (userId);

    CREATE TABLE dbo.ChatMessages (
      id INT IDENTITY(1, 1) NOT NULL,
      roomId INT NOT NULL,
      senderId INT NOT NULL,
      messageText NVARCHAR(MAX) NULL,
      fileUrl NVARCHAR(500) NULL,
      fileName NVARCHAR(300) NULL,
      fileType NVARCHAR(100) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_ChatMessages_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_ChatMessages PRIMARY KEY (id),
      CONSTRAINT FK_ChatMessages_roomId FOREIGN KEY (roomId) REFERENCES dbo.ChatRooms (id) ON DELETE CASCADE,
      CONSTRAINT FK_ChatMessages_senderId FOREIGN KEY (senderId) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_ChatMessages_roomId_createdAt ON dbo.ChatMessages (roomId, createdAt DESC);
    CREATE INDEX IX_ChatMessages_senderId ON dbo.ChatMessages (senderId);

    -- Salas grupales por área activa
    INSERT INTO dbo.ChatRooms (name, isGroup, areaId, createdAt, lastMessageAt)
    SELECT a.name, 1, a.id, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM dbo.Areas a
    WHERE a.isActive = 1;

    INSERT INTO dbo.ChatParticipants (roomId, userId, joinedAt, lastReadAt)
    SELECT r.id, u.id, SYSUTCDATETIME(), SYSUTCDATETIME()
    FROM dbo.ChatRooms r
    INNER JOIN dbo.Users u ON u.areaId = r.areaId AND u.isActive = 1
    WHERE r.isGroup = 1 AND r.areaId IS NOT NULL;

    IF OBJECT_ID('dbo.CK_Notifications_type', 'C') IS NOT NULL
      ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_type;

    ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_type CHECK (
      type IN (
        N'ANNOUNCEMENT', N'DOCUMENT_PENDING', N'DOCUMENT_APPROVED', N'DOCUMENT_REJECTED',
        N'TICKET_CREATED', N'TICKET_ASSIGNED', N'TICKET_COMMENT', N'TICKET_RESOLVED',
        N'TASK_ASSIGNED', N'TASK_MOVED', N'TASK_COMMENT', N'TASK_DUE_SOON',
        N'MEETING_CREATED', N'MEETING_RESCHEDULED', N'MEETING_CANCELLED', N'MEETING_REMINDER',
        N'REQUEST_CREATED', N'REQUEST_RECEIVED', N'REQUEST_IN_PROGRESS',
        N'REQUEST_RESOLVED', N'REQUEST_REJECTED', N'REQUEST_CLOSED',
        N'INVENTORY_LOW_STOCK', N'CHAT_MESSAGE', N'SYSTEM'
      )
    );

    IF OBJECT_ID('dbo.CK_Notifications_resourceType', 'C') IS NOT NULL
      ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_resourceType;

    ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_resourceType CHECK (
      resourceType IS NULL OR resourceType IN (
        N'announcement', N'document', N'folder', N'ticket', N'task', N'board',
        N'meeting', N'request', N'asset', N'consumable', N'inventory', N'chat'
      )
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.ChatMessages', 'U') IS NOT NULL DROP TABLE dbo.ChatMessages;
    IF OBJECT_ID('dbo.ChatParticipants', 'U') IS NOT NULL DROP TABLE dbo.ChatParticipants;
    IF OBJECT_ID('dbo.ChatRooms', 'U') IS NOT NULL DROP TABLE dbo.ChatRooms;
  `);
};

exports._meta = { version: 1 };
