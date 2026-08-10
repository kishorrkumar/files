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

test('selects a voice agent for the hackathon campaign', async () => {
  const agent = await selectAgentForCourse(
    'SnapServe Voice AI Hackathon',
    async () => [
      { id: 'general', name: 'General Admissions', status: 'active' },
      { id: 'voice', name: 'Liza - SnapServe Registration', status: 'active' }
    ]
  );

  assert.equal(agent.id, 'voice');
});

test('only explicitly interested Hackathon leads are eligible for calls', () => {
  const { isLeadEligibleForCall } = require('../course-agent');
  assert.equal(isLeadEligibleForCall('SnapServe Voice AI Hackathon', 'Yes, very interested'), true);
  assert.equal(isLeadEligibleForCall('SnapServe Voice AI Hackathon', 'Curious, exploring'), false);
  assert.equal(isLeadEligibleForCall('SnapServe Voice AI Hackathon', 'Not yet sure'), false);
});
