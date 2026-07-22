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
    IF COL_LENGTH('dbo.Users', 'avatarUrl') IS NULL
    BEGIN
      ALTER TABLE dbo.Users
      ADD avatarUrl NVARCHAR(512) NULL;
    END
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF COL_LENGTH('dbo.Users', 'avatarUrl') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.Users DROP COLUMN avatarUrl;
    END
  `);
};

exports._meta = {
  version: 1,
};
