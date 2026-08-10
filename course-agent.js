const { fetchSnapserveAgents } = require('./snapserve');

const COURSE_AGENT_KEYWORDS = {
  'SnapServe Voice AI Hackathon': ['snapserve', 'voice', 'hackathon', 'event', 'registration'],
  'UI/UX Design Mastery': ['ui', 'ux', 'design'],
  'Full-Stack Web Development': ['full stack', 'full-stack', 'web development', 'developer'],
  'Filmmaking & Video Editing': ['film', 'video', 'editing', 'editor']
};

async function selectAgentForCourse(course, fetchAgents = fetchSnapserveAgents) {
  const keywords = COURSE_AGENT_KEYWORDS[course] || [];
  if (!keywords.length) return null;

  const agents = await fetchAgents();
  const matches = agents.filter((agent) => {
    const name = String(agent.name || '').toLowerCase();
    return keywords.some((keyword) => name.includes(keyword));
  });

  matches.sort((a, b) => {
    const activeA = String(a.status || '').toLowerCase() === 'active' ? 0 : 1;
    const activeB = String(b.status || '').toLowerCase() === 'active' ? 0 : 1;
    return activeA - activeB || String(a.name || a.id).localeCompare(String(b.name || b.id));
  });

  return matches[0] || null;
}

function courseForAgentName(agentName) {
  const name = String(agentName || '').toLowerCase();
  return Object.entries(COURSE_AGENT_KEYWORDS).find(([, keywords]) =>
    keywords.some((keyword) => name.includes(keyword))
  )?.[0] || '';
}

module.exports = { COURSE_AGENT_KEYWORDS, selectAgentForCourse, courseForAgentName };
