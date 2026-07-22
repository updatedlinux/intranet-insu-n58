'use strict';

/**
 * Liderazgo explícito por área (independiente del cargo).
 * Un colaborador puede liderar varias áreas.
 */
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
      IF OBJECT_ID('dbo.AreaLeaders', 'U') IS NULL
      BEGIN
        CREATE TABLE dbo.AreaLeaders (
          id INT IDENTITY(1, 1) NOT NULL,
          areaId INT NOT NULL,
          userId INT NOT NULL,
          createdAt DATETIME2 NOT NULL CONSTRAINT DF_AreaLeaders_createdAt DEFAULT (SYSUTCDATETIME()),
          CONSTRAINT PK_AreaLeaders PRIMARY KEY CLUSTERED (id),
          CONSTRAINT FK_AreaLeaders_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id),
          CONSTRAINT FK_AreaLeaders_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
          CONSTRAINT UQ_AreaLeaders_area_user UNIQUE (areaId, userId)
        );

        CREATE INDEX IX_AreaLeaders_areaId ON dbo.AreaLeaders (areaId);
        CREATE INDEX IX_AreaLeaders_userId ON dbo.AreaLeaders (userId);
      END;
    `)
    .then(() =>
      db.runSql(`
        INSERT INTO dbo.AreaLeaders (areaId, userId)
        SELECT DISTINCT u.areaId, u.id
        FROM dbo.Users u
        INNER JOIN dbo.Positions p ON u.positionId = p.id
        WHERE u.isActive = 1
          AND p.isLeader = 1
          AND p.isActive = 1
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.AreaLeaders al
            WHERE al.areaId = u.areaId AND al.userId = u.id
          );
      `),
    );
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.AreaLeaders;
  `);
};

exports._meta = {
  version: 1,
};
