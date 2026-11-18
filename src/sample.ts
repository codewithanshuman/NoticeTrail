import type { Brief, Comparison } from './types';

export const sampleNotice = `Community Garden Volunteer Orientation

Thanks for signing up for the Spring Garden program. To keep your place, please complete the volunteer agreement by Friday, April 17. The orientation is Saturday, April 18 at 9:30 AM in the East Library meeting room. Bring a photo ID and closed-toe shoes. If you cannot attend, email garden@neighborhood.example by April 15 to request another session. Garden plots will be assigned after orientation.`;

export const sampleBrief: Brief = {
  title: 'Community garden orientation',
  summary: 'To keep your volunteer place, complete the agreement and attend orientation. Bring a photo ID and closed-toe shoes.',
  actions: [
    { task: 'Complete the volunteer agreement by April 17.', evidence: '“complete the volunteer agreement by Friday, April 17”' },
    { task: 'Go to the East Library meeting room on April 18 at 9:30 AM.', evidence: '“Saturday, April 18 at 9:30 AM in the East Library meeting room”' },
    { task: 'Bring a photo ID and closed-toe shoes.', evidence: '“Bring a photo ID and closed-toe shoes.”' },
  ],
  dates: [
    { date: 'April 15', meaning: 'Email if you need another session', evidence: '“email garden@neighborhood.example by April 15”' },
    { date: 'April 17', meaning: 'Volunteer agreement due', evidence: '“agreement by Friday, April 17”' },
    { date: 'April 18, 9:30 AM', meaning: 'Orientation', evidence: '“orientation is Saturday, April 18 at 9:30 AM”' },
  ],
  questions: ['Where can I find the volunteer agreement?'],
};

export const sampleOldNotice = `Community Garden Volunteer Orientation\n\nPlease complete the volunteer agreement by Friday, April 17. Orientation is Saturday, April 18 at 9:30 AM in the East Library meeting room. Bring a photo ID and closed-toe shoes. If you cannot attend, email garden@neighborhood.example by April 15 to request another session.`;

export const sampleNewNotice = `Community Garden Volunteer Orientation — Updated\n\nPlease complete the volunteer agreement by Thursday, April 16. Orientation is Sunday, April 19 at 10:00 AM in the West Library meeting room. Bring a photo ID, closed-toe shoes, and a reusable water bottle. If you cannot attend, email garden@neighborhood.example by April 17 to request another session.`;

export const sampleComparison: Comparison = {
  headline: 'Four changes to your garden orientation',
  summary: 'The agreement is due sooner. Orientation moved to a different day, time, and room. Bring a water bottle, and note the later rescheduling deadline.',
  changes: [
    { kind: 'changed', before: 'Agreement due Friday, April 17', after: 'Agreement due Thursday, April 16', impact: 'Complete the agreement one day earlier.', beforeEvidence: 'complete the volunteer agreement by Friday, April 17', afterEvidence: 'complete the volunteer agreement by Thursday, April 16' },
    { kind: 'changed', before: 'Saturday, April 18 at 9:30 AM, East Library', after: 'Sunday, April 19 at 10:00 AM, West Library', impact: 'Update your plan for the new orientation time and location.', beforeEvidence: 'Saturday, April 18 at 9:30 AM in the East Library meeting room', afterEvidence: 'Sunday, April 19 at 10:00 AM in the West Library meeting room' },
    { kind: 'added', before: '', after: 'Bring a reusable water bottle', impact: 'Add a water bottle to what you bring.', beforeEvidence: '', afterEvidence: 'a reusable water bottle' },
    { kind: 'changed', before: 'Request another session by April 15', after: 'Request another session by April 17', impact: 'The rescheduling deadline is later.', beforeEvidence: 'email garden@neighborhood.example by April 15', afterEvidence: 'email garden@neighborhood.example by April 17' },
  ],
};
