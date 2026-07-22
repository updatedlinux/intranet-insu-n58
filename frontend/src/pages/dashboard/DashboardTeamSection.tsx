const SPOTLIGHT_ROWS = [
  {
    id: '1',
    name: 'Carlos M.',
    role: 'Gerente de ventas',
    area: 'Ventas',
    highlight: 'Cerró el mayor acuerdo del Q2',
    avatar: 'https://i.pravatar.cc/40?img=57',
  },
  {
    id: '2',
    name: 'Ana R.',
    role: 'Diseñadora UX',
    area: 'Diseño',
    highlight: 'Lideró la renovación del sistema de diseño',
    avatar: 'https://i.pravatar.cc/40?img=10',
  },
];

export function DashboardTeamSection() {
  return (
    <div className="row">
      <div className="col-lg-5">
        <div className="card-style mb-30">
          <div className="title d-flex justify-content-between align-items-center">
            <div className="left">
              <h6 className="text-medium mb-30">Ubicación del equipo</h6>
            </div>
          </div>
          <div
            id="map"
            className="dashboard-map-placeholder"
            style={{ width: '100%', height: '390px', overflow: 'hidden' }}
          >
            <div className="dashboard-map-placeholder__inner">
              <i className="lni lni-map-marker" aria-hidden />
              <p>Mapa de colaboradores presenciales, híbridos y remotos</p>
            </div>
          </div>
        </div>
      </div>
      <div className="col-lg-7">
        <div className="card-style mb-30">
          <div className="title d-flex flex-wrap justify-content-between align-items-center">
            <div className="left">
              <h6 className="text-medium mb-30">Destacados del equipo</h6>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table top-selling-table">
              <thead>
                <tr>
                  <th />
                  <th>
                    <h6 className="text-sm text-medium">Nombre</h6>
                  </th>
                  <th className="min-width">
                    <h6 className="text-sm text-medium">Cargo</h6>
                  </th>
                  <th className="min-width">
                    <h6 className="text-sm text-medium">Área</h6>
                  </th>
                  <th className="min-width">
                    <h6 className="text-sm text-medium">Logro</h6>
                  </th>
                </tr>
              </thead>
              <tbody>
                {SPOTLIGHT_ROWS.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="check-input-primary">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`spotlight-${row.id}`}
                          aria-label={`Seleccionar ${row.name}`}
                        />
                      </div>
                    </td>
                    <td>
                      <div className="product">
                        <div className="image">
                          <img src={row.avatar} alt="" />
                        </div>
                        <p className="text-sm">{row.name}</p>
                      </div>
                    </td>
                    <td>
                      <p className="text-sm">{row.role}</p>
                    </td>
                    <td>
                      <p className="text-sm">{row.area}</p>
                    </td>
                    <td>
                      <p className="text-sm">{row.highlight}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card-style mb-30">
          <div className="title d-flex flex-wrap justify-content-between align-items-center">
            <div className="left">
              <h6 className="text-medium mb-30">Acceso rápido</h6>
            </div>
          </div>
          <div className="quick-access d-flex flex-wrap gap-20">
            {[
              { icon: 'lni-image', label: 'Portal RR.HH.' },
              { icon: 'lni-remove-file', label: 'Timesheet' },
              { icon: 'lni-support', label: 'Mesa de ayuda' },
              { icon: 'lni-slack', label: 'Slack' },
              { icon: 'lni-game', label: 'Capacitación' },
            ].map((item) => (
              <div key={item.label} className="quick-item text-center">
                <div className="icon-box">
                  <i className={`lni ${item.icon}`} aria-hidden />
                </div>
                <p>{item.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
