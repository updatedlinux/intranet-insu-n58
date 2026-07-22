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
    CREATE TABLE dbo.Roles (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Roles_isActive DEFAULT (1),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Roles_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Roles_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Roles PRIMARY KEY CLUSTERED (id),
      CONSTRAINT UQ_Roles_name UNIQUE (name)
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.Roles;
  `);
};

exports._meta = {
  version: 1,
};
