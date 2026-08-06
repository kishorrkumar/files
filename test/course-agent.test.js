const test = require('node:test');
const assert = require('node:assert/strict');

const { selectAgentForCourse, courseForAgentName } = require('../course-agent');

test('selects the active agent matching the requested course', async () => {
  const fetchAgents = async () => [
    { id: 'one', name: 'Full Stack Counsellor', status: 'inactive' },
    { id: 'two', name: 'Web Development Admissions', status: 'active' },
    { id: 'three', name: 'UI UX Counsellor', status: 'active' }
  ];

  const agent = await selectAgentForCourse('Full-Stack Web Development', fetchAgents);

  assert.equal(agent.id, 'two');
});

test('returns null when no agent matches the course', async () => {
  const agent = await selectAgentForCourse(
    'Filmmaking & Video Editing',
    async () => [{ id: 'one', name: 'UI UX Counsellor', status: 'active' }]
  );

  assert.equal(agent, null);
});

test('infers a course from a recognizable agent name', () => {
  assert.equal(courseForAgentName('Full Stack Counsellor'), 'Full-Stack Web Development');
  assert.equal(courseForAgentName('General Admissions'), '');
});
