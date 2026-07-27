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
    IF OBJECT_ID('dbo.SeniatLookups', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.SeniatLookups (
        id INT IDENTITY(1, 1) NOT NULL,
        cedula NVARCHAR(20) NOT NULL,
        rif NVARCHAR(20) NOT NULL,
        nombre NVARCHAR(300) NOT NULL,
        sexo NVARCHAR(20) NULL,
        source NVARCHAR(20) NOT NULL CONSTRAINT DF_SeniatLookups_source DEFAULT (N'SENIAT'),
        consultedAt DATETIME2 NOT NULL CONSTRAINT DF_SeniatLookups_consultedAt DEFAULT (SYSUTCDATETIME()),
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_SeniatLookups_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_SeniatLookups_updatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_SeniatLookups PRIMARY KEY (id),
        CONSTRAINT UQ_SeniatLookups_cedula UNIQUE (cedula),
        CONSTRAINT CK_SeniatLookups_sexo CHECK (
          sexo IS NULL OR sexo IN (N'FEMENINO', N'MASCULINO')
        ),
        CONSTRAINT CK_SeniatLookups_source CHECK (
          source IN (N'SENIAT', N'MANUAL')
        )
      );

      CREATE INDEX IX_SeniatLookups_rif ON dbo.SeniatLookups (rif);
      CREATE INDEX IX_SeniatLookups_consultedAt ON dbo.SeniatLookups (consultedAt DESC);
    END
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.SeniatLookups', 'U') IS NOT NULL DROP TABLE dbo.SeniatLookups;
  `);
};

exports._meta = { version: 1 };
