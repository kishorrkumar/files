document.addEventListener('DOMContentLoaded', () => {
  const callSearch = document.getElementById('callSearch');
  const callStatusFilter = document.getElementById('callStatusFilter');
  const callAgentFilter = document.getElementById('callAgentFilter');
  const callDispositionFilter = document.getElementById('callDispositionFilter');
  const callDateRangeFilter = document.getElementById('callDateRangeFilter');
  const callSortFilter = document.getElementById('callSortFilter');
  const exportCallsBtn = document.getElementById('exportCallsBtn');
  const clearCallFilters = document.getElementById('clearCallFilters');
  const callResultCount = document.getElementById('callResultCount');
  const callsBody = document.getElementById('callsBody');
  const refreshCallsBtn = document.getElementById('refreshCallsBtn');
  const logoutBtn = document.getElementById('logoutBtn');

  // Modals
  const recordingModal = document.getElementById('recordingModal');
  const closeRecordingModal = document.getElementById('closeRecordingModal');
  const recordingPlayPause = document.getElementById('recordingPlayPause');
  const recordingTime = document.getElementById('recordingTime');
  const playbackSpeed = document.getElementById('playbackSpeed');
  const recordingError = document.getElementById('recordingError');
  const downloadAudioLink = document.getElementById('downloadAudioLink');

  const transcriptModal = document.getElementById('transcriptModal');
  const closeTranscriptModal = document.getElementById('closeTranscriptModal');
  const transcriptBody = document.getElementById('transcriptBody');
  const copyTranscriptBtn = document.getElementById('copyTranscriptBtn');

  const summaryModal = document.getElementById('summaryModal');
  const closeSummaryModal = document.getElementById('closeSummaryModal');

  let availableCalls = [];
  let availableAgents = [];
  let availableLeads = [];
  let visibleCalls = [];
  let recordingWaveSurfer = null;
  let activeTranscriptText = '';

  const DISPOSITION_CONFIG = {
    interested: {
      label: 'Interested',
      class: 'disp-interested',
      icon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    },
    followup: {
      label: 'Follow Up',
      class: 'disp-followup',
      icon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    notinterested: {
      label: 'Not Interested',
      class: 'disp-notinterested',
      icon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    },
    noanswer: {
      label: 'No Answer',
      class: 'disp-noanswer',
      icon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 3.41l2.48-2.48a1 1 0 0 1 1.05-.24 11.2 11.2 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1 11.2 11.2 0 0 0 .56 3.5 1 1 0 0 1-.24 1.05z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`
    },
    converted: {
      label: 'Converted',
      class: 'disp-converted',
      icon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    },
    failed: {
      label: 'Failed',
      class: 'disp-failed',
      icon: `<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    }
  };

  const safe = (val) => String(val ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);

  function normalizedPhone(phone) {
    return String(phone || '').replace(/\D/g, '').slice(-10);
  }

  function detectDisposition(call) {
    const evalStr = String(call.success_evaluation || '').toLowerCase();
    const summaryStr = String(call.summary || '').toLowerCase();
    const statusStr = String(call.status || '').toLowerCase();

    if (evalStr.includes('converted') || summaryStr.includes('converted') || summaryStr.includes('enrolled')) {
      return 'converted';
    }
    if (evalStr.includes('interested') || evalStr.includes('passed') || evalStr.includes('success') || evalStr.includes('true') || summaryStr.includes('interested')) {
      return 'interested';
    }
    if (evalStr.includes('follow') || evalStr.includes('callback') || summaryStr.includes('follow up') || summaryStr.includes('call back')) {
      return 'followup';
    }
    if (evalStr.includes('not interested') || summaryStr.includes('not interested') || evalStr.includes('rejected')) {
      return 'notinterested';
    }
    if (statusStr === 'failed' || statusStr === 'error') {
      return 'failed';
    }
    if (statusStr === 'no-answer' || statusStr === 'busy' || Number(call.duration || 0) === 0) {
      return 'noanswer';
    }
    return 'interested';
  }

  function renderDispositionPill(dispositionKey) {
    const config = DISPOSITION_CONFIG[dispositionKey] || DISPOSITION_CONFIG.interested;
    return `
      <span class="disposition-pill ${config.class}">
        ${config.icon}
        ${config.label}
      </span>
    `;
  }

  function formatCallDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  function formatDuration(seconds) {
    const secs = Number(seconds) || 0;
    if (secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  function formatCost(call) {
    const secs = Number(call.duration) || 0;
    if (secs === 0) return '$0.00';
    const estimatedCost = (secs / 60) * 0.02;
    return `$${Math.max(0.01, estimatedCost).toFixed(2)}`;
  }

  function populateFilterOptions() {
    const statuses = [...new Set(availableCalls.map(c => c.status).filter(Boolean))].sort();
    const agents = [...new Set(availableCalls.map(c => c.agent_name || c.agent_id).filter(Boolean))].sort();

    const currStatus = callStatusFilter.value;
    callStatusFilter.innerHTML = '<option value="">All statuses</option>' +
      statuses.map(s => `<option value="${safe(s)}">${safe(s.charAt(0).toUpperCase() + s.slice(1))}</option>`).join('');
    callStatusFilter.value = statuses.includes(currStatus) ? currStatus : '';

    const currAgent = callAgentFilter.value;
    callAgentFilter.innerHTML = '<option value="">All agents</option>' +
      agents.map(a => `<option value="${safe(a)}">${safe(a)}</option>`).join('');
    callAgentFilter.value = agents.includes(currAgent) ? currAgent : '';
  }

  function updateDispositionSummaryCards(calls) {
    const total = calls.length;
    let countInterested = 0;
    let countFollowup = 0;
    let countNotInterested = 0;
    let countNoAnswer = 0;
    let countConverted = 0;

    calls.forEach(call => {
      const disp = detectDisposition(call);
      if (disp === 'interested') countInterested++;
      else if (disp === 'followup') countFollowup++;
      else if (disp === 'notinterested') countNotInterested++;
      else if (disp === 'noanswer') countNoAnswer++;
      else if (disp === 'converted') countConverted++;
    });

    document.getElementById('dispCountTotal').textContent = total;
    document.getElementById('dispSubTotal').textContent = total === 1 ? '1 logged call' : `${total} logged calls`;

    document.getElementById('dispCountInterested').textContent = countInterested;
    document.getElementById('dispPctInterested').textContent = total ? `${Math.round((countInterested / total) * 100)}% of total` : '0%';

    document.getElementById('dispCountFollowup').textContent = countFollowup;
    document.getElementById('dispPctFollowup').textContent = total ? `${Math.round((countFollowup / total) * 100)}% of total` : '0%';

    document.getElementById('dispCountNotInterested').textContent = countNotInterested;
    document.getElementById('dispPctNotInterested').textContent = total ? `${Math.round((countNotInterested / total) * 100)}% of total` : '0%';

    document.getElementById('dispCountNoAnswer').textContent = countNoAnswer;
    document.getElementById('dispPctNoAnswer').textContent = total ? `${Math.round((countNoAnswer / total) * 100)}% of total` : '0%';

    document.getElementById('dispCountConverted').textContent = countConverted;
    document.getElementById('dispPctConverted').textContent = total ? `${Math.round((countConverted / total) * 100)}% of total` : '0%';
  }

  function isWithinDateRange(dateStr, rangeKey) {
    if (!rangeKey || rangeKey === 'all') return true;
    if (!dateStr) return false;
    const callDate = new Date(dateStr);
    if (Number.isNaN(callDate.getTime())) return false;
    const now = new Date();

    if (rangeKey === 'today') {
      return callDate.toDateString() === now.toDateString();
    }
    if (rangeKey === 'yesterday') {
      const yesterday = new Date(now);
      yesterday.setDate(now.getDate() - 1);
      return callDate.toDateString() === yesterday.toDateString();
    }
    if (rangeKey === '7days') {
      const diffDays = (now - callDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 7 && diffDays >= 0;
    }
    if (rangeKey === '30days') {
      const diffDays = (now - callDate) / (1000 * 60 * 60 * 24);
      return diffDays <= 30 && diffDays >= 0;
    }
    return true;
  }

  function filterAndSortCalls() {
    const query = callSearch.value.trim().toLowerCase();
    const statusVal = callStatusFilter.value.toLowerCase();
    const agentVal = callAgentFilter.value.toLowerCase();
    const dispVal = callDispositionFilter.value.toLowerCase();
    const dateRangeVal = callDateRangeFilter.value;
    const sortVal = callSortFilter.value;

    let filtered = availableCalls.filter(call => {
      const name = call.student_name || 'Customer';
      const agent = call.agent_name || call.agent_id || '';
      const phone = call.phone || '';
      const id = call.snapserve_call_id || call.id || '';
      const summary = call.summary || '';
      const dispKey = detectDisposition(call);

      const haystack = [name, agent, phone, id, summary].join(' ').toLowerCase();

      const searchMatch = !query || haystack.includes(query);
      const statusMatch = !statusVal || String(call.status || '').toLowerCase() === statusVal;
      const agentMatch = !agentVal || agent.toLowerCase() === agentVal;
      const dispMatch = !dispVal || dispKey === dispVal || (dispVal === 'follow_up' && dispKey === 'followup');
      const dateMatch = isWithinDateRange(call.created_at || call.ended_at, dateRangeVal);

      return searchMatch && statusMatch && agentMatch && dispMatch && dateMatch;
    });

    // Sorting
    filtered.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      const durA = Number(a.duration) || 0;
      const durB = Number(b.duration) || 0;

      if (sortVal === 'oldest') return timeA - timeB;
      if (sortVal === 'duration_desc') return durB - durA;
      if (sortVal === 'duration_asc') return durA - durB;
      return timeB - timeA; // default newest to oldest
    });

    visibleCalls = filtered;
    renderTable(visibleCalls);
    updateDispositionSummaryCards(visibleCalls);

    const hasFilters = query || statusVal || agentVal || dispVal || (dateRangeVal && dateRangeVal !== 'all');
    clearCallFilters.hidden = !hasFilters;
    callResultCount.textContent = `${visibleCalls.length} of ${availableCalls.length} calls shown`;
  }

  function renderTable(calls) {
    if (!calls.length) {
      callsBody.innerHTML = '<tr><td colspan="14" class="empty">No call records found matching your filters.</td></tr>';
      return;
    }

    callsBody.innerHTML = calls.map((call, idx) => {
      const name = call.student_name || 'Customer';
      const initial = name.charAt(0).toUpperCase();
      const callId = call.snapserve_call_id || call.id || '—';
      const agentName = call.agent_name || call.agent_id || 'Voice Agent';
      const fromPhone = call.phone || '—';
      const toCourse = call.course || 'Admissions Hotline';
      const status = String(call.status || 'completed').toLowerCase();
      const dispKey = detectDisposition(call);
      const durationStr = formatDuration(call.duration);
      const costStr = formatCost(call);
      const dateStr = formatCallDate(call.created_at || call.ended_at);

      return `
        <tr>
          <td style="font-size:0.8rem;white-space:nowrap;">${safe(dateStr)}</td>
          <td><span class="call-id-chip">#${safe(callId.slice(0, 10))}</span></td>
          <td>
            <div class="user-cell-wrap">
              <span class="avatar-circle">${safe(initial)}</span>
              <strong>${safe(name)}</strong>
            </div>
          </td>
          <td>
            <span class="agent-cell-pill">
              🤖 ${safe(agentName)}
            </span>
          </td>
          <td style="font-family:monospace;font-size:0.85rem;">${safe(fromPhone)}</td>
          <td><span class="badge">${safe(toCourse)}</span></td>
          <td>
            <span class="call-type-badge call-type-outbound">Outbound ↗</span>
          </td>
          <td>
            <span class="status-badge ${status === 'completed' ? 'status-completed' : 'status-failed'}">
              ${status === 'completed' ? '✓ Completed' : '✕ ' + status}
            </span>
          </td>
          <td>
            ${renderDispositionPill(dispKey)}
          </td>
          <td style="font-family:monospace;font-weight:600;">${safe(durationStr)}</td>
          <td style="font-family:monospace;color:#059669;font-weight:600;">${safe(costStr)}</td>
          <td>
            ${call.summary ? `<button class="tbl-btn" type="button" data-action="summary" data-index="${idx}">📝 Summary</button>` : '—'}
          </td>
          <td>
            ${call.recording_url ? `<button class="tbl-btn btn-play" type="button" data-action="play" data-index="${idx}">▶ Listen</button>` : '—'}
          </td>
          <td>
            ${call.transcript ? `<button class="tbl-btn btn-transcript" type="button" data-action="transcript" data-index="${idx}">💬 Transcript</button>` : '—'}
          </td>
        </tr>
      `;
    }).join('');
  }

  // Action Click Listener for Table
  callsBody.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-action]');
    if (!btn) return;
    const action = btn.dataset.action;
    const index = Number(btn.dataset.index);
    const call = visibleCalls[index];
    if (!call) return;

    if (action === 'play') openRecordingPlayer(call);
    else if (action === 'transcript') openTranscriptViewer(call);
    else if (action === 'summary') openSummaryViewer(call);
  });

  // Open Waveform Player
  function openRecordingPlayer(call) {
    const name = call.student_name || 'Customer';
    document.getElementById('recordingModalTitle').textContent = `Recording — ${name}`;
    document.getElementById('recordingModalMeta').textContent = [
      call.agent_name ? 'Agent: ' + call.agent_name : '',
      call.phone ? 'Phone: ' + call.phone : '',
      call.duration ? formatDuration(call.duration) : ''
    ].filter(Boolean).join(' · ');

    recordingError.textContent = 'Loading audio waveform…';
    recordingPlayPause.disabled = true;
    recordingPlayPause.textContent = 'Play';
    recordingTime.textContent = '0:00 / 0:00';
    downloadAudioLink.href = `/calls/${encodeURIComponent(call.snapserve_call_id || call.id)}/recording`;

    recordingModal.hidden = false;
    document.body.style.overflow = 'hidden';

    destroyRecordingPlayer();

    if (!window.WaveSurfer) {
      recordingError.textContent = 'WaveSurfer library unavailable. Refresh page to try again.';
      return;
    }

    const recordingId = call.snapserve_call_id || call.id;
    recordingWaveSurfer = WaveSurfer.create({
      container: '#recordingWaveform',
      height: 72,
      waveColor: '#6366f1',
      progressColor: '#a855f7',
      cursorColor: '#f8fafc',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      url: `/calls/${encodeURIComponent(recordingId)}/recording`
    });

    recordingWaveSurfer.on('ready', () => {
      recordingPlayPause.disabled = false;
      recordingError.textContent = '';
      updateRecordingTime();
    });

    recordingWaveSurfer.on('timeupdate', updateRecordingTime);
    recordingWaveSurfer.on('play', () => { recordingPlayPause.textContent = 'Pause'; });
    recordingWaveSurfer.on('pause', () => { recordingPlayPause.textContent = 'Play'; });
    recordingWaveSurfer.on('finish', () => { recordingPlayPause.textContent = 'Replay'; });
    recordingWaveSurfer.on('error', () => {
      recordingPlayPause.disabled = true;
      recordingError.textContent = 'Audio file could not be loaded or played.';
    });
  }

  function formatAudioTime(seconds) {
    const safeSecs = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
    const m = Math.floor(safeSecs / 60);
    const s = String(safeSecs % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function updateRecordingTime() {
    if (!recordingWaveSurfer) return;
    const current = recordingWaveSurfer.getCurrentTime() || 0;
    const total = recordingWaveSurfer.getDuration() || 0;
    recordingTime.textContent = `${formatAudioTime(current)} / ${formatAudioTime(total)}`;
  }

  function destroyRecordingPlayer() {
    if (recordingWaveSurfer) {
      recordingWaveSurfer.destroy();
      recordingWaveSurfer = null;
    }
    const container = document.getElementById('recordingWaveform');
    if (container) container.replaceChildren();
  }

  recordingPlayPause.addEventListener('click', () => {
    if (recordingWaveSurfer) recordingWaveSurfer.playPause();
  });

  playbackSpeed.addEventListener('change', () => {
    if (recordingWaveSurfer) recordingWaveSurfer.setPlaybackRate(parseFloat(playbackSpeed.value));
  });

  closeRecordingModal.addEventListener('click', () => {
    destroyRecordingPlayer();
    recordingModal.hidden = true;
    document.body.style.overflow = '';
  });

  // Transcript Viewer
  function openTranscriptViewer(call) {
    const name = call.student_name || 'Customer';
    document.getElementById('transcriptModalTitle').textContent = `Transcript — ${name}`;
    document.getElementById('transcriptModalMeta').textContent = [
      call.agent_name ? 'Agent: ' + call.agent_name : '',
      call.phone ? 'Phone: ' + call.phone : '',
      call.duration ? formatDuration(call.duration) : ''
    ].filter(Boolean).join(' · ');

    const rawTranscript = typeof call.transcript === 'string'
      ? call.transcript
      : JSON.stringify(call.transcript, null, 2);

    activeTranscriptText = rawTranscript;

    // Parse transcript lines into formatted chat bubbles
    const lines = rawTranscript.split('\n').filter(l => l.trim());
    if (!lines.length) {
      transcriptBody.innerHTML = '<p class="empty">No transcript text available for this call.</p>';
    } else {
      transcriptBody.innerHTML = lines.map(line => {
        const colonIdx = line.indexOf(':');
        let speaker = 'System';
        let text = line;

        if (colonIdx > 0 && colonIdx < 30) {
          speaker = line.slice(0, colonIdx).trim();
          text = line.slice(colonIdx + 1).trim();
        }

        const isAgent = speaker.toLowerCase().includes('agent') || speaker.toLowerCase().includes('assistant') || speaker.toLowerCase().includes('liza');
        const bubbleClass = isAgent ? 'agent-bubble' : 'user-bubble';
        const avatarText = isAgent ? '🤖' : '👤';

        return `
          <div class="chat-bubble ${bubbleClass}">
            <div class="chat-avatar">${avatarText}</div>
            <div class="chat-content">
              <span class="chat-speaker">${safe(speaker)}</span>
              <div>${safe(text)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    transcriptModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  copyTranscriptBtn.addEventListener('click', () => {
    if (!activeTranscriptText) return;
    navigator.clipboard.writeText(activeTranscriptText).then(() => {
      copyTranscriptBtn.textContent = 'Copied! ✓';
      setTimeout(() => { copyTranscriptBtn.textContent = 'Copy transcript'; }, 2000);
    });
  });

  closeTranscriptModal.addEventListener('click', () => {
    transcriptModal.hidden = true;
    document.body.style.overflow = '';
  });

  // Summary Viewer
  function openSummaryViewer(call) {
    const name = call.student_name || 'Customer';
    document.getElementById('summaryModalTitle').textContent = `AI Summary — ${name}`;
    document.getElementById('summaryModalMeta').textContent = [
      call.agent_name ? 'Agent: ' + call.agent_name : '',
      call.course ? 'Campaign: ' + call.course : '',
      call.phone ? 'Phone: ' + call.phone : ''
    ].filter(Boolean).join(' · ');

    const dispKey = detectDisposition(call);
    document.getElementById('summaryModalDispBadge').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <strong style="font-size:0.9rem;color:#475569;">Call Outcome:</strong>
        ${renderDispositionPill(dispKey)}
      </div>
    `;

    document.getElementById('summaryModalText').textContent = typeof call.summary === 'string'
      ? call.summary
      : JSON.stringify(call.summary, null, 2);

    summaryModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  closeSummaryModal.addEventListener('click', () => {
    summaryModal.hidden = true;
    document.body.style.overflow = '';
  });

  // Export to CSV
  exportCallsBtn.addEventListener('click', () => {
    if (!visibleCalls.length) {
      alert('No call records to export.');
      return;
    }

    const headers = ['Date', 'Call ID', 'Name', 'Agent', 'From', 'To', 'Call Type', 'Status', 'Disposition', 'Duration (s)', 'Cost'];
    const rows = visibleCalls.map(c => [
      formatCallDate(c.created_at || c.ended_at),
      c.snapserve_call_id || c.id || '',
      c.student_name || 'Customer',
      c.agent_name || c.agent_id || '',
      c.phone || '',
      c.course || '',
      'Outbound',
      c.status || 'completed',
      detectDisposition(c),
      c.duration || 0,
      formatCost(c)
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `call_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  });

  // Filter Listeners
  callSearch.addEventListener('input', filterAndSortCalls);
  callStatusFilter.addEventListener('change', filterAndSortCalls);
  callAgentFilter.addEventListener('change', filterAndSortCalls);
  callDispositionFilter.addEventListener('change', filterAndSortCalls);
  callDateRangeFilter.addEventListener('change', filterAndSortCalls);
  callSortFilter.addEventListener('change', filterAndSortCalls);

  clearCallFilters.addEventListener('click', () => {
    callSearch.value = '';
    callStatusFilter.value = '';
    callAgentFilter.value = '';
    callDispositionFilter.value = '';
    callDateRangeFilter.value = 'all';
    callSortFilter.value = 'newest';
    filterAndSortCalls();
  });

  refreshCallsBtn.addEventListener('click', loadData);

  logoutBtn.addEventListener('click', async () => {
    await fetch('/admin/logout', { method: 'POST' }).catch(() => {});
    window.location.replace('/admin/login');
  });

  // Initial Data Load
  async function loadData() {
    callsBody.innerHTML = '<tr><td colspan="14" class="empty">Loading call records…</td></tr>';
    try {
      const response = await fetch('/calls');
      if (response.status === 401) {
        window.location.replace('/admin/login');
        return;
      }
      if (!response.ok) throw new Error('Could not load call records.');
      const data = await response.json();
      availableCalls = Array.isArray(data) ? data : [];
      populateFilterOptions();
      filterAndSortCalls();
    } catch (err) {
      callsBody.innerHTML = `<tr><td colspan="14" class="empty">${safe(err.message)}</td></tr>`;
    }
  }

  loadData();
});
