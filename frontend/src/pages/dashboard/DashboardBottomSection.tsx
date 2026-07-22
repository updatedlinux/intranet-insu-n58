const TASKS = [
  {
    id: '1',
    task: 'Enviar informe Q2',
    priority: 'Alta',
    status: 'Pendiente',
    statusClass: 'close-btn',
  },
  {
    id: '2',
    task: 'Unirse a retrospectiva',
    priority: 'Media',
    status: 'Completada',
    statusClass: 'success-btn',
  },
  {
    id: '3',
    task: 'Encuesta almuerzo de equipo',
    priority: 'Baja',
    status: 'En progreso',
    statusClass: 'warning-btn',
  },
  {
    id: '4',
    task: 'Configurar permisos de acceso',
    priority: 'Media',
    status: 'Pendiente',
    statusClass: 'close-btn',
  },
];

export function DashboardBottomSection() {
  return (
    <>
      <div className="row">
        <div className="col-lg-9">
          <div className="card-style mb-30">
            <div className="title d-flex flex-wrap align-items-center justify-content-between">
              <div className="left">
                <h6 className="text-medium mb-2">Pronóstico de asistencia a reuniones</h6>
              </div>
              <div className="right">
                <div className="select-style-1 mb-2">
                  <div className="select-position select-sm">
                    <select className="light-bg" defaultValue="" aria-label="Periodo">
                      <option value="">Último mes</option>
                      <option value="">Últimos 3 meses</option>
                      <option value="">Último año</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="chart">
              <ul className="legend3 d-flex flex-wrap align-items-center mb-30">
                <li>
                  <div className="d-flex">
                    <span className="bg-color green-bg" />
                    <div className="text">
                      <p className="text-sm text-success">
                        <span className="text-dark">Reuniones de equipo</span> +25.55%
                        <i className="lni lni-arrow-up" aria-hidden />
                      </p>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="d-flex">
                    <span className="bg-color blue-bg" />
                    <div className="text">
                      <p className="text-sm text-success">
                        <span className="text-dark">Standups</span> +45.55%
                        <i className="lni lni-arrow-up" aria-hidden />
                      </p>
                    </div>
                  </div>
                </li>
                <li>
                  <div className="d-flex">
                    <span className="bg-color orange-bg" />
                    <div className="text">
                      <p className="text-sm text-danger">
                        <span className="text-dark">Town halls</span> -4.2%
                        <i className="lni lni-arrow-down" aria-hidden />
                      </p>
                    </div>
                  </div>
                </li>
              </ul>
              <canvas
                id="Chart3"
                style={{ width: '100%', height: '450px', marginLeft: '-35px' }}
                aria-label="Gráfico de pronóstico de asistencia"
              />
            </div>
          </div>
        </div>
        <div className="col-lg-3">
          <div className="card-style mb-30">
            <div className="title d-flex flex-wrap align-items-center justify-content-between">
              <div className="left">
                <h6 className="text-medium mb-2">Frase del día</h6>
                <div className="quote">
                  Ir a dormir sabiendo que hicimos algo maravilloso — eso es lo que importa.
                </div>
                <div className="author">Steve Jobs</div>
              </div>
            </div>
          </div>
          <div className="card-style mb-30 feedback-card">
            <h6 className="feedback-title">Comentarios</h6>
            <textarea className="feedback-input" placeholder="Escribe tu comentario..." />
            <button type="button" className="feedback-btn">
              Enviar
            </button>
          </div>
        </div>
      </div>
      <div className="row">
        <div className="col-lg-12">
          <div className="card-style mb-30">
            <div className="title d-flex flex-wrap align-items-center justify-content-between">
              <div className="left">
                <h6 className="text-medium mb-30">Mis tareas / acciones pendientes</h6>
              </div>
              <div className="right">
                <div className="select-style-1">
                  <div className="select-position select-sm">
                    <select className="light-bg" defaultValue="" aria-label="Filtro de tareas">
                      <option value="">Hoy</option>
                      <option value="">Ayer</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="table-responsive">
              <table className="table top-selling-table">
                <thead>
                  <tr>
                    <th>
                      <h6 className="text-sm text-medium">Tarea</h6>
                    </th>
                    <th className="min-width">
                      <h6 className="text-sm text-medium">Prioridad</h6>
                    </th>
                    <th className="min-width">
                      <h6 className="text-sm text-medium">Estado</h6>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {TASKS.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div className="product">
                          <p className="text-sm">{row.task}</p>
                        </div>
                      </td>
                      <td>
                        <span className={`status-btn ${row.statusClass}`}>{row.priority}</span>
                      </td>
                      <td>
                        <span className={`status-btn ${row.statusClass}`}>{row.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
