export function DashboardIconCards() {
  return (
    <div className="row">
      <div className="col-xl-3 col-lg-4 col-sm-6">
        <div className="icon-card mb-30">
          <div className="icon purple">
            <i className="lni lni-bullhorn" aria-hidden />
          </div>
          <div className="content">
            <h5 className="mb-10">Comunicados nuevos</h5>
            <span className="text-gray">5 sin leer | +2 hoy</span>
          </div>
        </div>
      </div>
      <div className="col-xl-3 col-lg-4 col-sm-6">
        <div className="icon-card mb-30">
          <div className="icon success">
            <i className="lni lni-agenda" aria-hidden />
          </div>
          <div className="content">
            <h5 className="mb-10">Próximos eventos</h5>
            <span className="text-gray">Reunión de equipo (14:00)</span>
          </div>
        </div>
      </div>
      <div className="col-xl-3 col-lg-4 col-sm-6">
        <div className="icon-card mb-30">
          <div className="icon primary">
            <i className="lni lni-user" aria-hidden />
          </div>
          <div className="content">
            <h5 className="mb-10">Destacados del equipo</h5>
            <span className="text-gray">2 hoy</span>
          </div>
        </div>
      </div>
      <div className="col-xl-3 col-lg-4 col-sm-6">
        <div className="icon-card mb-30">
          <div className="icon orange">
            <i className="lni lni-bulb" aria-hidden />
          </div>
          <div className="content">
            <h5 className="mb-10">Consejo rápido</h5>
            <span className="text-gray">Enfócate en una tarea a la vez</span>
          </div>
        </div>
      </div>
    </div>
  );
}
