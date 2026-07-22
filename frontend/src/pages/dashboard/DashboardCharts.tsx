export function DashboardCharts() {
  return (
    <div className="row">
      <div className="col-lg-7">
        <div className="card-style mb-30">
          <div className="title d-flex flex-wrap justify-content-between">
            <div className="left">
              <h6 className="text-medium mb-10">Participación del equipo</h6>
            </div>
            <div className="right">
              <div className="select-style-1">
                <div className="select-position select-sm">
                  <select
                    className="light-bg"
                    defaultValue=""
                    aria-label="Métrica de participación"
                  >
                    <option value="">Asistencia a reuniones</option>
                    <option value="">Contribuciones a proyectos</option>
                    <option value="">Retroalimentación</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="chart">
            <canvas
              id="Chart1"
              style={{ width: '100%', height: '400px', marginLeft: '-35px' }}
              aria-label="Gráfico de participación"
            />
          </div>
        </div>
      </div>
      <div className="col-lg-5">
        <div className="card-style mb-30">
          <div className="title d-flex flex-wrap align-items-center justify-content-between">
            <div className="left">
              <h6 className="text-medium mb-30">Uso de herramientas por área</h6>
            </div>
            <div className="right">
              <div className="select-style-1">
                <div className="select-position select-sm">
                  <select className="light-bg" defaultValue="" aria-label="Herramienta">
                    <option value="">Intranet</option>
                    <option value="">Documentos</option>
                    <option value="">Directorio</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
          <div className="chart">
            <canvas
              id="Chart2"
              style={{ width: '100%', height: '400px', marginLeft: '-45px' }}
              aria-label="Gráfico de uso por área"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
