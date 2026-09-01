    const agentsBody = document.getElementById('agentsBody');
    const refreshAgentsBtn = document.getElementById('refreshAgentsBtn');
    const leadsBody = document.getElementById('leadsBody');
    const refreshBtn = document.getElementById('refreshBtn');
    const callsBody = document.getElementById('callsBody');
    const refreshCallsBtn = document.getElementById('refreshCallsBtn');
    const callSearch = document.getElementById('callSearch');
    const callAgentFilter = document.getElementById('callAgentFilter');
    const callCourseFilter = document.getElementById('callCourseFilter');
    const callStatusFilter = document.getElementById('callStatusFilter');
    const callResultCount = document.getElementById('callResultCount');

    const agentSearch = document.getElementById('agentSearch');
    const agentStatusFilter = document.getElementById('agentStatusFilter');
    const agentLanguageFilter = document.getElementById('agentLanguageFilter');
    const agentTypeFilter = document.getElementById('agentTypeFilter');
    const agentResultCount = document.getElementById('agentResultCount');
    const leadSearch = document.getElementById('leadSearch');
    const leadCourseFilter = document.getElementById('leadCourseFilter');
    const leadAssignmentFilter = document.getElementById('leadAssignmentFilter');
    const leadResultCount = document.getElementById('leadResultCount');
    const autoCallToggle = document.getElementById('autoCallToggle');
    const autoCallLabel = document.getElementById('autoCallLabel');

    const ACADEMY_COURSES = [
      'UI/UX Design Mastery',
      'Full-Stack Web Development',
      'Filmmaking & Video Editing',
      'SnapServe Voice AI Hackathon'
    ];

    const COURSE_AGENT_KEYWORDS = {
      'UI/UX Design Mastery': ['ui', 'ux', 'design'],
      'Full-Stack Web Development': ['full stack', 'full-stack', 'web development', 'developer'],
      'Filmmaking & Video Editing': ['film', 'video', 'editing', 'editor'],
      'SnapServe Voice AI Hackathon': ['snapserve', 'voice', 'hackathon', 'event', 'registration']
    };

    let availableAgents = [];
    let availableLeads = [];
    let availableCalls = [];
    let visibleCalls = [];
    let recordingWaveSurfer = null;

    const workspaceSelect = document.getElementById('workspaceSelect');
    const workspaceTitle = document.getElementById('workspaceTitle');
    const workspaceDescription = document.getElementById('workspaceDescription');
    const workspacePanels = [...document.querySelectorAll('[data-workspace]')];
    const WORKSPACES = {
      analytics: {
        title: 'Analytics',
        description: 'A clear view of call performance and agent activity.'
      },
      agents: {
        title: 'Voice agents',
        description: 'Review availability, languages, types, and models.'
      },
      leads: {
        title: 'Lead management',
        description: 'Assign the right agent and start a conversation in a few clicks.'
      },
      calls: {
        title: 'Call records',
        description: 'Listen to recordings and review transcripts, summaries, and outcomes.'
      }
    };

    function setWorkspace(workspace, updateHistory = true) {
      const nextWorkspace = WORKSPACES[workspace] ? workspace : 'analytics';
      workspacePanels.forEach(panel => {
        panel.hidden = panel.dataset.workspace !== nextWorkspace;
      });
      workspaceSelect.value = nextWorkspace;
      workspaceTitle.textContent = WORKSPACES[nextWorkspace].title;
      workspaceDescription.textContent = WORKSPACES[nextWorkspace].description;
      localStorage.setItem('snapserve_admin_workspace', nextWorkspace);
      if (updateHistory) history.replaceState(null, '', '#' + nextWorkspace);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    const safe = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);

    const uniqueValues = (items, key) => [...new Set(items.map(item => item[key]).filter(Boolean))]
      .sort((a, b) => String(a).localeCompare(String(b)));

    function populateFilter(select, values, firstLabel) {
      const current = select.value;
      select.innerHTML = '<option value="">' + firstLabel + '</option>' +
        values.map(value => '<option value="' + safe(value) + '">' + safe(value) + '</option>').join('');
      select.value = values.includes(current) ? current : '';
    }

    function courseForAgent(agent) {
      const name = String(agent?.name || '').toLowerCase();
      return ACADEMY_COURSES.find(course =>
        COURSE_AGENT_KEYWORDS[course].some(keyword => name.includes(keyword))
      ) || '';
    }

    function agentsForCourse() {
      return filteredAgents();
    }

    function filteredAgents() {
      const query = agentSearch.value.trim().toLowerCase();
      return availableAgents.filter(agent => {
        const haystack = [agent.id, agent.name, agent.llmModel].join(' ').toLowerCase();
        return (!query || haystack.includes(query)) &&
          (!agentStatusFilter.value || agent.status === agentStatusFilter.value) &&
          (!agentLanguageFilter.value || agent.language === agentLanguageFilter.value) &&
          (!agentTypeFilter.value || agent.agentType === agentTypeFilter.value);
      });
    }

    function renderAgents() {
      const agents = filteredAgents();
      agentResultCount.textContent = agents.length + ' of ' + availableAgents.length + ' agents shown';
      if (!agents.length) {
        agentsBody.innerHTML = '<tr><td colspan="6" class="empty">No agents match these filters.</td></tr>';
      } else {
        agentsBody.innerHTML = agents.map((agent) => `
          <tr>
            <td>#${safe(agent.id)}</td>
            <td>${safe(agent.name || '—')}</td>
            <td>${safe(agent.agentType || '—')}</td>
            <td><span class="badge">${safe(agent.status || 'unknown')}</span></td>
            <td>${safe(agent.language || '—')}</td>
            <td>${safe(agent.llmModel || '—')}</td>
          </tr>
        `).join('');
      }
      renderLeads();
    }

    async function loadAgents() {
      agentsBody.innerHTML = '<tr><td colspan="6" class="empty">Loading agents…</td></tr>';

      try {
        const response = await fetch('/agents');
        if (!response.ok) {
          throw new Error('Unable to load agents');
        }

        const agents = await response.json();
        availableAgents = Array.isArray(agents) ? agents : [];

        populateFilter(agentStatusFilter, uniqueValues(availableAgents, 'status'), 'All statuses');
        populateFilter(agentLanguageFilter, uniqueValues(availableAgents, 'language'), 'All languages');
        populateFilter(agentTypeFilter, uniqueValues(availableAgents, 'agentType'), 'All types');
        renderAgents();
        loadLeads();
      } catch (error) {
        agentsBody.innerHTML = `<tr><td colspan="6" class="empty">${error.message}</td></tr>`;
      }
    }

    function renderLeads() {
      const query = leadSearch.value.trim().toLowerCase();
      const leads = availableLeads.filter(lead => {
        const haystack = [lead.name, lead.email, lead.phone].join(' ').toLowerCase();
        const assignmentMatches = !leadAssignmentFilter.value ||
          (leadAssignmentFilter.value === 'assigned' ? Boolean(lead.agent) : !lead.agent);
        return (!query || haystack.includes(query)) &&
          (!leadCourseFilter.value || lead.course === leadCourseFilter.value) &&
          assignmentMatches;
      });

      leadResultCount.textContent = leads.length + ' of ' + availableLeads.length + ' leads shown';
      if (!leads.length) {
        leadsBody.innerHTML = '<tr><td colspan="10" class="empty">No leads match these filters.</td></tr>';
        return;
      }

      leadsBody.innerHTML = leads.map((lead) => {
        const eligibleForCall = lead.course !== 'SnapServe Voice AI Hackathon' ||
          String(lead.interest || '').trim().toLowerCase() === 'yes, very interested';
        const agents = agentsForCourse(lead.course).slice().sort((a, b) => {
          const lizaA = String(a.name || '').toLowerCase().includes('liza') ? 0 : 1;
          const lizaB = String(b.name || '').toLowerCase().includes('liza') ? 0 : 1;
          const activeA = String(a.status).toLowerCase() === 'active' ? 0 : 1;
          const activeB = String(b.status).toLowerCase() === 'active' ? 0 : 1;
          return lizaA - lizaB || activeA - activeB || String(a.name || a.id).localeCompare(String(b.name || b.id));
        });
        const selectedAgent = availableAgents.find(a => String(a.id) === String(lead.agent));
        const options = agents.map(agent => {
          const selected = String(lead.agent) === String(agent.id) ? 'selected' : '';
          const label = [agent.name || 'Agent ' + agent.id, agent.language, agent.agentType, agent.status]
            .filter(Boolean).join(' · ');
          return '<option value="' + safe(agent.id) + '" ' + selected + '>' + safe(label) + '</option>';
        }).join('');
        const keepSelected = selectedAgent && !agents.some(a => String(a.id) === String(selectedAgent.id))
          ? '<option value="' + safe(selectedAgent.id) + '" selected>' + safe((selectedAgent.name || 'Agent ' + selectedAgent.id) + ' · currently assigned') + '</option>'
          : '';

        return `
          <tr>
            <td>#${safe(lead.id)}</td>
            <td>${safe(lead.name || '—')}</td>
            <td>${safe(lead.email || '—')}</td>
            <td>${safe(lead.phone || '—')}</td>
            <td>${lead.course ? '<span class="badge">' + safe(lead.course) + '</span>' : '—'}</td>
            <td>${safe(lead.interest || '—')}</td>
            <td>${safe(lead.attendance || '—')}</td>
            <td>
              <select id="agent-select-${safe(lead.id)}" data-lead-id="${safe(lead.id)}" class="agent-select" aria-label="Choose agent for ${safe(lead.name || 'lead')}" ${eligibleForCall ? '' : 'disabled'}>
                <option value="">Choose an agent</option>
                ${keepSelected}${options}
              </select>
              <span class="agent-hint">${eligibleForCall ? (lead.agent ? 'Liza selected by default' : 'Waiting for Liza agent') : 'Not interested — calling disabled'}</span>
            </td>
            <td>
              <button class="call-btn" id="call-btn-${safe(lead.id)}" type="button" data-lead-id="${safe(lead.id)}" data-phone="${safe(lead.phone)}" ${eligibleForCall ? '' : 'disabled'}>
                ${eligibleForCall ? 'Call' : 'Not interested'}
              </button>
            </td>
            <td>${lead.created_at ? new Date(lead.created_at).toLocaleString() : '—'}</td>
          </tr>
        `;
      }).join('');
    }

    async function loadLeads() {
      leadsBody.innerHTML = '<tr><td colspan="10" class="empty">Loading leads…</td></tr>';
      try {
        const response = await fetch('/leads');
        if (!response.ok) throw new Error('Unable to load leads');
        const leads = await response.json();
        availableLeads = Array.isArray(leads) ? leads : [];
        populateFilter(leadCourseFilter, uniqueValues(availableLeads, 'course'), 'All campaigns');
        renderLeads();
        if (availableCalls.length) renderCalls();
      } catch (error) {
        leadsBody.innerHTML = '<tr><td colspan="10" class="empty">' + safe(error.message) + '</td></tr>';
      }
    }

    async function sessionFetch(url, options = {}) {
      const response = await fetch(url, options);
      if (response.status === 401) {
        window.location.replace('/admin/login');
        throw new Error('Admin session expired.');
      }
      return response;
    }

    async function saveAgentAssignment(select) {
      const leadId = select.dataset.leadId;
      const agentId = select.value;
      if (!agentId) return;
      const previousLead = availableLeads.find(lead => String(lead.id) === String(leadId));
      const previousAgent = previousLead?.agent || '';

      select.disabled = true;
      try {
        const response = await sessionFetch('/leads/' + encodeURIComponent(leadId) + '/agent', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not save selected agent');
        if (previousLead) previousLead.agent = agentId;
        const hint = select.parentElement.querySelector('.agent-hint');
        if (hint) hint.textContent = 'Saved agent selected';
      } catch (error) {
        select.value = previousAgent;
        if (!String(error.message).includes('session expired')) alert(error.message);
      } finally {
        select.disabled = false;
      }
    }

    async function updateAutoCall(enabled) {
      autoCallToggle.disabled = true;
      try {
        const response = await sessionFetch('/settings/auto-call', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled })
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || 'Could not save auto call setting');
        autoCallToggle.checked = data.auto_call_enabled;
        autoCallLabel.textContent = data.auto_call_enabled ? 'Auto call on' : 'Auto call off';
      } catch (error) {
        autoCallToggle.checked = !enabled;
        if (!String(error.message).includes('session expired')) alert(error.message);
      } finally {
        autoCallToggle.disabled = false;
      }
    }

    async function loadAutoCallSetting() {
      try {
        const response = await sessionFetch('/settings');
        if (!response.ok) throw new Error('Could not load auto call setting');
        const data = await response.json();
        autoCallToggle.checked = data.auto_call_enabled === true;
        autoCallLabel.textContent = autoCallToggle.checked ? 'Auto call on' : 'Auto call off';
      } catch (error) {
        if (!String(error.message).includes('session expired')) autoCallLabel.textContent = 'Auto call unavailable';
      }
    }

    async function logoutAdmin() {
      try {
        await fetch('/admin/logout', { method: 'POST' });
      } finally {
        window.location.replace('/admin/login');
      }
    }

    async function triggerCallForLead(leadId, phone) {
      const select = document.getElementById(`agent-select-${leadId}`);
      const callBtn = document.getElementById(`call-btn-${leadId}`);
      const agentId = select ? select.value : '';

      if (!agentId) {
        alert('Please select an agent from the dropdown first.');
        return;
      }

      callBtn.disabled = true;
      callBtn.textContent = 'Calling…';

      try {
        const response = await fetch('/call-lead', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ leadId, agentId, phone })
        });

        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Failed to initiate call');
        }

        const call = data.call || {};
        const status = String(call.status || '').toLowerCase();
        const isQueued = call.queued || status === 'pending' || status === 'queued';

        callBtn.textContent = isQueued ? 'Call queued' : 'Call started';
        if (isQueued) {
          const details = [
            call.message || 'Waiting for the telephony provider.',
            call.id != null ? 'Call ID: ' + call.id : '',
            call.fromNumber ? 'From: ' + call.fromNumber : 'No caller number returned yet.'
          ].filter(Boolean).join('\n');
          alert(details);
        }

        setTimeout(() => {
          callBtn.disabled = false;
          callBtn.textContent = 'Call';
          loadCalls();
        }, 5000);
      } catch (err) {
        alert('Error initiating call: ' + err.message);
        callBtn.disabled = false;
        callBtn.textContent = '📞 Call Student';
      }
    }

    const normalizedPhone = (phone) => String(phone || '').replace(/\D/g, '').slice(-10);

    function enrichCalls(calls) {
      return calls.map(call => {
        const lead = availableLeads.find(item =>
          normalizedPhone(item.phone) && normalizedPhone(item.phone) === normalizedPhone(call.phone)
        );
        const rawStatus = String(call.status || '').toLowerCase();
        const hasCompletedData = Number(call.duration || 0) > 0 &&
          Boolean(call.summary || call.transcript || call.recording_url);
        return {
          ...call,
          student_name: call.student_name || call.student || lead?.name || '',
          course: call.course || lead?.course || '',
          filter_agent: call.agent_name || String(call.agent_id || ''),
          status: (!rawStatus || rawStatus === 'unknown') && hasCompletedData
            ? 'completed'
            : (rawStatus || 'unknown'),
          call_datetime: call.created_at || call.ended_at || ''
        };
      });
    }

    function deduplicateCalls(calls) {
      const byKey = new Map();
      calls.forEach(call => {
        const key = call.snapserve_call_id
          ? 'id:' + call.snapserve_call_id
          : [
              normalizedPhone(call.phone),
              call.filter_agent,
              Number(call.duration) || 0,
              String(call.summary || '').slice(0, 80)
            ].join('|');
        const score = (call.snapserve_call_id ? 8 : 0) +
          (call.call_datetime ? 4 : 0) +
          (call.status === 'completed' ? 2 : 0) +
          (call.transcript ? 1 : 0);
        const existing = byKey.get(key);
        if (!existing || score > existing.score) byKey.set(key, { call, score });
      });
      return [...byKey.values()].map(entry => entry.call);
    }

    function formatCallDate(value) {
      if (!value) return 'Not available';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return 'Not available';
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true
      });
    }

    function updateCallMetrics(calls) {
      const totalCalls = calls.length;
      const totalDuration = calls.reduce((sum, call) => sum + (Number(call.duration) || 0), 0);
      const uniqueAgents = new Set(calls.map(call => call.filter_agent).filter(Boolean));
      const successfulCalls = calls.filter(call => {
        const evaluation = String(call.success_evaluation || '').toLowerCase();
        return ['success', 'true', 'passed', 'completed', 'interested', 'yes'].some(word => evaluation.includes(word)) ||
          String(call.status).toLowerCase() === 'completed';
      }).length;

      document.getElementById('totalCallsVal').textContent = totalCalls;
      document.getElementById('avgDurationVal').textContent = (totalCalls ? Math.round(totalDuration / totalCalls) : 0) + 's';
      document.getElementById('successRateVal').textContent = (totalCalls ? Math.round((successfulCalls / totalCalls) * 100) : 0) + '%';
      document.getElementById('successRateDesc').textContent = totalCalls
        ? successfulCalls + ' out of ' + totalCalls + ' filtered calls positive'
        : 'Based on filtered call results';
      document.getElementById('activeAgentsVal').textContent = uniqueAgents.size;
    }

    function renderCalls() {
      const enriched = deduplicateCalls(enrichCalls(availableCalls));
      const relatedAgentNames = uniqueValues(enriched, 'filter_agent');
      populateFilter(callAgentFilter, relatedAgentNames, 'All related agents');
      populateFilter(callCourseFilter, ACADEMY_COURSES, 'All three courses');
      populateFilter(callStatusFilter, uniqueValues(enriched, 'status'), 'All statuses');

      const query = callSearch.value.trim().toLowerCase();
      const calls = enriched.filter(call => {
        const haystack = [
          call.id, call.student_name, call.phone, call.summary,
          call.success_evaluation, call.filter_agent, call.course
        ].join(' ').toLowerCase();
        return (!query || haystack.includes(query)) &&
          (!callAgentFilter.value || call.filter_agent === callAgentFilter.value) &&
          (!callCourseFilter.value || call.course === callCourseFilter.value) &&
          (!callStatusFilter.value || call.status === callStatusFilter.value);
      });

      visibleCalls = calls;
      callResultCount.textContent = calls.length + ' calls shown';
      updateCallMetrics(calls);

      if (!calls.length) {
        callsBody.innerHTML = '<tr><td colspan="12" class="empty">No calls match these filters.</td></tr>';
        return;
      }

      callsBody.innerHTML = calls.map((call, callIndex) => `
        <tr>
          <td><strong>${safe(call.snapserve_call_id || call.id || '—')}</strong></td>
          <td>${safe(call.student_name || 'Not available')}</td>
          <td>${call.filter_agent ? '<span class="badge">' + safe(call.filter_agent) + '</span>' : '—'}</td>
          <td>${call.course ? '<span class="badge">' + safe(call.course) + '</span>' : 'Not available'}</td>
          <td>${safe(call.phone || '—')}</td>
          <td>${safe((Number(call.duration) || 0) + 's')}</td>
          <td><span class="badge" style="background:${String(call.status).toLowerCase() === 'completed' ? '#e2f9e1' : '#ffe7e7'}; color:${String(call.status).toLowerCase() === 'completed' ? '#1f7a1e' : '#c52828'};">${safe(call.status || 'unknown')}</span></td>
          <td>${call.summary ? '<button class="mini-btn summary-btn" type="button" data-summary-index="' + callIndex + '">View summary</button>' : '—'}</td>
          <td style="max-width:200px;font-size:0.9rem;">${safe(call.success_evaluation || '—')}</td>
          <td>${call.recording_url ? '<button class="mini-btn recording-btn" type="button" data-recording-index="' + callIndex + '">Play</button>' : '—'}</td>
          <td>${call.transcript ? '<button class="mini-btn transcript-btn" type="button" data-transcript-index="' + callIndex + '">View transcript</button>' : '—'}</td>
          <td style="font-size:0.85rem;white-space:nowrap;">${safe(formatCallDate(call.call_datetime))}</td>
        </tr>
      `).join('');
    }

    function openSummary(summaryIndex) {
      const call = visibleCalls[Number(summaryIndex)];
      if (!call) {
        alert('This call summary is no longer available. Please refresh the call logs.');
        return;
      }

      const title = call.student_name && call.student_name !== 'Not available'
        ? call.student_name + ' — Call summary'
        : 'Call summary';
      const meta = [
        call.course,
        call.filter_agent ? 'Agent: ' + call.filter_agent : '',
        call.phone,
        call.status ? 'Status: ' + call.status : ''
      ].filter(Boolean);

      document.getElementById('summaryModalTitle').textContent = title;
      document.getElementById('summaryModalMeta').textContent = meta.join(' · ');
      document.getElementById('summaryModalCopy').textContent =
        typeof call.summary === 'string'
          ? call.summary
          : JSON.stringify(call.summary, null, 2);
      showTextModalContent();
      document.getElementById('summaryModal').classList.add('open');
      document.body.style.overflow = 'hidden';
      document.getElementById('closeSummaryModal').focus();
    }

    function openTranscript(transcriptIndex) {
      const call = visibleCalls[Number(transcriptIndex)];
      if (!call) {
        alert('This transcript is no longer available. Please refresh the call logs.');
        return;
      }
      document.getElementById('summaryModalTitle').textContent =
        (call.student_name || 'Student') + ' — Call transcript';
      document.getElementById('summaryModalMeta').textContent = [
        call.snapserve_call_id ? 'Call ID: ' + call.snapserve_call_id : '',
        call.course,
        call.filter_agent ? 'Agent: ' + call.filter_agent : '',
        call.duration ? call.duration + ' seconds' : ''
      ].filter(Boolean).join(' · ');
      document.getElementById('summaryModalCopy').textContent =
        typeof call.transcript === 'string'
          ? call.transcript
          : JSON.stringify(call.transcript, null, 2);
      showTextModalContent();
      document.getElementById('summaryModal').classList.add('open');
      document.body.style.overflow = 'hidden';
      document.getElementById('closeSummaryModal').focus();
    }

    function showTextModalContent() {
      destroyRecordingPlayer();
      document.getElementById('recordingPlayerWrap').classList.remove('open');
      document.getElementById('recordingError').textContent = '';
      document.getElementById('summaryModalCopy').style.display = '';
    }

    function openRecording(recordingIndex) {
      const call = visibleCalls[Number(recordingIndex)];
      if (!call?.recording_url) {
        alert('This call recording is not available. Please refresh the call logs.');
        return;
      }

      const error = document.getElementById('recordingError');
      const playPauseButton = document.getElementById('recordingPlayPause');
      document.getElementById('summaryModalTitle').textContent =
        (call.student_name || 'Student') + ' — Call recording';
      document.getElementById('summaryModalMeta').textContent = [
        call.course,
        call.filter_agent ? 'Agent: ' + call.filter_agent : '',
        call.phone,
        call.duration ? call.duration + ' seconds' : ''
      ].filter(Boolean).join(' · ');
      document.getElementById('summaryModalCopy').style.display = 'none';
      document.getElementById('recordingPlayerWrap').classList.add('open');
      error.textContent = 'Loading recording…';
      playPauseButton.disabled = true;
      document.getElementById('summaryModal').classList.add('open');
      document.body.style.overflow = 'hidden';
      destroyRecordingPlayer();

      if (!window.WaveSurfer) {
        error.textContent = 'The recording player could not be loaded. Refresh the page and try again.';
        return;
      }

      const recordingId = call.snapserve_call_id || call.id;
      recordingWaveSurfer = WaveSurfer.create({
        container: '#recordingWaveform',
        height: 72,
        waveColor: '#d8ccff',
        progressColor: '#6f4ff2',
        cursorColor: '#15141c',
        barWidth: 2,
        barGap: 2,
        barRadius: 2,
        normalize: true,
        url: '/calls/' + encodeURIComponent(recordingId) + '/recording'
      });

      recordingWaveSurfer.on('ready', () => {
        playPauseButton.disabled = false;
        error.textContent = '';
        updateRecordingTime();
      });
      recordingWaveSurfer.on('timeupdate', updateRecordingTime);
      recordingWaveSurfer.on('play', () => { playPauseButton.textContent = 'Pause'; });
      recordingWaveSurfer.on('pause', () => { playPauseButton.textContent = 'Play'; });
      recordingWaveSurfer.on('finish', () => { playPauseButton.textContent = 'Replay'; });
      recordingWaveSurfer.on('error', () => {
        playPauseButton.disabled = true;
        error.textContent = 'This recording could not be played. Refresh the calls and try again.';
      });
    }

    function formatAudioTime(seconds) {
      const safeSeconds = Number.isFinite(seconds) ? Math.max(0, Math.floor(seconds)) : 0;
      return Math.floor(safeSeconds / 60) + ':' + String(safeSeconds % 60).padStart(2, '0');
    }

    function updateRecordingTime() {
      const current = recordingWaveSurfer?.getCurrentTime() || 0;
      const duration = recordingWaveSurfer?.getDuration() || 0;
      document.getElementById('recordingTime').textContent =
        formatAudioTime(current) + ' / ' + formatAudioTime(duration);
    }

    function destroyRecordingPlayer() {
      if (recordingWaveSurfer) {
        recordingWaveSurfer.destroy();
        recordingWaveSurfer = null;
      }
      document.getElementById('recordingWaveform').replaceChildren();
      document.getElementById('recordingPlayPause').textContent = 'Play';
      document.getElementById('recordingPlayPause').disabled = true;
      document.getElementById('recordingTime').textContent = '0:00 / 0:00';
    }

    function closeSummary() {
      destroyRecordingPlayer();
      document.getElementById('recordingPlayerWrap').classList.remove('open');
      document.getElementById('recordingError').textContent = '';
      document.getElementById('summaryModalCopy').style.display = '';
      document.getElementById('summaryModal').classList.remove('open');
      document.body.style.overflow = '';
    }

    async function loadCalls() {
      callsBody.innerHTML = '<tr><td colspan="12" class="empty">Loading call records…</td></tr>';
      try {
        const response = await fetch('/calls');
        if (!response.ok) throw new Error('Unable to load call logs');
        const calls = await response.json();
        availableCalls = Array.isArray(calls) ? calls : [];
        renderCalls();
      } catch (error) {
        callsBody.innerHTML = '<tr><td colspan="12" class="empty">' + safe(error.message) + '</td></tr>';
      }
    }

    [agentSearch, agentStatusFilter, agentLanguageFilter, agentTypeFilter].forEach(control => {
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', renderAgents);
    });
    [leadSearch, leadCourseFilter, leadAssignmentFilter].forEach(control => {
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', renderLeads);
    });
    [callSearch, callAgentFilter, callCourseFilter, callStatusFilter].forEach(control => {
      control.addEventListener(control.tagName === 'INPUT' ? 'input' : 'change', renderCalls);
    });
    document.getElementById('clearAgentFilters').addEventListener('click', () => {
      agentSearch.value = '';
      agentStatusFilter.value = '';
      agentLanguageFilter.value = '';
      agentTypeFilter.value = '';
      renderAgents();
    });
    document.getElementById('clearLeadFilters').addEventListener('click', () => {
      leadSearch.value = '';
      leadCourseFilter.value = '';
      leadAssignmentFilter.value = '';
      renderLeads();
    });
    document.getElementById('clearCallFilters').addEventListener('click', () => {
      callSearch.value = '';
      callAgentFilter.value = '';
      callCourseFilter.value = '';
      callStatusFilter.value = '';
      renderCalls();
    });
    leadsBody.addEventListener('click', (event) => {
      const button = event.target.closest('.call-btn');
      if (button) triggerCallForLead(button.dataset.leadId, button.dataset.phone);
    });
    leadsBody.addEventListener('change', (event) => {
      if (event.target.matches('.agent-select')) saveAgentAssignment(event.target);
    });
    autoCallToggle.addEventListener('change', () => updateAutoCall(autoCallToggle.checked));
    document.getElementById('logoutBtn').addEventListener('click', logoutAdmin);
    callsBody.addEventListener('click', (event) => {
      const summaryButton = event.target.closest('.summary-btn');
      const transcriptButton = event.target.closest('.transcript-btn');
      const recordingButton = event.target.closest('.recording-btn');
      if (summaryButton) openSummary(summaryButton.dataset.summaryIndex);
      if (transcriptButton) openTranscript(transcriptButton.dataset.transcriptIndex);
      if (recordingButton) openRecording(recordingButton.dataset.recordingIndex);
    });
    document.getElementById('recordingPlayPause').addEventListener('click', () => {
      if (recordingWaveSurfer) recordingWaveSurfer.playPause();
    });
    workspaceSelect.addEventListener('change', () => setWorkspace(workspaceSelect.value));
    document.querySelectorAll('[data-workspace-target]').forEach(button => {
      button.addEventListener('click', () => setWorkspace(button.dataset.workspaceTarget));
    });
    window.addEventListener('hashchange', () => setWorkspace(location.hash.slice(1), false));
    document.getElementById('closeSummaryModal').addEventListener('click', closeSummary);
    document.getElementById('summaryModal').addEventListener('click', (event) => {
      if (event.target.id === 'summaryModal') closeSummary();
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeSummary();
    });

    refreshAgentsBtn.addEventListener('click', loadAgents);
    refreshBtn.addEventListener('click', loadLeads);
    refreshCallsBtn.addEventListener('click', loadCalls);

    const initialWorkspace = location.hash.slice(1) ||
      localStorage.getItem('snapserve_admin_workspace') ||
      'analytics';
    setWorkspace(initialWorkspace, false);
    loadAutoCallSetting();
    loadAgents();
    loadCalls();
  
