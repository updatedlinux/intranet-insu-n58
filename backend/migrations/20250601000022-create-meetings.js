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
    CREATE TABLE dbo.Meetings (
      id INT IDENTITY(1, 1) NOT NULL,
      title NVARCHAR(300) NOT NULL,
      description NVARCHAR(MAX) NULL,
      organizerId INT NOT NULL,
      startDateTime DATETIME2 NOT NULL,
      endDateTime DATETIME2 NOT NULL,
      isRemote BIT NOT NULL CONSTRAINT DF_Meetings_isRemote DEFAULT (0),
      meetingLink NVARCHAR(500) NULL,
      location NVARCHAR(300) NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_Meetings_status DEFAULT (N'SCHEDULED'),
      cancellationReason NVARCHAR(500) NULL,
      originalStartDateTime DATETIME2 NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Meetings_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Meetings_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Meetings PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Meetings_organizerId FOREIGN KEY (organizerId) REFERENCES dbo.Users (id),
      CONSTRAINT CK_Meetings_status CHECK (
        status IN (N'SCHEDULED', N'CANCELLED', N'RESCHEDULED', N'COMPLETED')
      ),
      CONSTRAINT CK_Meetings_end_after_start CHECK (endDateTime > startDateTime)
    );

    CREATE INDEX IX_Meetings_organizerId ON dbo.Meetings (organizerId);
    CREATE INDEX IX_Meetings_startDateTime ON dbo.Meetings (startDateTime);
    CREATE INDEX IX_Meetings_status ON dbo.Meetings (status);
    CREATE INDEX IX_Meetings_status_startDateTime ON dbo.Meetings (status, startDateTime);

    CREATE TABLE dbo.MeetingAttendees (
      id INT IDENTITY(1, 1) NOT NULL,
      meetingId INT NOT NULL,
      userId INT NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_MeetingAttendees_status DEFAULT (N'PENDING'),
      respondedAt DATETIME2 NULL,
      CONSTRAINT PK_MeetingAttendees PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_MeetingAttendees_meetingId FOREIGN KEY (meetingId) REFERENCES dbo.Meetings (id) ON DELETE CASCADE,
      CONSTRAINT FK_MeetingAttendees_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT UQ_MeetingAttendees_meeting_user UNIQUE (meetingId, userId),
      CONSTRAINT CK_MeetingAttendees_status CHECK (
        status IN (N'PENDING', N'ACCEPTED', N'DECLINED')
      )
    );

    CREATE INDEX IX_MeetingAttendees_meetingId ON dbo.MeetingAttendees (meetingId);
    CREATE INDEX IX_MeetingAttendees_userId ON dbo.MeetingAttendees (userId);

    CREATE TABLE dbo.MeetingExternalAttendees (
      id INT IDENTITY(1, 1) NOT NULL,
      meetingId INT NOT NULL,
      name NVARCHAR(200) NOT NULL,
      email NVARCHAR(255) NULL,
      company NVARCHAR(200) NULL,
      CONSTRAINT PK_MeetingExternalAttendees PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_MeetingExternalAttendees_meetingId FOREIGN KEY (meetingId) REFERENCES dbo.Meetings (id) ON DELETE CASCADE
    );

    CREATE INDEX IX_MeetingExternalAttendees_meetingId ON dbo.MeetingExternalAttendees (meetingId);

    CREATE TABLE dbo.MeetingReminderLog (
      id INT IDENTITY(1, 1) NOT NULL,
      meetingId INT NOT NULL,
      userId INT NULL,
      externalEmail NVARCHAR(255) NULL,
      reminderType NVARCHAR(20) NOT NULL,
      sentAt DATETIME2 NOT NULL CONSTRAINT DF_MeetingReminderLog_sentAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_MeetingReminderLog PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_MeetingReminderLog_meetingId FOREIGN KEY (meetingId) REFERENCES dbo.Meetings (id) ON DELETE CASCADE,
      CONSTRAINT FK_MeetingReminderLog_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT CK_MeetingReminderLog_type CHECK (
        reminderType IN (N'CREATED', N'REMINDER_24H', N'REMINDER_1H', N'CANCELLED', N'RESCHEDULED')
      )
    );

    CREATE INDEX IX_MeetingReminderLog_meetingId ON dbo.MeetingReminderLog (meetingId);
    CREATE INDEX IX_MeetingReminderLog_meeting_type ON dbo.MeetingReminderLog (meetingId, reminderType);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.MeetingReminderLog;
    DROP TABLE IF EXISTS dbo.MeetingExternalAttendees;
    DROP TABLE IF EXISTS dbo.MeetingAttendees;
    DROP TABLE IF EXISTS dbo.Meetings;
  `);
};

exports._meta = {
  version: 1,
};
