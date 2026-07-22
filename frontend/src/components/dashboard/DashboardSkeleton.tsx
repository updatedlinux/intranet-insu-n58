export function DashboardSkeleton() {
  return (
    <>
      <div className="dashboard-skeleton mb-30" style={{ minHeight: 120 }} />
      <div className="dashboard-skeleton mb-30" style={{ minHeight: 100 }} />
      <div className="row mb-30">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="col-xl-3 col-lg-4 col-sm-6">
            <div className="dashboard-skeleton mb-30" />
          </div>
        ))}
      </div>
      <div className="row">
        <div className="col-lg-8">
          <div className="dashboard-skeleton mb-30" style={{ minHeight: 240 }} />
        </div>
        <div className="col-lg-4">
          <div className="dashboard-skeleton mb-30" style={{ minHeight: 180 }} />
        </div>
      </div>
    </>
  );
}
