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
    CREATE TABLE dbo.Positions (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(200) NOT NULL,
      areaId INT NOT NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Positions_isActive DEFAULT (1),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Positions_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Positions_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Positions PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Positions_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id)
    );

    CREATE INDEX IX_Positions_areaId ON dbo.Positions (areaId);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.Positions;
  `);
};

exports._meta = {
  version: 1,
};
