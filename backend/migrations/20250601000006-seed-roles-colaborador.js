'use strict';

const bcrypt = require('bcrypt');

let dbm;
let type;
let seed;

const DEFAULT_TEMP_PASSWORD = 'ChangeMe123!';
const ADMIN_EMAIL = 'admin@yopmail.com';
const COLLABORATOR_EMAIL = 'colaborador@yopmail.com';

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  const tempPassword = process.env.SEED_COLLABORATOR_PASSWORD?.trim()
    || process.env.SEED_ADMIN_PASSWORD?.trim()
    || DEFAULT_TEMP_PASSWORD;
  const passwordHash = await bcrypt.hash(tempPassword, 12);
  const escapedHash = passwordHash.replace(/'/g, "''");

  return db.runSql(`
    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE name = N'admin')
    BEGIN
      INSERT INTO dbo.Roles (name, description, isActive)
      VALUES (N'admin', N'Administración de la intranet y colaboradores', 1);
    END;

    IF NOT EXISTS (SELECT 1 FROM dbo.Roles WHERE name = N'colaborador')
    BEGIN
      INSERT INTO dbo.Roles (name, description, isActive)
      VALUES (N'colaborador', N'Colaborador con acceso a módulos operativos', 1);
    END;

    DECLARE @adminRoleId INT = (SELECT id FROM dbo.Roles WHERE name = N'admin');
    DECLARE @colaboradorRoleId INT = (SELECT id FROM dbo.Roles WHERE name = N'colaborador');

    UPDATE dbo.Users
    SET roleId = @adminRoleId, updatedAt = SYSUTCDATETIME()
    WHERE email = N'${ADMIN_EMAIL}'
      AND EXISTS (SELECT 1 FROM dbo.Roles WHERE name = N'superadmin' AND id = dbo.Users.roleId);

    IF NOT EXISTS (SELECT 1 FROM dbo.Users WHERE email = N'${COLLABORATOR_EMAIL}')
    BEGIN
      DECLARE @areaId INT;
      DECLARE @positionId INT;

      IF NOT EXISTS (SELECT 1 FROM dbo.Areas WHERE name = N'Operaciones')
      BEGIN
        INSERT INTO dbo.Areas (name, description, parentAreaId, isActive)
        VALUES (N'Operaciones', N'Área operativa de colaboradores', NULL, 1);
      END;

      SET @areaId = (SELECT id FROM dbo.Areas WHERE name = N'Operaciones');

      IF NOT EXISTS (SELECT 1 FROM dbo.Positions WHERE name = N'Colaborador' AND areaId = @areaId)
      BEGIN
        INSERT INTO dbo.Positions (name, areaId, isActive)
        VALUES (N'Colaborador', @areaId, 1);
      END;

      SET @positionId = (SELECT id FROM dbo.Positions WHERE name = N'Colaborador' AND areaId = @areaId);

      INSERT INTO dbo.Users (
        firstName, lastName, email, passwordHash,
        roleId, areaId, positionId,
        isActive, mustChangePassword, createdBy
      )
      VALUES (
        N'María', N'González', N'${COLLABORATOR_EMAIL}', N'${escapedHash}',
        @colaboradorRoleId, @areaId, @positionId,
        1, 1, NULL
      );
    END;
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DELETE FROM dbo.Users WHERE email = N'${COLLABORATOR_EMAIL}';
    DELETE FROM dbo.Positions WHERE name = N'Colaborador'
      AND areaId = (SELECT id FROM dbo.Areas WHERE name = N'Operaciones');
    DELETE FROM dbo.Areas WHERE name = N'Operaciones';
    DELETE FROM dbo.Roles WHERE name IN (N'admin', N'colaborador');
  `);
};

exports._meta = {
  version: 1,
};
