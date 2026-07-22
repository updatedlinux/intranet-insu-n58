'use strict';

/**
 * Tras recrear MinIO (bucket vacío), las filas en SQL siguen apuntando a claves
 * que ya no existen y provocan errores (p. ej. avatares 500 / NoSuchKey).
 *
 * Esta migración elimina esas referencias sin tocar usuarios, roles ni datos
 * de negocio (tickets, tareas, documentos, etc. permanecen; solo se quita el
 * enlace al archivo en almacenamiento).
 *
 * Redis: sesiones, rate limits y tokens de recuperación de contraseña viven
 * únicamente en Redis, no en SQL. Un servidor Redis nuevo/vacío no requiere
 * limpieza en base de datos (opcional en Redis: FLUSHDB si se desea forzar
 * cierre de sesiones activas).
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
  return db.runSql(`
    -- Avatares (Users.avatarUrl → clave o URL pública en MinIO)
    IF COL_LENGTH('dbo.Users', 'avatarUrl') IS NOT NULL
    BEGIN
      UPDATE dbo.Users
      SET avatarUrl = NULL, updatedAt = SYSUTCDATETIME()
      WHERE avatarUrl IS NOT NULL;
    END;

    -- Repositorio documental
    IF COL_LENGTH('dbo.Documents', 'fileKey') IS NOT NULL
    BEGIN
      UPDATE dbo.Documents
      SET
        fileKey = NULL,
        fileName = NULL,
        fileSize = NULL,
        mimeType = NULL,
        updatedAt = SYSUTCDATETIME()
      WHERE fileKey IS NOT NULL;
    END;

    -- Comunicados (portada en MinIO)
    IF OBJECT_ID('dbo.Announcements', 'U') IS NOT NULL
    BEGIN
      UPDATE dbo.Announcements
      SET imageUrl = NULL, updatedAt = SYSUTCDATETIME()
      WHERE imageUrl IS NOT NULL;
    END;

    -- Inventario TI
    IF COL_LENGTH('dbo.Assets', 'imageKey') IS NOT NULL
    BEGIN
      UPDATE dbo.Assets
      SET imageKey = NULL, updatedAt = SYSUTCDATETIME()
      WHERE imageKey IS NOT NULL;
    END;

    IF COL_LENGTH('dbo.Consumables', 'imageKey') IS NOT NULL
    BEGIN
      UPDATE dbo.Consumables
      SET imageKey = NULL, updatedAt = SYSUTCDATETIME()
      WHERE imageKey IS NOT NULL;
    END;

    -- Learning: portadas y lecciones con archivo
    IF OBJECT_ID('dbo.LearningCourses', 'U') IS NOT NULL
    BEGIN
      UPDATE dbo.LearningCourses
      SET coverUrl = NULL, updatedAt = SYSUTCDATETIME()
      WHERE coverUrl IS NOT NULL;
    END;

    IF OBJECT_ID('dbo.LearningLessons', 'U') IS NOT NULL
    BEGIN
      UPDATE dbo.LearningLessons
      SET fileKey = NULL, fileName = NULL, fileSize = NULL
      WHERE fileKey IS NOT NULL;
    END;

    -- Chat: conservar el texto del mensaje, quitar adjunto
    IF OBJECT_ID('dbo.ChatMessages', 'U') IS NOT NULL
    BEGIN
      UPDATE dbo.ChatMessages
      SET fileUrl = NULL, fileName = NULL, fileType = NULL
      WHERE fileUrl IS NOT NULL;
    END;

    -- Adjuntos cuyo único propósito es el archivo en MinIO
    IF OBJECT_ID('dbo.TaskAttachments', 'U') IS NOT NULL
      DELETE FROM dbo.TaskAttachments;

    IF OBJECT_ID('dbo.TicketAttachments', 'U') IS NOT NULL
      DELETE FROM dbo.TicketAttachments;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    -- Irreversible: no se pueden restaurar claves ni objetos eliminados de MinIO.
    SELECT 1 AS noop;
  `);
};

exports._meta = { version: 1 };
