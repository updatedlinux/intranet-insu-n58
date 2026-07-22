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
    IF OBJECT_ID('dbo.CorporateEventAreas', 'U') IS NOT NULL DROP TABLE dbo.CorporateEventAreas;
    IF OBJECT_ID('dbo.CorporateEvents', 'U') IS NOT NULL DROP TABLE dbo.CorporateEvents;

    CREATE TABLE dbo.CorporateEvents (
      id INT IDENTITY(1, 1) NOT NULL,
      title NVARCHAR(255) NOT NULL,
      description NVARCHAR(MAX) NULL,
      location NVARCHAR(300) NULL,
      startDateTime DATETIME2 NOT NULL,
      endDateTime DATETIME2 NOT NULL,
      isCompanyWide BIT NOT NULL CONSTRAINT DF_CorporateEvents_isCompanyWide DEFAULT (0),
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_CorporateEvents_status DEFAULT (N'DRAFT'),
      createdBy INT NOT NULL,
      publishedAt DATETIME2 NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_CorporateEvents_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_CorporateEvents_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_CorporateEvents PRIMARY KEY (id),
      CONSTRAINT FK_CorporateEvents_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id),
      CONSTRAINT CK_CorporateEvents_status CHECK (
        status IN (N'DRAFT', N'PUBLISHED', N'CANCELLED')
      ),
      CONSTRAINT CK_CorporateEvents_dates CHECK (endDateTime >= startDateTime)
    );

    CREATE INDEX IX_CorporateEvents_status_start
      ON dbo.CorporateEvents (status, startDateTime DESC);

    CREATE TABLE dbo.CorporateEventAreas (
      eventId INT NOT NULL,
      areaId INT NOT NULL,
      CONSTRAINT PK_CorporateEventAreas PRIMARY KEY (eventId, areaId),
      CONSTRAINT FK_CorporateEventAreas_eventId FOREIGN KEY (eventId)
        REFERENCES dbo.CorporateEvents (id) ON DELETE CASCADE,
      CONSTRAINT FK_CorporateEventAreas_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id)
    );

    CREATE INDEX IX_CorporateEventAreas_areaId ON dbo.CorporateEventAreas (areaId);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.CorporateEventAreas', 'U') IS NOT NULL DROP TABLE dbo.CorporateEventAreas;
    IF OBJECT_ID('dbo.CorporateEvents', 'U') IS NOT NULL DROP TABLE dbo.CorporateEvents;
  `);
};

exports._meta = { version: 1 };
