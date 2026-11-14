import { httpClient } from './httpClient';

export const RECORDS_PAGE_SIZE = 10;

/** O tipo de registro do relatório: uma reunião realizada ou uma atividade (RF61). */
export type RecordType = 'meeting' | 'activity';

export interface MeetingRecord {
  type: 'meeting';
  id: number;
  /** O dia do início da reunião (AAAA-MM-DD), usado na ordem. */
  date: string;
  startsAt: string;
  endsAt: string;
  description: string;
  /** Os apontamentos do professor (RF58); vazio quando não há. */
  notes: string;
}

export type RecordActivityStatus = 'completed' | 'archived';

export interface ActivityRecord {
  type: 'activity';
  id: number;
  /** O prazo da atividade (AAAA-MM-DD), usado na ordem. */
  date: string;
  deadline: string;
  title: string;
  description: string;
  status: RecordActivityStatus;
}

/** O id sozinho não identifica o registro: reuniões e atividades vêm de tabelas diferentes. */
export type AdvisingRecord = MeetingRecord | ActivityRecord;

export interface AdvisingRecordPage {
  items: AdvisingRecord[];
  count: number;
}

interface ApiMeetingRecord {
  type: 'meeting';
  id: number;
  date: string;
  starts_at: string;
  ends_at: string;
  description: string;
  notes: string;
}

interface ApiActivityRecord {
  type: 'activity';
  id: number;
  date: string;
  deadline: string;
  title: string;
  description: string;
  status: RecordActivityStatus;
}

function toRecord(item: ApiMeetingRecord | ApiActivityRecord): AdvisingRecord {
  if (item.type === 'meeting') {
    return {
      type: 'meeting',
      id: item.id,
      date: item.date,
      startsAt: item.starts_at,
      endsAt: item.ends_at,
      description: item.description,
      notes: item.notes,
    };
  }
  return {
    type: 'activity',
    id: item.id,
    date: item.date,
    deadline: item.deadline,
    title: item.title,
    description: item.description,
    status: item.status,
  };
}

/**
 * Os registros de uma orientação encerrada (RF61): do mais recente para o mais antigo, paginados.
 * `type` filtra por reuniões ou atividades; sem ele, vêm todos. `count` é o total do filtro.
 */
export async function listAdvisingRecords(
  advisingId: number,
  page: number,
  type?: RecordType,
): Promise<AdvisingRecordPage> {
  const params = new URLSearchParams({
    limit: String(RECORDS_PAGE_SIZE),
    offset: String((page - 1) * RECORDS_PAGE_SIZE),
  });
  if (type) params.set('type', type);
  const response = await httpClient.get<{
    items: (ApiMeetingRecord | ApiActivityRecord)[];
    count: number;
  }>(`/orientacao/historico/${advisingId}/registros?${params}`);
  return { count: response.count, items: response.items.map(toRecord) };
}
