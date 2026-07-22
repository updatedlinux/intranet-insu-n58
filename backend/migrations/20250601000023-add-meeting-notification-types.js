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
        N'TASK_ASSIGNED',
        N'TASK_MOVED',
        N'TASK_COMMENT',
        N'TASK_DUE_SOON',
        N'MEETING_CREATED',
        N'MEETING_RESCHEDULED',
        N'MEETING_CANCELLED',
        N'MEETING_REMINDER',
        N'SYSTEM'
      )
    );

    IF OBJECT_ID('dbo.CK_Notifications_resourceType', 'C') IS NOT NULL
      ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_resourceType;

    ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_resourceType CHECK (
      resourceType IS NULL
      OR resourceType IN (
        N'announcement', N'document', N'folder', N'ticket', N'task', N'board', N'meeting'
      )
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
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
        N'TASK_ASSIGNED',
        N'TASK_MOVED',
        N'TASK_COMMENT',
        N'TASK_DUE_SOON',
        N'SYSTEM'
      )
    );

    IF OBJECT_ID('dbo.CK_Notifications_resourceType', 'C') IS NOT NULL
      ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_resourceType;

    ALTER TABLE dbo.Notifications ADD CONSTRAINT CK_Notifications_resourceType CHECK (
      resourceType IS NULL
      OR resourceType IN (N'announcement', N'document', N'folder', N'ticket', N'task', N'board')
    );
  `);
};

exports._meta = {
  version: 1,
};
