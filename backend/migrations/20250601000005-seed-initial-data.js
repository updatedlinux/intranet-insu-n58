'use strict';

const bcrypt = require('bcrypt');

let dbm;
let type;
let seed;

const DEFAULT_TEMP_PASSWORD = 'ChangeMe123!';
const SUPERADMIN_ROLE = 'superadmin';
const ADMIN_EMAIL = 'admin@yopmail.com';

exports.setup = function (options, seedLink) {
  dbm = options.dbmigrate;
  type = dbm.dataType;
  seed = seedLink;
};

exports.up = async function (db) {
  const tempPassword = process.env.SEED_ADMIN_PASSWORD?.trim() || DEFAULT_TEMP_PASSWORD;
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  const escapedHash = passwordHash.replace(/'/g, "''");

  return db.runSql(`
    DECLARE @roleId INT;
    DECLARE @areaId INT;
    DECLARE @positionId INT;

    INSERT INTO dbo.Roles (name, description, isActive)
    VALUES (
      N'${SUPERADMIN_ROLE}',
      N'Administrador del sistema con acceso total',
      1
    );

    SET @roleId = SCOPE_IDENTITY();

    INSERT INTO dbo.Areas (name, description, parentAreaId, isActive)
    VALUES (
      N'Dirección General',
      N'Área raíz para administración del sistema',
      NULL,
      1
    );

    SET @areaId = SCOPE_IDENTITY();

    INSERT INTO dbo.Positions (name, areaId, isActive)
    VALUES (
      N'Administrador del Sistema',
      @areaId,
      1
    );

    SET @positionId = SCOPE_IDENTITY();

    INSERT INTO dbo.Users (
      firstName,
      lastName,
      email,
      passwordHash,
      roleId,
      areaId,
      positionId,
      isActive,
      mustChangePassword,
      createdBy
    )
    VALUES (
      N'Administrador',
      N'Insular',
      N'${ADMIN_EMAIL}',
      N'${escapedHash}',
      @roleId,
      @areaId,
      @positionId,
      1,
      1,
      NULL
    );
  `);
};

exports.down = function (db) {
  return db.runSql(`
    DELETE FROM dbo.Users WHERE email = N'${ADMIN_EMAIL}';
    DELETE FROM dbo.Positions WHERE name = N'Administrador del Sistema';
    DELETE FROM dbo.Areas WHERE name = N'Dirección General';
    DELETE FROM dbo.Roles WHERE name = N'${SUPERADMIN_ROLE}';
  `);
};

exports._meta = {
  version: 1,
};
