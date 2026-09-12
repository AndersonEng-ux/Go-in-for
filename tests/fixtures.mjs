// The coach's roster as a roster-link payload. Used by the engine tests and the phone flows.
export const COACH = {
  players: ['Knox', 'Foster', 'Drew', 'Liam', 'Lydon', 'Nolan', 'Abe', 'Craig', 'Chase', 'Miles', 'Harrison'],
  rules: [
    { type: 'keep', min: 1, names: ['Craig', 'Chase', 'Harrison'] },
    { type: 'keep', min: 1, names: ['Drew', 'Nolan', 'Knox'] },
    { type: 'apart', names: ['Knox', 'Lydon'] },
    { type: 'notOffTogether', names: ['Liam', 'Nolan'] },
  ],
};
