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
    CREATE TABLE dbo.Users (
      id INT IDENTITY(1, 1) NOT NULL,
      firstName NVARCHAR(100) NOT NULL,
      lastName NVARCHAR(100) NOT NULL,
      email NVARCHAR(255) NOT NULL,
      passwordHash NVARCHAR(255) NOT NULL,
      roleId INT NOT NULL,
      areaId INT NOT NULL,
      positionId INT NOT NULL,
      isActive BIT NOT NULL CONSTRAINT DF_Users_isActive DEFAULT (1),
      mustChangePassword BIT NOT NULL CONSTRAINT DF_Users_mustChangePassword DEFAULT (0),
      lastLoginAt DATETIME2 NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Users_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Users_updatedAt DEFAULT (SYSUTCDATETIME()),
      createdBy INT NULL,
      CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (id),
      CONSTRAINT UQ_Users_email UNIQUE (email),
      CONSTRAINT FK_Users_roleId FOREIGN KEY (roleId) REFERENCES dbo.Roles (id),
      CONSTRAINT FK_Users_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id),
      CONSTRAINT FK_Users_positionId FOREIGN KEY (positionId) REFERENCES dbo.Positions (id),
      CONSTRAINT FK_Users_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_Users_roleId ON dbo.Users (roleId);
    CREATE INDEX IX_Users_areaId ON dbo.Users (areaId);
    CREATE INDEX IX_Users_positionId ON dbo.Users (positionId);
    CREATE INDEX IX_Users_createdBy ON dbo.Users (createdBy);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.Users;
  `);
};

exports._meta = {
  version: 1,
};
