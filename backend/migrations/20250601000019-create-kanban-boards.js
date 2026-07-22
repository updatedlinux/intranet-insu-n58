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
    CREATE TABLE dbo.Boards (
      id INT IDENTITY(1, 1) NOT NULL,
      areaId INT NOT NULL,
      name NVARCHAR(200) NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Boards_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_Boards PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Boards_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id),
      CONSTRAINT UQ_Boards_areaId UNIQUE (areaId)
    );

    CREATE INDEX IX_Boards_areaId ON dbo.Boards (areaId);

    CREATE TABLE dbo.BoardColumns (
      id INT IDENTITY(1, 1) NOT NULL,
      boardId INT NOT NULL,
      name NVARCHAR(100) NOT NULL,
      [order] INT NOT NULL,
      color NVARCHAR(7) NULL,
      defaultStatus NVARCHAR(20) NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_BoardColumns_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_BoardColumns PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_BoardColumns_boardId FOREIGN KEY (boardId) REFERENCES dbo.Boards (id) ON DELETE CASCADE,
      CONSTRAINT UQ_BoardColumns_board_order UNIQUE (boardId, [order])
    );

    CREATE INDEX IX_BoardColumns_boardId ON dbo.BoardColumns (boardId);

    CREATE TABLE dbo.Tasks (
      id INT IDENTITY(1, 1) NOT NULL,
      boardId INT NOT NULL,
      columnId INT NOT NULL,
      title NVARCHAR(300) NOT NULL,
      description NVARCHAR(MAX) NULL,
      priority NVARCHAR(20) NOT NULL CONSTRAINT DF_Tasks_priority DEFAULT (N'Medium'),
      status NVARCHAR(20) NOT NULL CONSTRAINT DF_Tasks_status DEFAULT (N'OPEN'),
      color NVARCHAR(7) NULL,
      dueDate DATETIME2 NULL,
      createdBy INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_Tasks_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_Tasks_updatedAt DEFAULT (SYSUTCDATETIME()),
      archivedAt DATETIME2 NULL,
      completedAt DATETIME2 NULL,
      [order] INT NOT NULL CONSTRAINT DF_Tasks_order DEFAULT (0),
      CONSTRAINT PK_Tasks PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_Tasks_boardId FOREIGN KEY (boardId) REFERENCES dbo.Boards (id),
      CONSTRAINT FK_Tasks_columnId FOREIGN KEY (columnId) REFERENCES dbo.BoardColumns (id),
      CONSTRAINT FK_Tasks_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id),
      CONSTRAINT CK_Tasks_priority CHECK (priority IN (N'Low', N'Medium', N'High', N'Critical')),
      CONSTRAINT CK_Tasks_status CHECK (status IN (N'OPEN', N'IN_PROGRESS', N'IN_REVIEW', N'DONE', N'ARCHIVED'))
    );

    CREATE INDEX IX_Tasks_boardId ON dbo.Tasks (boardId);
    CREATE INDEX IX_Tasks_columnId ON dbo.Tasks (columnId);
    CREATE INDEX IX_Tasks_createdBy ON dbo.Tasks (createdBy);
    CREATE INDEX IX_Tasks_status ON dbo.Tasks (status);
    CREATE INDEX IX_Tasks_dueDate ON dbo.Tasks (dueDate) WHERE dueDate IS NOT NULL;

    CREATE TABLE dbo.TaskAssignees (
      id INT IDENTITY(1, 1) NOT NULL,
      taskId INT NOT NULL,
      userId INT NOT NULL,
      assignedAt DATETIME2 NOT NULL CONSTRAINT DF_TaskAssignees_assignedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_TaskAssignees PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_TaskAssignees_taskId FOREIGN KEY (taskId) REFERENCES dbo.Tasks (id) ON DELETE CASCADE,
      CONSTRAINT FK_TaskAssignees_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT UQ_TaskAssignees_task_user UNIQUE (taskId, userId)
    );

    CREATE INDEX IX_TaskAssignees_taskId ON dbo.TaskAssignees (taskId);
    CREATE INDEX IX_TaskAssignees_userId ON dbo.TaskAssignees (userId);

    CREATE TABLE dbo.TaskTags (
      id INT IDENTITY(1, 1) NOT NULL,
      taskId INT NOT NULL,
      tagId INT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_TaskTags_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_TaskTags PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_TaskTags_taskId FOREIGN KEY (taskId) REFERENCES dbo.Tasks (id) ON DELETE CASCADE,
      CONSTRAINT FK_TaskTags_tagId FOREIGN KEY (tagId) REFERENCES dbo.Tags (id),
      CONSTRAINT UQ_TaskTags_task_tag UNIQUE (taskId, tagId)
    );

    CREATE INDEX IX_TaskTags_taskId ON dbo.TaskTags (taskId);

    CREATE TABLE dbo.TaskAttachments (
      id INT IDENTITY(1, 1) NOT NULL,
      taskId INT NOT NULL,
      uploadedBy INT NOT NULL,
      fileName NVARCHAR(255) NOT NULL,
      fileKey NVARCHAR(500) NOT NULL,
      fileType NVARCHAR(100) NOT NULL,
      fileSize BIGINT NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_TaskAttachments_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_TaskAttachments PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_TaskAttachments_taskId FOREIGN KEY (taskId) REFERENCES dbo.Tasks (id) ON DELETE CASCADE,
      CONSTRAINT FK_TaskAttachments_uploadedBy FOREIGN KEY (uploadedBy) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_TaskAttachments_taskId ON dbo.TaskAttachments (taskId);

    CREATE TABLE dbo.TaskComments (
      id INT IDENTITY(1, 1) NOT NULL,
      taskId INT NOT NULL,
      userId INT NOT NULL,
      message NVARCHAR(MAX) NOT NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_TaskComments_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_TaskComments PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_TaskComments_taskId FOREIGN KEY (taskId) REFERENCES dbo.Tasks (id) ON DELETE CASCADE,
      CONSTRAINT FK_TaskComments_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_TaskComments_taskId ON dbo.TaskComments (taskId);

    CREATE TABLE dbo.TaskActivityLog (
      id INT IDENTITY(1, 1) NOT NULL,
      taskId INT NOT NULL,
      userId INT NOT NULL,
      action NVARCHAR(30) NOT NULL,
      metadata NVARCHAR(MAX) NULL,
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_TaskActivityLog_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_TaskActivityLog PRIMARY KEY CLUSTERED (id),
      CONSTRAINT FK_TaskActivityLog_taskId FOREIGN KEY (taskId) REFERENCES dbo.Tasks (id) ON DELETE CASCADE,
      CONSTRAINT FK_TaskActivityLog_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT CK_TaskActivityLog_action CHECK (action IN (
        N'CREATED', N'MOVED', N'ASSIGNED', N'COMMENTED', N'ATTACHMENT_ADDED',
        N'STATUS_CHANGED', N'ARCHIVED', N'UPDATED'
      ))
    );

    CREATE INDEX IX_TaskActivityLog_taskId ON dbo.TaskActivityLog (taskId);

    -- Boards y columnas por defecto para áreas existentes
    INSERT INTO dbo.Boards (areaId, name)
    SELECT a.id, N'Tablero ' + a.name
    FROM dbo.Areas a
    WHERE NOT EXISTS (SELECT 1 FROM dbo.Boards b WHERE b.areaId = a.id);

    INSERT INTO dbo.BoardColumns (boardId, name, [order], color, defaultStatus)
    SELECT b.id, cols.name, cols.[order], cols.color, cols.defaultStatus
    FROM dbo.Boards b
    CROSS APPLY (VALUES
      (N'Por Hacer', 0, N'#64748b', N'OPEN'),
      (N'En Progreso', 1, N'#0369a1', N'IN_PROGRESS'),
      (N'En Revisión', 2, N'#b45309', N'IN_REVIEW'),
      (N'Completado', 3, N'#15803d', N'DONE')
    ) AS cols(name, [order], color, defaultStatus)
    WHERE NOT EXISTS (SELECT 1 FROM dbo.BoardColumns bc WHERE bc.boardId = b.id);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DROP TABLE IF EXISTS dbo.TaskActivityLog;
    DROP TABLE IF EXISTS dbo.TaskComments;
    DROP TABLE IF EXISTS dbo.TaskAttachments;
    DROP TABLE IF EXISTS dbo.TaskTags;
    DROP TABLE IF EXISTS dbo.TaskAssignees;
    DROP TABLE IF EXISTS dbo.Tasks;
    DROP TABLE IF EXISTS dbo.BoardColumns;
    DROP TABLE IF EXISTS dbo.Boards;
  `);
};

exports._meta = {
  version: 1,
};
