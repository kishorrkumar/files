function normalizeTranscript(value) {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value.map((item) => {
      if (typeof item === 'string') return item;
      return `${item.role || item.speaker || 'speaker'}: ${item.text || item.content || item.message || ''}`;
    }).join('\n');
  }
  return JSON.stringify(value, null, 2);
}

function normalizeCallStatus(status, call = {}) {
  const normalized = String(status || '').toLowerCase();
  const hasCompletedData = Number(call.duration || call.durationSeconds || 0) > 0 ||
    Boolean(call.summary || call.callSummary || call.transcript || call.messages || call.recording_url || call.recordingUrl);
  return (!normalized || normalized === 'unknown') && hasCompletedData
    ? 'completed'
    : (normalized || 'unknown');
}

function callFromPayload(body = {}) {
  const call = body.call || body.payload?.call || body.payload || body;
  const metadata = call.metadata || body.metadata || body.payload?.metadata || {};
  const variables = call.variables || call.dynamicVariables || body.variables || body.dynamicVariables ||
    body.payload?.variables || body.payload?.dynamicVariables || {};
  const recording = call.recordingUrl || call.recording_url || body.recordingUrl || body.recording_url || '';
  const recordingUrl = recording.startsWith('/') ? `https://app.snapserve.ai${recording}` : recording;
  const transcript = normalizeTranscript(
    call.transcript || call.callTranscript || call.call_transcript || call.messages ||
    body.transcript || body.callTranscript || body.call_transcript || body.messages
  );
  const duration = Number(
    call.durationSeconds || call.duration || call.callDuration ||
    body.durationSeconds || body.duration || body.callDuration || 0
  );
  const summary = call.callSummary || call.call_summary || call.summary ||
    body.callSummary || body.call_summary || body.summary || body.analysis?.summary || '';

  return {
    snapserve_call_id: String(call.id || call.callId || body.callId || body.id || ''),
    agent_id: String(call.agentId || call.agent_id || call.agent?.id || body.agentId || body.agent_id || body.agent?.id || ''),
    agent_name: call.agentName || call.agent_name || call.agent?.name || body.agentName || body.agent_name || body.agent?.name || '',
    phone: call.toNumber || call.phone || call.fromNumber || body.toNumber || body.phone || body.fromNumber || '',
    student_name: call.studentName || call.student_name || call.customerName || call.customer_name ||
      call.leadName || call.lead_name || body.studentName || body.student_name || body.customerName ||
      body.customer_name || body.leadName || body.lead_name || metadata.name || metadata.student_name ||
      variables.name || variables.student_name || '',
    course: call.course || call.courseName || call.course_name || body.course || body.courseName ||
      body.course_name || metadata.course || variables.course || '',
    duration,
    summary,
    success_evaluation: call.successEvaluation || call.success_evaluation || body.successEvaluation || body.success_evaluation || body.analysis?.successEvaluation || '',
    recording_url: recordingUrl,
    transcript,
    status: normalizeCallStatus(call.status || body.status || body.call_status || body.callStatus || body.event || body.type, {
      duration,
      summary,
      transcript,
      recording_url: recordingUrl
    }),
    created_at: call.createdAt || call.created_at || call.startedAt || body.createdAt || body.created_at || '',
    ended_at: call.endedAt || call.ended_at || body.endedAt || body.ended_at || ''
  };
}

function callsFromResponse(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.calls)) return payload.calls;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.data?.calls)) return payload.data.calls;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  return [];
}

module.exports = { normalizeTranscript, normalizeCallStatus, callFromPayload, callsFromResponse };
