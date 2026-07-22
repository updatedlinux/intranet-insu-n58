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
    IF OBJECT_ID('dbo.LearningUserProgress', 'U') IS NOT NULL DROP TABLE dbo.LearningUserProgress;
    IF OBJECT_ID('dbo.LearningLessons', 'U') IS NOT NULL DROP TABLE dbo.LearningLessons;
    IF OBJECT_ID('dbo.LearningModules', 'U') IS NOT NULL DROP TABLE dbo.LearningModules;
    IF OBJECT_ID('dbo.LearningCourseExceptions', 'U') IS NOT NULL DROP TABLE dbo.LearningCourseExceptions;
    IF OBJECT_ID('dbo.LearningCourseAccess', 'U') IS NOT NULL DROP TABLE dbo.LearningCourseAccess;
    IF OBJECT_ID('dbo.LearningCourses', 'U') IS NOT NULL DROP TABLE dbo.LearningCourses;

    CREATE TABLE dbo.LearningCourses (
      id INT IDENTITY(1, 1) NOT NULL,
      code NVARCHAR(20) NOT NULL,
      title NVARCHAR(300) NOT NULL,
      description NVARCHAR(MAX) NULL,
      coverUrl NVARCHAR(500) NULL,
      createdBy INT NOT NULL,
      isPublished BIT NOT NULL CONSTRAINT DF_LearningCourses_isPublished DEFAULT (0),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_LearningCourses_createdAt DEFAULT (SYSUTCDATETIME()),
      updatedAt DATETIME2 NOT NULL CONSTRAINT DF_LearningCourses_updatedAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_LearningCourses PRIMARY KEY (id),
      CONSTRAINT UQ_LearningCourses_code UNIQUE (code),
      CONSTRAINT FK_LearningCourses_createdBy FOREIGN KEY (createdBy) REFERENCES dbo.Users (id)
    );

    CREATE INDEX IX_LearningCourses_isPublished ON dbo.LearningCourses (isPublished);

    CREATE TABLE dbo.LearningCourseAccess (
      id INT IDENTITY(1, 1) NOT NULL,
      courseId INT NOT NULL,
      areaId INT NOT NULL,
      CONSTRAINT PK_LearningCourseAccess PRIMARY KEY (id),
      CONSTRAINT FK_LearningCourseAccess_courseId FOREIGN KEY (courseId) REFERENCES dbo.LearningCourses (id) ON DELETE CASCADE,
      CONSTRAINT FK_LearningCourseAccess_areaId FOREIGN KEY (areaId) REFERENCES dbo.Areas (id),
      CONSTRAINT UQ_LearningCourseAccess_course_area UNIQUE (courseId, areaId)
    );

    CREATE INDEX IX_LearningCourseAccess_areaId ON dbo.LearningCourseAccess (areaId);

    CREATE TABLE dbo.LearningCourseExceptions (
      id INT IDENTITY(1, 1) NOT NULL,
      courseId INT NOT NULL,
      userId INT NOT NULL,
      CONSTRAINT PK_LearningCourseExceptions PRIMARY KEY (id),
      CONSTRAINT FK_LearningCourseExceptions_courseId FOREIGN KEY (courseId) REFERENCES dbo.LearningCourses (id) ON DELETE CASCADE,
      CONSTRAINT FK_LearningCourseExceptions_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT UQ_LearningCourseExceptions_course_user UNIQUE (courseId, userId)
    );

    CREATE INDEX IX_LearningCourseExceptions_userId ON dbo.LearningCourseExceptions (userId);

    CREATE TABLE dbo.LearningModules (
      id INT IDENTITY(1, 1) NOT NULL,
      courseId INT NOT NULL,
      title NVARCHAR(300) NOT NULL,
      [order] INT NOT NULL CONSTRAINT DF_LearningModules_order DEFAULT (0),
      CONSTRAINT PK_LearningModules PRIMARY KEY (id),
      CONSTRAINT FK_LearningModules_courseId FOREIGN KEY (courseId) REFERENCES dbo.LearningCourses (id) ON DELETE CASCADE
    );

    CREATE INDEX IX_LearningModules_courseId ON dbo.LearningModules (courseId);

    CREATE TABLE dbo.LearningLessons (
      id INT IDENTITY(1, 1) NOT NULL,
      moduleId INT NOT NULL,
      title NVARCHAR(300) NOT NULL,
      description NVARCHAR(MAX) NULL,
      contentType NVARCHAR(20) NOT NULL,
      fileKey NVARCHAR(500) NULL,
      fileName NVARCHAR(300) NULL,
      fileSize BIGINT NULL,
      [order] INT NOT NULL CONSTRAINT DF_LearningLessons_order DEFAULT (0),
      CONSTRAINT PK_LearningLessons PRIMARY KEY (id),
      CONSTRAINT FK_LearningLessons_moduleId FOREIGN KEY (moduleId) REFERENCES dbo.LearningModules (id) ON DELETE CASCADE,
      CONSTRAINT CK_LearningLessons_contentType CHECK (
        contentType IN (N'VIDEO', N'PDF', N'IMAGE', N'DOCUMENT')
      )
    );

    CREATE INDEX IX_LearningLessons_moduleId ON dbo.LearningLessons (moduleId);

    CREATE TABLE dbo.LearningUserProgress (
      id INT IDENTITY(1, 1) NOT NULL,
      userId INT NOT NULL,
      lessonId INT NOT NULL,
      completedAt DATETIME2 NOT NULL CONSTRAINT DF_LearningUserProgress_completedAt DEFAULT (SYSUTCDATETIME()),
      createdAt DATETIME2 NOT NULL CONSTRAINT DF_LearningUserProgress_createdAt DEFAULT (SYSUTCDATETIME()),
      CONSTRAINT PK_LearningUserProgress PRIMARY KEY (id),
      CONSTRAINT FK_LearningUserProgress_userId FOREIGN KEY (userId) REFERENCES dbo.Users (id),
      CONSTRAINT FK_LearningUserProgress_lessonId FOREIGN KEY (lessonId) REFERENCES dbo.LearningLessons (id) ON DELETE CASCADE,
      CONSTRAINT UQ_LearningUserProgress_user_lesson UNIQUE (userId, lessonId)
    );

    CREATE INDEX IX_LearningUserProgress_userId ON dbo.LearningUserProgress (userId);
    CREATE INDEX IX_LearningUserProgress_lessonId ON dbo.LearningUserProgress (lessonId);
  `);
};

exports.down = function (db) {
  return db.runSql(`
    IF OBJECT_ID('dbo.LearningUserProgress', 'U') IS NOT NULL DROP TABLE dbo.LearningUserProgress;
    IF OBJECT_ID('dbo.LearningLessons', 'U') IS NOT NULL DROP TABLE dbo.LearningLessons;
    IF OBJECT_ID('dbo.LearningModules', 'U') IS NOT NULL DROP TABLE dbo.LearningModules;
    IF OBJECT_ID('dbo.LearningCourseExceptions', 'U') IS NOT NULL DROP TABLE dbo.LearningCourseExceptions;
    IF OBJECT_ID('dbo.LearningCourseAccess', 'U') IS NOT NULL DROP TABLE dbo.LearningCourseAccess;
    IF OBJECT_ID('dbo.LearningCourses', 'U') IS NOT NULL DROP TABLE dbo.LearningCourses;
  `);
};

exports._meta = { version: 1 };
