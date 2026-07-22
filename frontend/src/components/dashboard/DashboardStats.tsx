import type { DashboardStatCard } from '../../api/dashboard.types';

const ICONS: Record<DashboardStatCard['variant'], string> = {
  purple: 'lni lni-bullhorn',
  success: 'lni lni-checkmark-circle',
  primary: 'lni lni-agenda',
  orange: 'lni lni-alarm-clock',
  danger: 'lni lni-warning',
};

interface Props {
  cards: DashboardStatCard[];
}

export function DashboardStats({ cards }: Props) {
  if (!cards.length) return null;

  return (
    <div className="row">
      {cards.map((card) => (
        <div key={card.key} className="col-xl-3 col-lg-4 col-sm-6">
          <div className="icon-card mb-30">
            <div className={`icon ${card.variant}`}>
              <i className={ICONS[card.variant]} aria-hidden />
            </div>
            <div className="content">
              <h5 className="mb-10">{card.label}</h5>
              <span className="text-medium d-block mb-1">{card.value}</span>
              {card.hint ? <span className="text-gray">{card.hint}</span> : null}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
