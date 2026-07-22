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
    IF COL_LENGTH('dbo.Consumables', 'imageKey') IS NULL
    BEGIN
      ALTER TABLE dbo.Consumables ADD imageKey NVARCHAR(500) NULL;
    END
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF COL_LENGTH('dbo.Consumables', 'imageKey') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.Consumables DROP COLUMN imageKey;
    END
  `);
};

exports._meta = { version: 1 };
