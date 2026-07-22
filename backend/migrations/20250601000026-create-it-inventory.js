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
    IF OBJECT_ID('dbo.StockMovements', 'U') IS NOT NULL DROP TABLE dbo.StockMovements;
    IF OBJECT_ID('dbo.Consumables', 'U') IS NOT NULL DROP TABLE dbo.Consumables;
    IF OBJECT_ID('dbo.ConsumableCategories', 'U') IS NOT NULL DROP TABLE dbo.ConsumableCategories;
    IF OBJECT_ID('dbo.AssetMaintenanceLogs', 'U') IS NOT NULL DROP TABLE dbo.AssetMaintenanceLogs;
    IF OBJECT_ID('dbo.AssetAssignmentHistory', 'U') IS NOT NULL DROP TABLE dbo.AssetAssignmentHistory;
    IF OBJECT_ID('dbo.Assets', 'U') IS NOT NULL DROP TABLE dbo.Assets;
    IF OBJECT_ID('dbo.AssetCategories', 'U') IS NOT NULL DROP TABLE dbo.AssetCategories;
    IF OBJECT_ID('dbo.InventoryStockAlertLog', 'U') IS NOT NULL DROP TABLE dbo.InventoryStockAlertLog;

    CREATE TABLE dbo.AssetCategories (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      icon NVARCHAR(50) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_AssetCategories_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_AssetCategories PRIMARY KEY (id),
      CONSTRAINT UQ_AssetCategories_name UNIQUE (name)
    );

    CREATE TABLE dbo.Assets (
      id INT IDENTITY(1, 1) NOT NULL,
      code NVARCHAR(20) NOT NULL,
      serial NVARCHAR(100) NULL,
      sku NVARCHAR(100) NULL,
      name NVARCHAR(300) NOT NULL,
      brand NVARCHAR(100) NULL,
      model NVARCHAR(100) NULL,
      description NVARCHAR(MAX) NULL,
      categoryId INT NOT NULL,
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_Assets_status DEFAULT (N'ACTIVE'),
      condition NVARCHAR(20) NOT NULL CONSTRAINT DF_Assets_condition DEFAULT (N'GOOD'),
      purchaseDate DATE NULL,
      warrantyExpiry DATE NULL,
      purchasePrice DECIMAL(18, 2) NULL,
      location NVARCHAR(200) NULL,
      assignedTo INT NULL,
      assignedAt DATETIME2 NULL,
      notes NVARCHAR(MAX) NULL,
      createdBy INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Assets_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Assets_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Assets PRIMARY KEY (id),
      CONSTRAINT UQ_Assets_code UNIQUE (code),
      CONSTRAINT UQ_Assets_serial UNIQUE (serial),
      CONSTRAINT FK_Assets_categoryId FOREIGN KEY (categoryId) REFERENCES dbo.AssetCategories (id),
      CONSTRAINT FK_Assets_assignedTo FOREIGN KEY (assignedTo) REFERENCES dbo.Users (id),
      CONSTRAINT FK_Assets_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id),
      CONSTRAINT CK_Assets_status CHECK (
        status IN (N'ACTIVE', N'IN_MAINTENANCE', N'RETIRED', N'LOST', N'STOLEN')
      ),
      CONSTRAINT CK_Assets_condition CHECK (
        condition IN (N'NEW', N'GOOD', N'FAIR', N'POOR')
      )
    );

    CREATE INDEX IX_Assets_categoryId ON dbo.Assets (categoryId);
    CREATE INDEX IX_Assets_status ON dbo.Assets (status);
    CREATE INDEX IX_Assets_assignedTo ON dbo.Assets (assignedTo);

    CREATE TABLE dbo.AssetAssignmentHistory (
      id INT IDENTITY(1, 1) NOT NULL,
      assetId INT NOT NULL,
      userId INT NOT NULL,
      assignedBy INT NOT NULL,
      assignedAt DATETIME2 NOT NULL CONSTRAINT DF_AssetAssignmentHistory_assignedAt DEFAULT (SYSUTCDATETIME()),
      returnedAt DATETIME2 NULL,
      notes NVARCHAR(500) NULL,
      CONSTRAINT PK_AssetAssignmentHistory PRIMARY KEY (id),
      CONSTRAINT FK_AssetAssignmentHistory_assetId FOREIGN KEY (assetId) REFERENCES dbo.Assets (id) ON DELETE CASCADE,
      CONSTRAINT FK_AssetAssignmentHistory_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT FK_AssetAssignmentHistory_assignedBy FOREIGN KEY (assignedBy) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_AssetAssignmentHistory_assetId ON dbo.AssetAssignmentHistory (assetId);

    CREATE TABLE dbo.AssetMaintenanceLogs (
      id INT IDENTITY(1, 1) NOT NULL,
      assetId INT NOT NULL,
      performedBy INT NOT NULL,
      type NVARCHAR(20) NOT NULL,
      description NVARCHAR(MAX) NOT NULL,
      cost DECIMAL(18, 2) NULL,
      performedAt DATETIME2 NOT NULL,
      nextMaintenanceAt DATETIME2 NULL,
      relatedTicketId INT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_AssetMaintenanceLogs_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_AssetMaintenanceLogs PRIMARY KEY (id),
      CONSTRAINT FK_AssetMaintenanceLogs_assetId FOREIGN KEY (assetId) REFERENCES dbo.Assets (id) ON DELETE CASCADE,
      CONSTRAINT FK_AssetMaintenanceLogs_performedBy FOREIGN KEY (performedBy) REFERENCES dbo.Users (id),
      CONSTRAINT FK_AssetMaintenanceLogs_relatedTicketId FOREIGN KEY (relatedTicketId) REFERENCES dbo.Tickets (id),
      CONSTRAINT CK_AssetMaintenanceLogs_type CHECK (
        type IN (N'PREVENTIVE', N'CORRECTIVE', N'UPGRADE')
      )
    );

    CREATE INDEX IX_AssetMaintenanceLogs_assetId ON dbo.AssetMaintenanceLogs (assetId);

    CREATE TABLE dbo.ConsumableCategories (
      id INT IDENTITY(1, 1) NOT NULL,
      name NVARCHAR(100) NOT NULL,
      description NVARCHAR(500) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_ConsumableCategories_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_ConsumableCategories PRIMARY KEY (id),
      CONSTRAINT UQ_ConsumableCategories_name UNIQUE (name)
    );

    CREATE TABLE dbo.Consumables (
      id INT IDENTITY(1, 1) NOT NULL,
      sku NVARCHAR(100) NOT NULL,
      name NVARCHAR(300) NOT NULL,
      brand NVARCHAR(100) NULL,
      model NVARCHAR(100) NULL,
      description NVARCHAR(MAX) NULL,
      categoryId INT NOT NULL,
      unit NVARCHAR(20) NOT NULL CONSTRAINT DF_Consumables_unit DEFAULT (N'UNIT'),
      currentStock INT NOT NULL CONSTRAINT DF_Consumables_currentStock DEFAULT (0),
      minimumStock INT NOT NULL CONSTRAINT DF_Consumables_minimumStock DEFAULT (0),
      location NVARCHAR(200) NULL,
      createdBy INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Consumables_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Consumables_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Consumables PRIMARY KEY (id),
      CONSTRAINT UQ_Consumables_sku UNIQUE (sku),
      CONSTRAINT FK_Consumables_categoryId FOREIGN KEY (categoryId) REFERENCES dbo.ConsumableCategories (id),
      CONSTRAINT FK_Consumables_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id),
      CONSTRAINT CK_Consumables_unit CHECK (unit IN (N'UNIT', N'BOX', N'PACK', N'ROLL')),
      CONSTRAINT CK_Consumables_currentStock CHECK (currentStock >= 0)
    );

    CREATE INDEX IX_Consumables_categoryId ON dbo.Consumables (categoryId);

    CREATE TABLE dbo.StockMovements (
      id INT IDENTITY(1, 1) NOT NULL,
      consumableId INT NOT NULL,
      type NVARCHAR(20) NOT NULL,
      quantity INT NOT NULL,
      previousStock INT NOT NULL,
      newStock INT NOT NULL,
      reason NVARCHAR(500) NULL,
      relatedTicketId INT NULL,
      performedBy INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_StockMovements_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_StockMovements PRIMARY KEY (id),
      CONSTRAINT FK_StockMovements_consumableId FOREIGN KEY (consumableId) REFERENCES dbo.Consumables (id),
      CONSTRAINT FK_StockMovements_relatedTicketId FOREIGN KEY (relatedTicketId) REFERENCES dbo.Tickets (id),
      CONSTRAINT FK_StockMovements_performedBy FOREIGN KEY (performedBy) REFERENCES dbo.Users (id),
      CONSTRAINT CK_StockMovements_type CHECK (type IN (N'IN', N'OUT', N'ADJUSTMENT'))
    );

    CREATE INDEX IX_StockMovements_consumableId ON dbo.StockMovements (consumableId);
    CREATE INDEX IX_StockMovements_relatedTicketId ON dbo.StockMovements (relatedTicketId);

    CREATE TABLE dbo.InventoryStockAlertLog (
      id INT IDENTITY(1, 1) NOT NULL,
      alertDate DATE NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_InventoryStockAlertLog_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_InventoryStockAlertLog PRIMARY KEY (id),
      CONSTRAINT UQ_InventoryStockAlertLog_alertDate UNIQUE (alertDate)
    );

    INSERT INTO dbo.AssetCategories (name, description, icon) VALUES
      (N'Computación', N'Equipos de cómputo', N'monitor'),
      (N'Periféricos', N'Teclados, mouse, audífonos', N'mouse'),
      (N'Red', N'Switches, routers, access points', N'network'),
      (N'Impresión', N'Impresoras y multifuncionales', N'printer'),
      (N'Telefonía', N'Teléfonos y VoIP', N'phone'),
      (N'Otros', N'Otros activos tecnológicos', N'box');

    INSERT INTO dbo.ConsumableCategories (name, description) VALUES
      (N'Tóner/Tinta', N'Consumibles de impresión'),
      (N'Cables', N'Cables y conectores'),
      (N'Almacenamiento', N'Discos, USB, etc.'),
      (N'Repuestos', N'Repuestos varios'),
      (N'Papelería TI', N'Insumos de oficina TI'),
      (N'Otros', N'Otros consumibles');
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.InventoryStockAlertLog;
    DROP TABLE IF EXISTS dbo.StockMovements;
    DROP TABLE IF EXISTS dbo.Consumables;
    DROP TABLE IF EXISTS dbo.ConsumableCategories;
    DROP TABLE IF EXISTS dbo.AssetMaintenanceLogs;
    DROP TABLE IF EXISTS dbo.AssetAssignmentHistory;
    DROP TABLE IF EXISTS dbo.Assets;
    DROP TABLE IF EXISTS dbo.AssetCategories;
  `);
};

exports._meta = { version: 1 };
