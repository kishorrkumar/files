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

  const from = String(call.from || call.fromNumber || call.from_number || call.caller_id || call.callerId ||
    body.from || body.fromNumber || body.from_number || '').trim();
  const to = String(call.to || call.toNumber || call.to_number || call.recipient || call.phone ||
    body.to || body.toNumber || body.to_number || body.phone || '').trim();
  const callType = call.callType || call.call_type || call.type || body.callType || body.call_type ||
    (call.campaignId || call.campaign_id ? 'Campaign' : 'Live Call');
  const disposition = String(call.disposition || call.disposition_tag || call.dispositionName || call.disposition_name ||
    call.analysis?.disposition || body.disposition || body.disposition_tag || body.analysis?.disposition || '').trim();

  let cost = call.cost ?? call.callCost ?? call.call_cost ?? body.cost ?? body.callCost ?? '';
  if (typeof cost === 'number' && cost > 0) {
    cost = `₹${cost.toFixed(2)}`;
  } else if (typeof cost === 'string' && cost.trim()) {
    cost = cost.trim();
    if (!cost.startsWith('₹') && !cost.startsWith('$')) {
      const num = parseFloat(cost.replace(/[^\d.]/g, ''));
      if (!isNaN(num) && num > 0) cost = `₹${num.toFixed(2)}`;
    }
  }

  const snapserveCallId = String(call.executionId || call.execution_id || call.exec_id ||
    call.id || call.callId || call.call_id || body.executionId || body.execution_id || body.callId || body.id || '');

  return {
    snapserve_call_id: snapserveCallId,
    agent_id: String(call.agentId || call.agent_id || call.agent?.id || body.agentId || body.agent_id || body.agent?.id || ''),
    agent_name: call.agentName || call.agent_name || call.agent?.name || body.agentName || body.agent_name || body.agent?.name || '',
    phone: to || from || '',
    from_number: from,
    to_number: to,
    call_type: callType,
    disposition: disposition,
    cost: String(cost || ''),
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
