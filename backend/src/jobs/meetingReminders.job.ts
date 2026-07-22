import { MEETING_REMINDER_TYPE } from '../constants/meeting-reminder-type';
import {
  findMeetingsForReminder1h,
  findMeetingsForReminder24h,
  hasReminderLog,
} from '../repositories/meeting.repository';
import { autoCompletePastMeetings } from '../services/meeting.service';
import { notifyReminder } from '../services/meeting-notification.service';
import { registerCronJob, stopCronJobs } from './cron-registry';

const MEETING_CRON_REGISTRY = 'meetings';

async function runReminder24hJob(): Promise<void> {
  const meetings = await findMeetingsForReminder24h();
  for (const meeting of meetings) {
    const alreadySent = await hasReminderLog(meeting.id, MEETING_REMINDER_TYPE.REMINDER_24H);
    if (alreadySent) continue;
    await notifyReminder({ meeting }, MEETING_REMINDER_TYPE.REMINDER_24H);
  }
}

async function runReminder1hJob(): Promise<void> {
  const meetings = await findMeetingsForReminder1h();
  for (const meeting of meetings) {
    const alreadySent = await hasReminderLog(meeting.id, MEETING_REMINDER_TYPE.REMINDER_1H);
    if (alreadySent) continue;
    await notifyReminder({ meeting }, MEETING_REMINDER_TYPE.REMINDER_1H);
  }
}

async function runAutoCompleteJob(): Promise<void> {
  const updated = await autoCompletePastMeetings();
  if (updated > 0) {
    console.log(`[meetings] ${updated} reunión(es) marcada(s) como completadas`);
  }
}

export function startMeetingReminderJobs(): void {
  stopMeetingReminderJobs();

  registerCronJob(
    MEETING_CRON_REGISTRY,
    '0 * * * *',
    'meetings:recordatorio-24h',
    runReminder24hJob,
  );
  registerCronJob(
    MEETING_CRON_REGISTRY,
    '*/15 * * * *',
    'meetings:recordatorio-1h',
    runReminder1hJob,
  );
  registerCronJob(
    MEETING_CRON_REGISTRY,
    '0 * * * *',
    'meetings:auto-completar',
    runAutoCompleteJob,
  );

  console.log(
    '[meetings] Jobs de recordatorios activos (24h: cada hora, 1h: cada 15 min, auto-complete: cada hora)',
  );
}

export function stopMeetingReminderJobs(): void {
  stopCronJobs(MEETING_CRON_REGISTRY);
}
