export type Action = { task: string; evidence: string };
export type DateItem = { date: string; meaning: string; evidence: string };
export type Brief = {
  title: string;
  summary: string;
  actions: Action[];
  dates: DateItem[];
  questions: string[];
};

export type Source = 'ON_DEVICE' | 'IN_CLOUD' | 'UNKNOWN' | 'SAMPLE';
export type PrivacyMode = 'auto' | 'device';
export type Change = {
  kind: 'changed' | 'added' | 'removed';
  before: string;
  after: string;
  impact: string;
  beforeEvidence: string;
  afterEvidence: string;
};
export type Comparison = { headline: string; summary: string; changes: Change[] };
