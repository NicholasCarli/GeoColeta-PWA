// Legacy names are accepted only while restoring/migrating existing sessions.
const legacyPermissions = {
  WCOGEO_ADMIN: 'ADMIN', WCOGEO_ANALISTA: 'ADMIN', PREFEITURA_ADMIN: 'ADMIN',
  WCOGEO_USUARIO: 'COLETOR', PREFEITURA_USUARIO: 'COLETOR',
};

export const normalizePermission = permission => Object.hasOwn(legacyPermissions, permission) ? legacyPermissions[permission] : permission;
