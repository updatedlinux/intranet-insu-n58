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
    IF COL_LENGTH('dbo.Assets', 'imageKey') IS NULL
    BEGIN
      ALTER TABLE dbo.Assets ADD imageKey NVARCHAR(500) NULL;
    END
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF COL_LENGTH('dbo.Assets', 'imageKey') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.Assets DROP COLUMN imageKey;
    END
  `);
};

exports._meta = { version: 1 };
