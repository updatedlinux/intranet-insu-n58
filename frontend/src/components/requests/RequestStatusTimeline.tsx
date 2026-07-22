import type { RequestStatusHistoryItem } from '../../api/requests.types';
import { requestStatusLabel } from './RequestBadges';
import { formatDateTime } from '../../utils/relative-time';

export function RequestStatusTimeline({ history }: { history: RequestStatusHistoryItem[] }) {
  if (history.length === 0) {
    return <p className="text-gray">Sin historial de cambios.</p>;
  }

  return (
    <ol className="req-timeline" aria-label="Historial de estados">
      {history.map((entry, index) => (
        <li key={entry.id} className="req-timeline__item">
          <div className="req-timeline__marker" aria-hidden />
          <div className="req-timeline__body">
            <div className="req-timeline__head">
              <strong>
                {entry.fromStatus
                  ? `${requestStatusLabel(entry.fromStatus)} → ${requestStatusLabel(entry.toStatus)}`
                  : requestStatusLabel(entry.toStatus)}
              </strong>
              <time className="req-timeline__time" dateTime={entry.createdAt}>
                {formatDateTime(entry.createdAt)}
              </time>
            </div>
            <p className="req-timeline__meta">{entry.changedByName}</p>
            {entry.comment && <p className="req-timeline__comment">{entry.comment}</p>}
          </div>
          {index < history.length - 1 && <div className="req-timeline__line" aria-hidden />}
        </li>
      ))}
    </ol>
  );
}
