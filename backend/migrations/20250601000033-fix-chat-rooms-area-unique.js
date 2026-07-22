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
    IF EXISTS (
      SELECT 1 FROM sys.key_constraints
      WHERE name = 'UQ_ChatRooms_areaId' AND parent_object_id = OBJECT_ID('dbo.ChatRooms')
    )
      ALTER TABLE dbo.ChatRooms DROP CONSTRAINT UQ_ChatRooms_areaId;

    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'UQ_ChatRooms_areaId_group' AND object_id = OBJECT_ID('dbo.ChatRooms')
    )
      DROP INDEX UQ_ChatRooms_areaId_group ON dbo.ChatRooms;

    CREATE UNIQUE INDEX UQ_ChatRooms_areaId_group
      ON dbo.ChatRooms (areaId)
      WHERE areaId IS NOT NULL;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = 'UQ_ChatRooms_areaId_group' AND object_id = OBJECT_ID('dbo.ChatRooms')
    )
      DROP INDEX UQ_ChatRooms_areaId_group ON dbo.ChatRooms;

    IF NOT EXISTS (
      SELECT 1 FROM sys.key_constraints
      WHERE name = 'UQ_ChatRooms_areaId' AND parent_object_id = OBJECT_ID('dbo.ChatRooms')
    )
      ALTER TABLE dbo.ChatRooms ADD CONSTRAINT UQ_ChatRooms_areaId UNIQUE (areaId);
  `);
};

exports._meta = { version: 1 };
