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
      IF COL_LENGTH('dbo.AreaAccess', 'canAnnounce') IS NULL
      BEGIN
        ALTER TABLE dbo.AreaAccess
        ADD canAnnounce BIT NOT NULL CONSTRAINT DF_AreaAccess_canAnnounce DEFAULT (0);
      END;
    `)
    .then(() =>
      db.runSql(`
      UPDATE dbo.Users
      SET email = REPLACE(email, N'@insular.com', N'@yopmail.com'),
          updatedAt = SYSUTCDATETIME()
      WHERE email LIKE N'%@insular.com';
    `),
    );
};

exports.down = function (db) {
  return db.runSql(`
    IF COL_LENGTH('dbo.AreaAccess', 'canAnnounce') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.AreaAccess DROP CONSTRAINT IF EXISTS DF_AreaAccess_canAnnounce;
      ALTER TABLE dbo.AreaAccess DROP COLUMN canAnnounce;
    END;

    UPDATE dbo.Users
    SET email = REPLACE(email, N'@yopmail.com', N'@insular.com'),
        updatedAt = SYSUTCDATETIME()
    WHERE email LIKE N'%@yopmail.com';
  `);
};

exports._meta = {
  version: 1,
};
