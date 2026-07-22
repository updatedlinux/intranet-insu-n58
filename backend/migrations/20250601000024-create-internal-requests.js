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
    IF OBJECT_ID('dbo.RequestStatusHistory', 'U') IS NOT NULL
      DROP TABLE dbo.RequestStatusHistory;

    IF OBJECT_ID('dbo.Requests', 'U') IS NOT NULL
      DROP TABLE dbo.Requests;

    CREATE TABLE dbo.Requests (
      id INT IDENTITY(1, 1) NOT NULL,
      code NVARCHAR(20) NOT NULL,
      requesterId INT NOT NULL,
      targetAreaId INT NOT NULL,
      title NVARCHAR(300) NOT NULL,
      description NVARCHAR(MAX) NOT NULL,
      category NVARCHAR(100) NULL,
      priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Requests_priority DEFAULT (N'Medium'),
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_Requests_status DEFAULT (N'SUBMITTED'),
      rejectionReason NVARCHAR(500) NULL,
      linkedTaskId INT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Requests_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Requests_updatedAt DEFAULT (SYSUTCDATETIME()),
      resolvedAt DATETIME2 NULL,
      closedAt DATETIME2 NULL,
      CONSTRAINT PK_Requests PRIMARY KEY (id),
      CONSTRAINT UQ_Requests_code UNIQUE (code),
      CONSTRAINT FK_Requests_requesterId FOREIGN KEY (requesterId) REFERENCES dbo.Users (id),
      CONSTRAINT FK_Requests_targetAreaId FOREIGN KEY (targetAreaId) REFERENCES dbo.Areas (id),
      CONSTRAINT FK_Requests_linkedTaskId FOREIGN KEY (linkedTaskId) REFERENCES dbo.Tasks (id),
      CONSTRAINT CK_Requests_priority CHECK (priority IN (N'Low', N'Medium', N'High')),
      CONSTRAINT CK_Requests_status CHECK (
        status IN (
          N'SUBMITTED', N'RECEIVED', N'IN_PROGRESS', N'RESOLVED', N'REJECTED', N'CLOSED'
        )
      )
    );

    CREATE INDEX IX_Requests_requesterId ON dbo.Requests (requesterId);
    CREATE INDEX IX_Requests_targetAreaId ON dbo.Requests (targetAreaId);
    CREATE INDEX IX_Requests_status ON dbo.Requests (status);
    CREATE INDEX IX_Requests_createdAt ON dbo.Requests (createdAt DESC);

    CREATE TABLE dbo.RequestStatusHistory (
      id INT IDENTITY(1, 1) NOT NULL,
      requestId INT NOT NULL,
      changedBy INT NOT NULL,
      fromStatus NVARCHAR(20) NULL,
      toStatus NVARCHAR(20) NOT NULL,
      comment NVARCHAR(500) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_RequestStatusHistory_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_RequestStatusHistory PRIMARY KEY (id),
      CONSTRAINT FK_RequestStatusHistory_requestId FOREIGN KEY (requestId) REFERENCES dbo.Requests (id) ON DELETE CASCADE,
      CONSTRAINT FK_RequestStatusHistory_changedBy FOREIGN KEY (changedBy) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_RequestStatusHistory_requestId ON dbo.RequestStatusHistory (requestId);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.RequestStatusHistory', 'U') IS NOT NULL
      DROP TABLE dbo.RequestStatusHistory;
    IF OBJECT_ID('dbo.Requests', 'U') IS NOT NULL
      DROP TABLE dbo.Requests;
  `);
};

exports._meta = {
  version: 1,
};
