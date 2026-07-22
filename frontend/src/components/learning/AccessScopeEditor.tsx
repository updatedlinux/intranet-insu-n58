import { useCallback, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ApiError } from '../../api/client';
import { fetchLearningAreas, searchLearningUsers } from '../../api/learning';
import type { LearningUserOption } from '../../api/learning.types';

interface Props {
  areaIds: number[];
  exceptionUserIds: number[];
  exceptionUsers: LearningUserOption[];
  onChange: (areaIds: number[], exceptionUserIds: number[], users: LearningUserOption[]) => void;
}

export function AccessScopeEditor({ areaIds, exceptionUserIds, exceptionUsers, onChange }: Props) {
  const [areas, setAreas] = useState<{ id: number; name: string }[]>([]);
  const [userQuery, setUserQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LearningUserOption[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void fetchLearningAreas()
      .then((r) => setAreas(r.areas))
      .catch(() => setAreas([]));
  }, []);

  const runSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearching(true);
      try {
        const res = await searchLearningUsers(q);
        setSearchResults(res.items.filter((u) => !exceptionUserIds.includes(u.id)));
      } catch (err) {
        console.error(err instanceof ApiError ? err.message : err);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    },
    [exceptionUserIds],
  );

  useEffect(() => {
    const t = setTimeout(() => void runSearch(userQuery), 300);
    return () => clearTimeout(t);
  }, [userQuery, runSearch]);

  const toggleArea = (id: number) => {
    const next = areaIds.includes(id) ? areaIds.filter((a) => a !== id) : [...areaIds, id];
    onChange(next, exceptionUserIds, exceptionUsers);
  };

  const addUser = (user: LearningUserOption) => {
    if (exceptionUserIds.includes(user.id)) return;
    onChange(areaIds, [...exceptionUserIds, user.id], [...exceptionUsers, user]);
    setUserQuery('');
    setSearchResults([]);
  };

  const removeUser = (id: number) => {
    onChange(
      areaIds,
      exceptionUserIds.filter((u) => u !== id),
      exceptionUsers.filter((u) => u.id !== id),
    );
  };

  return (
    <div className="row g-3">
      <div className="col-md-6">
        <label className="form-label fw-semibold">Áreas con acceso</label>
        <div className="border rounded p-2" style={{ maxHeight: 200, overflowY: 'auto' }}>
          {areas.map((a) => (
            <label key={a.id} className="d-flex align-items-center gap-2 py-1">
              <input
                type="checkbox"
                checked={areaIds.includes(a.id)}
                onChange={() => toggleArea(a.id)}
              />
              <span>{a.name}</span>
            </label>
          ))}
          {!areas.length ? <p className="text-muted small mb-0">Cargando áreas…</p> : null}
        </div>
      </div>
      <div className="col-md-6">
        <label className="form-label fw-semibold">Excepciones (usuarios individuales)</label>
        <input
          type="search"
          className="form-control"
          placeholder="Buscar por nombre o correo…"
          value={userQuery}
          onChange={(e) => setUserQuery(e.target.value)}
        />
        {searching ? <p className="small text-muted mt-1">Buscando…</p> : null}
        {searchResults.length > 0 ? (
          <ul className="list-group list-group-flush mt-1">
            {searchResults.map((u) => (
              <li key={u.id} className="list-group-item list-group-item-action py-2">
                <button
                  type="button"
                  className="btn btn-link btn-sm p-0 text-start"
                  onClick={() => addUser(u)}
                >
                  {u.fullName} · {u.email}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="learning-scope mt-2">
          {exceptionUsers.map((u) => (
            <span key={u.id} className="learning-scope__chip">
              {u.fullName}
              <button
                type="button"
                className="btn btn-sm p-0 border-0 bg-transparent"
                aria-label="Quitar"
                onClick={() => removeUser(u.id)}
              >
                <X size={14} />
              </button>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
