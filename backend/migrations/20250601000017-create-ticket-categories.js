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
    IF OBJECT_ID('dbo.TicketCategories', 'U') IS NULL
    BEGIN
      CREATE TABLE dbo.TicketCategories (
        id INT IDENTITY(1, 1) NOT NULL,
        name NVARCHAR(100) NOT NULL,
        description NVARCHAR(500) NULL,
        sortOrder INT NOT NULL CONSTRAINT DF_TicketCategories_sortOrder DEFAULT (0),
        isActive BIT NOT NULL CONSTRAINT DF_TicketCategories_isActive DEFAULT (1),
        createdAt DATETIME2 NOT NULL CONSTRAINT DF_TicketCategories_createdAt DEFAULT (SYSUTCDATETIME()),
        updatedAt DATETIME2 NOT NULL CONSTRAINT DF_TicketCategories_updatedAt DEFAULT (SYSUTCDATETIME()),
        CONSTRAINT PK_TicketCategories PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_TicketCategories_name UNIQUE (name)
      );
    END;
  `)
    .then(() =>
      db.runSql(`
      MERGE dbo.TicketCategories AS target
      USING (
        SELECT N'Soporte' AS name, N'Incidencias y consultas generales' AS description, 10 AS sortOrder UNION ALL
        SELECT N'Acceso', N'Permisos, cuentas y accesos a sistemas', 20 UNION ALL
        SELECT N'Equipos', N'Hardware, equipos y periféricos', 30 UNION ALL
        SELECT N'Software', N'Aplicaciones e instalaciones', 40 UNION ALL
        SELECT N'Otros', N'Otras solicitudes de TI', 50
      ) AS source ON target.name = source.name
      WHEN NOT MATCHED THEN
        INSERT (name, description, sortOrder, isActive)
        VALUES (source.name, source.description, source.sortOrder, 1);
    `),
    )
    .then(() =>
      db.runSql(`
      IF COL_LENGTH('dbo.Tickets', 'categoryId') IS NULL
      BEGIN
        ALTER TABLE dbo.Tickets ADD categoryId INT NULL;
      END;
    `),
    )
    .then(() =>
      db.runSql(`
      IF COL_LENGTH('dbo.Tickets', 'category') IS NOT NULL
      BEGIN
        UPDATE t
        SET t.categoryId = tc.id
        FROM dbo.Tickets t
        INNER JOIN dbo.TicketCategories tc ON tc.name = t.category
        WHERE t.categoryId IS NULL;

        UPDATE t
        SET t.categoryId = (SELECT TOP 1 id FROM dbo.TicketCategories WHERE name = N'Otros' ORDER BY id)
        FROM dbo.Tickets t
        WHERE t.categoryId IS NULL;
      END;
    `),
    )
    .then(() =>
      db.runSql(`
      IF COL_LENGTH('dbo.Tickets', 'categoryId') IS NOT NULL
         AND EXISTS (SELECT 1 FROM dbo.Tickets WHERE categoryId IS NULL)
      BEGIN
        UPDATE dbo.Tickets
        SET categoryId = (SELECT TOP 1 id FROM dbo.TicketCategories ORDER BY sortOrder, id)
        WHERE categoryId IS NULL;
      END;
    `),
    )
    .then(() =>
      db.runSql(`
      IF COL_LENGTH('dbo.Tickets', 'categoryId') IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM dbo.Tickets WHERE categoryId IS NULL)
      BEGIN
        IF OBJECT_ID('dbo.CK_Tickets_category', 'C') IS NOT NULL
          ALTER TABLE dbo.Tickets DROP CONSTRAINT CK_Tickets_category;

        IF COL_LENGTH('dbo.Tickets', 'category') IS NOT NULL
          ALTER TABLE dbo.Tickets DROP COLUMN category;

        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.Tickets') AND name = 'categoryId' AND is_nullable = 0)
        BEGIN
          ALTER TABLE dbo.Tickets ALTER COLUMN categoryId INT NOT NULL;
        END;

        IF OBJECT_ID('dbo.FK_Tickets_categoryId', 'F') IS NULL
        BEGIN
          ALTER TABLE dbo.Tickets
          ADD CONSTRAINT FK_Tickets_categoryId
          FOREIGN KEY (categoryId) REFERENCES dbo.TicketCategories (id);
        END;

        IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_Tickets_categoryId' AND object_id = OBJECT_ID('dbo.Tickets'))
          CREATE INDEX IX_Tickets_categoryId ON dbo.Tickets (categoryId);
      END;
    `),
    );
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.FK_Tickets_categoryId', 'F') IS NOT NULL
      ALTER TABLE dbo.Tickets DROP CONSTRAINT FK_Tickets_categoryId;

    IF COL_LENGTH('dbo.Tickets', 'categoryId') IS NOT NULL
    BEGIN
      IF COL_LENGTH('dbo.Tickets', 'category') IS NULL
        ALTER TABLE dbo.Tickets ADD category NVARCHAR(40) NULL;

      UPDATE t
      SET t.category = tc.name
      FROM dbo.Tickets t
      INNER JOIN dbo.TicketCategories tc ON t.categoryId = tc.id;

      ALTER TABLE dbo.Tickets DROP COLUMN categoryId;
    END;

    DROP TABLE IF EXISTS dbo.TicketCategories;
  `);
};

exports._meta = {
  version: 1,
};
