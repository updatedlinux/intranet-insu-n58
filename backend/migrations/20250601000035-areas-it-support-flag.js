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
      IF COL_LENGTH('dbo.Areas', 'isItSupportArea') IS NULL
      BEGIN
        ALTER TABLE dbo.Areas
        ADD isItSupportArea BIT NOT NULL
          CONSTRAINT DF_Areas_isItSupportArea DEFAULT (0);
      END;
    `)
    .then(() =>
      db.runSql(`
        UPDATE dbo.Areas
        SET isItSupportArea = 1, updatedAt = SYSUTCDATETIME()
        WHERE name IN (N'TI', N'Infraestructura Tecnológica')
          AND isItSupportArea = 0;

        IF NOT EXISTS (
          SELECT 1 FROM sys.indexes
          WHERE name = N'IX_Areas_isItSupportArea' AND object_id = OBJECT_ID(N'dbo.Areas')
        )
        BEGIN
          CREATE INDEX IX_Areas_isItSupportArea
            ON dbo.Areas (isItSupportArea)
            WHERE isItSupportArea = 1;
        END;
      `),
    );
};

exports.down = function (db) {
  return db.runSql(`
    IF EXISTS (
      SELECT 1 FROM sys.indexes
      WHERE name = N'IX_Areas_isItSupportArea' AND object_id = OBJECT_ID(N'dbo.Areas')
    )
      DROP INDEX IX_Areas_isItSupportArea ON dbo.Areas;

    IF COL_LENGTH('dbo.Areas', 'isItSupportArea') IS NOT NULL
    BEGIN
      ALTER TABLE dbo.Areas DROP CONSTRAINT IF EXISTS DF_Areas_isItSupportArea;
      ALTER TABLE dbo.Areas DROP COLUMN isItSupportArea;
    END;
  `);
};

exports._meta = { version: 1 };
