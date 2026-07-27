import { findSeniatLookupByCedula, upsertSeniatLookup } from '../../repositories/seniat-lookup.repository';
import { inferGender } from './gender';
import { lookupCedulaOnSeniat } from './seniat-client';

export interface CedulaRecord {
  cedula: string;
  rif: string;
  nombre: string;
  sexo: string;
  error: string;
  fromCache: boolean;
}

function normalizeCedula(value: string | number): string {
  return String(value).replace(/\D/g, '').trim();
}

/**
 * Consulta una cédula: primero caché local, si no existe SENIAT y persiste.
 */
export async function resolveCedula(cedulaInput: string | number): Promise<CedulaRecord> {
  const cedula = normalizeCedula(cedulaInput);
  const empty: CedulaRecord = {
    cedula,
    rif: '',
    nombre: '',
    sexo: '',
    error: '',
    fromCache: false,
  };

  if (!cedula) {
    return { ...empty, error: 'invalid_cedula' };
  }

  const cached = await findSeniatLookupByCedula(cedula);
  if (cached) {
    return {
      cedula,
      rif: cached.rif,
      nombre: cached.nombre,
      sexo: cached.sexo || inferGender(cached.nombre),
      error: '',
      fromCache: true,
    };
  }

  const remote = await lookupCedulaOnSeniat(cedula);
  if ('error' in remote) {
    return { ...empty, error: remote.error };
  }

  const sexo = inferGender(remote.nombre);
  await upsertSeniatLookup({
    cedula,
    rif: remote.rif,
    nombre: remote.nombre,
    sexo: sexo || null,
    source: 'SENIAT',
  });

  return {
    cedula,
    rif: remote.rif,
    nombre: remote.nombre,
    sexo,
    error: '',
    fromCache: false,
  };
}
