/**
 * SnapServe Call Records & Intelligence Engine
 * Architected with SOLID Principles and Apple Human Interface Design guidelines.
 */

'use strict';

// ============================================================================
// 1. DOM Utility & Sanitization
// ============================================================================
const DOM = {
  safe(val) {
    return String(val ?? '').replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
  },
  byId(id) {
    return document.getElementById(id);
  }
};

// ============================================================================
// 2. Disposition Service (Single Responsibility: Disposition Domain Logic)
// ============================================================================
class DispositionService {
  static CONFIG = {
    interested: {
      key: 'interested',
      label: 'Interested',
      class: 'disp-interested',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>`
    },
    followup: {
      key: 'followup',
      label: 'Follow Up',
      class: 'disp-followup',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    notinterested: {
      key: 'notinterested',
      label: 'Not Interested',
      class: 'disp-notinterested',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    },
    noanswer: {
      key: 'noanswer',
      label: 'No Answer',
      class: 'disp-noanswer',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 3.41l2.48-2.48a1 1 0 0 1 1.05-.24 11.2 11.2 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1 11.2 11.2 0 0 0 .56 3.5 1 1 0 0 1-.24 1.05z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`
    },
    converted: {
      key: 'converted',
      label: 'Converted',
      class: 'disp-converted',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
    },
    failed: {
      key: 'failed',
      label: 'Failed',
      class: 'disp-failed',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`
    }
  };

  static detect(call) {
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

  static renderPill(dispositionKey) {
    const config = this.CONFIG[dispositionKey] || this.CONFIG.interested;
    return `
      <span class="disposition-pill ${config.class}">
        ${config.icon}
        ${config.label}
      </span>
    `;
  }
}

// ============================================================================
// 3. API Service (Single Responsibility: Network Layer with Timeout Guard)
// ============================================================================
class CallApiService {
  static async fetchCalls(timeoutMs = 7000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('/calls', {
        headers: { 'Accept': 'application/json' },
        signal: controller.signal
      });

      if (response.status === 401) {
        window.location.replace('/admin/login');
        throw new Error('Admin session expired. Redirecting to login...');
      }

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      const data = await response.json();
      return Array.isArray(data) ? data : [];
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error('Request timed out. Please check your network connection and retry.');
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}

// ============================================================================
// 4. Filter & Sort Engine (Pure Business Logic)
// ============================================================================
class CallFilterEngine {
  static isWithinDateRange(dateStr, rangeKey) {
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

  static apply(calls, criteria) {
    const { query, status, agent, disposition, dateRange, sort } = criteria;

    let result = calls.filter(call => {
      const name = call.student_name || 'Customer';
      const agentName = call.agent_name || call.agent_id || '';
      const phone = call.phone || '';
      const id = call.snapserve_call_id || call.id || '';
      const summary = call.summary || '';
      const dispKey = DispositionService.detect(call);

      const haystack = [name, agentName, phone, id, summary].join(' ').toLowerCase();

      const searchMatch = !query || haystack.includes(query.toLowerCase());
      const statusMatch = !status || String(call.status || '').toLowerCase() === status.toLowerCase();
      const agentMatch = !agent || agentName.toLowerCase() === agent.toLowerCase();
      const dispMatch = !disposition || dispKey === disposition.toLowerCase() ||
        (disposition.toLowerCase() === 'follow_up' && dispKey === 'followup');
      const dateMatch = this.isWithinDateRange(call.created_at || call.ended_at, dateRange);

      return searchMatch && statusMatch && agentMatch && dispMatch && dateMatch;
    });

    result.sort((a, b) => {
      const timeA = new Date(a.created_at || 0).getTime();
      const timeB = new Date(b.created_at || 0).getTime();
      const durA = Number(a.duration) || 0;
      const durB = Number(b.duration) || 0;

      if (sort === 'oldest') return timeA - timeB;
      if (sort === 'duration_desc') return durB - durA;
      if (sort === 'duration_asc') return durA - durB;
      return timeB - timeA;
    });

    return result;
  }
}

// ============================================================================
// 5. Metrics View (Apple Health / Watch Inspired Widgets)
// ============================================================================
class MetricsView {
  static update(calls) {
    const total = calls.length;
    let countInterested = 0;
    let countFollowup = 0;
    let countNotInterested = 0;
    let countNoAnswer = 0;
    let countConverted = 0;

    calls.forEach(call => {
      const disp = DispositionService.detect(call);
      if (disp === 'interested') countInterested++;
      else if (disp === 'followup') countFollowup++;
      else if (disp === 'notinterested') countNotInterested++;
      else if (disp === 'noanswer') countNoAnswer++;
      else if (disp === 'converted') countConverted++;
    });

    DOM.byId('dispCountTotal').textContent = total;
    DOM.byId('dispSubTotal').textContent = total === 1 ? '1 logged call' : `${total} logged calls`;

    DOM.byId('dispCountInterested').textContent = countInterested;
    DOM.byId('dispPctInterested').textContent = total ? `${Math.round((countInterested / total) * 100)}% of total` : '0%';

    DOM.byId('dispCountFollowup').textContent = countFollowup;
    DOM.byId('dispPctFollowup').textContent = total ? `${Math.round((countFollowup / total) * 100)}% of total` : '0%';

    DOM.byId('dispCountNotInterested').textContent = countNotInterested;
    DOM.byId('dispPctNotInterested').textContent = total ? `${Math.round((countNotInterested / total) * 100)}% of total` : '0%';

    DOM.byId('dispCountNoAnswer').textContent = countNoAnswer;
    DOM.byId('dispPctNoAnswer').textContent = total ? `${Math.round((countNoAnswer / total) * 100)}% of total` : '0%';

    DOM.byId('dispCountConverted').textContent = countConverted;
    DOM.byId('dispPctConverted').textContent = total ? `${Math.round((countConverted / total) * 100)}% of total` : '0%';
  }
}

// ============================================================================
// 6. Table View (Apple High-Performance Render with Skeleton & Error State)
// ============================================================================
class TableView {
  static formatDate(value) {
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

  static formatDuration(seconds) {
    const secs = Number(seconds) || 0;
    if (secs <= 0) return '0s';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  }

  static formatCost(call) {
    const secs = Number(call.duration) || 0;
    if (secs === 0) return '$0.00';
    const estimatedCost = (secs / 60) * 0.02;
    return `$${Math.max(0.01, estimatedCost).toFixed(2)}`;
  }

  static renderSkeleton(container) {
    const rows = Array.from({ length: 4 }).map(() => `
      <tr class="skeleton-row">
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer short"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer short"></span></td>
        <td><span class="skeleton-shimmer short"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
      </tr>
    `).join('');
    container.innerHTML = rows;
  }

  static renderError(container, message, onRetry) {
    container.innerHTML = `
      <tr>
        <td colspan="14">
          <div class="empty-state-card">
            <span class="empty-icon" aria-hidden="true">⚠️</span>
            <div class="empty-title">Unable to Load Call Records</div>
            <div class="empty-desc">${DOM.safe(message)}</div>
            <button id="retryFetchBtn" class="apple-button primary-btn" type="button">Try Again</button>
          </div>
        </td>
      </tr>
    `;
    const retryBtn = DOM.byId('retryFetchBtn');
    if (retryBtn && onRetry) retryBtn.addEventListener('click', onRetry);
  }

  static renderEmpty(container, hasFilters) {
    const title = hasFilters ? 'No Matching Calls' : 'No Call Records Logged Yet';
    const desc = hasFilters
      ? 'Try adjusting your search criteria or date range.'
      : 'Outbound calls and inbound conversations will appear here automatically.';

    container.innerHTML = `
      <tr>
        <td colspan="14">
          <div class="empty-state-card">
            <span class="empty-icon" aria-hidden="true">📞</span>
            <div class="empty-title">${DOM.safe(title)}</div>
            <div class="empty-desc">${DOM.safe(desc)}</div>
          </div>
        </td>
      </tr>
    `;
  }

  static renderRows(container, calls) {
    container.innerHTML = calls.map((call, idx) => {
      const name = call.student_name || 'Customer';
      const initial = name.charAt(0).toUpperCase();
      const callId = call.snapserve_call_id || call.id || '—';
      const agentName = call.agent_name || call.agent_id || 'Voice Agent';
      const fromPhone = call.phone || '—';
      const toCourse = call.course || 'Admissions';
      const status = String(call.status || 'completed').toLowerCase();
      const dispKey = DispositionService.detect(call);
      const durationStr = this.formatDuration(call.duration);
      const costStr = this.formatCost(call);
      const dateStr = this.formatDate(call.created_at || call.ended_at);

      return `
        <tr>
          <td style="font-size:0.8rem;white-space:nowrap;">${DOM.safe(dateStr)}</td>
          <td><span class="call-id-chip">#${DOM.safe(callId.slice(0, 10))}</span></td>
          <td>
            <div class="user-cell-wrap">
              <span class="avatar-circle">${DOM.safe(initial)}</span>
              <strong>${DOM.safe(name)}</strong>
            </div>
          </td>
          <td>
            <span class="agent-cell-pill">
              🤖 ${DOM.safe(agentName)}
            </span>
          </td>
          <td style="font-family:var(--apple-mono);font-size:0.84rem;">${DOM.safe(fromPhone)}</td>
          <td><span class="badge">${DOM.safe(toCourse)}</span></td>
          <td>
            <span class="call-type-badge call-type-outbound">Outbound ↗</span>
          </td>
          <td>
            <span class="status-badge ${status === 'completed' ? 'status-completed' : 'status-failed'}">
              ${status === 'completed' ? '✓ Completed' : '✕ ' + DOM.safe(status)}
            </span>
          </td>
          <td>
            ${DispositionService.renderPill(dispKey)}
          </td>
          <td style="font-family:var(--apple-mono);font-weight:600;">${DOM.safe(durationStr)}</td>
          <td style="font-family:var(--apple-mono);color:#248a3d;font-weight:600;">${DOM.safe(costStr)}</td>
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
}

// ============================================================================
// 7. WaveSurfer Audio Player Controller
// ============================================================================
class AudioPlayerController {
  constructor() {
    this.wavesurfer = null;
    this.modal = DOM.byId('recordingModal');
    this.playPauseBtn = DOM.byId('recordingPlayPause');
    this.timeDisplay = DOM.byId('recordingTime');
    this.speedSelect = DOM.byId('playbackSpeed');
    this.errorDisplay = DOM.byId('recordingError');
    this.downloadLink = DOM.byId('downloadAudioLink');

    this.bindEvents();
  }

  bindEvents() {
    this.playPauseBtn.addEventListener('click', () => {
      if (this.wavesurfer) this.wavesurfer.playPause();
    });

    this.speedSelect.addEventListener('change', () => {
      if (this.wavesurfer) {
        this.wavesurfer.setPlaybackRate(parseFloat(this.speedSelect.value));
      }
    });

    DOM.byId('closeRecordingModal').addEventListener('click', () => this.close());
  }

  open(call) {
    const name = call.student_name || 'Customer';
    DOM.byId('recordingModalTitle').textContent = `Recording — ${name}`;
    DOM.byId('recordingModalMeta').textContent = [
      call.agent_name ? 'Agent: ' + call.agent_name : '',
      call.phone ? 'Phone: ' + call.phone : '',
      call.duration ? TableView.formatDuration(call.duration) : ''
    ].filter(Boolean).join(' · ');

    this.errorDisplay.textContent = 'Loading audio waveform…';
    this.playPauseBtn.disabled = true;
    this.playPauseBtn.textContent = 'Play';
    this.timeDisplay.textContent = '0:00 / 0:00';
    this.downloadLink.href = `/calls/${encodeURIComponent(call.snapserve_call_id || call.id)}/recording`;

    this.modal.hidden = false;
    document.body.style.overflow = 'hidden';

    this.destroy();

    if (!window.WaveSurfer) {
      this.errorDisplay.textContent = 'WaveSurfer audio engine unavailable. Refresh and try again.';
      return;
    }

    const recordingId = call.snapserve_call_id || call.id;
    this.wavesurfer = WaveSurfer.create({
      container: '#recordingWaveform',
      height: 72,
      waveColor: '#0071e3',
      progressColor: '#af52de',
      cursorColor: '#ffffff',
      barWidth: 2,
      barGap: 2,
      barRadius: 2,
      normalize: true,
      url: `/calls/${encodeURIComponent(recordingId)}/recording`
    });

    this.wavesurfer.on('ready', () => {
      this.playPauseBtn.disabled = false;
      this.errorDisplay.textContent = '';
      this.updateTime();
    });

    this.wavesurfer.on('timeupdate', () => this.updateTime());
    this.wavesurfer.on('play', () => { this.playPauseBtn.textContent = 'Pause'; });
    this.wavesurfer.on('pause', () => { this.playPauseBtn.textContent = 'Play'; });
    this.wavesurfer.on('finish', () => { this.playPauseBtn.textContent = 'Replay'; });
    this.wavesurfer.on('error', () => {
      this.playPauseBtn.disabled = true;
      this.errorDisplay.textContent = 'Recording stream unavailable.';
    });
  }

  updateTime() {
    if (!this.wavesurfer) return;
    const current = this.wavesurfer.getCurrentTime() || 0;
    const total = this.wavesurfer.getDuration() || 0;

    const fmt = (s) => {
      const safeS = Number.isFinite(s) ? Math.max(0, Math.floor(s)) : 0;
      return `${Math.floor(safeS / 60)}:${String(safeS % 60).padStart(2, '0')}`;
    };

    this.timeDisplay.textContent = `${fmt(current)} / ${fmt(total)}`;
  }

  destroy() {
    if (this.wavesurfer) {
      this.wavesurfer.destroy();
      this.wavesurfer = null;
    }
    const container = DOM.byId('recordingWaveform');
    if (container) container.replaceChildren();
  }

  close() {
    this.destroy();
    this.modal.hidden = true;
    document.body.style.overflow = '';
  }
}

// ============================================================================
// 8. Main Application Controller (Dependency Inversion & Orchestration)
// ============================================================================
class CallRecordsApp {
  constructor() {
    this.availableCalls = [];
    this.visibleCalls = [];
    this.activeTranscript = '';
    this.audioPlayer = new AudioPlayerController();

    this.initElements();
    this.bindEvents();
    this.loadData();
  }

  initElements() {
    this.callSearch = DOM.byId('callSearch');
    this.callStatusFilter = DOM.byId('callStatusFilter');
    this.callAgentFilter = DOM.byId('callAgentFilter');
    this.callDispositionFilter = DOM.byId('callDispositionFilter');
    this.callDateRangeFilter = DOM.byId('callDateRangeFilter');
    this.callSortFilter = DOM.byId('callSortFilter');
    this.exportCallsBtn = DOM.byId('exportCallsBtn');
    this.clearCallFilters = DOM.byId('clearCallFilters');
    this.callResultCount = DOM.byId('callResultCount');
    this.callsBody = DOM.byId('callsBody');
    this.refreshCallsBtn = DOM.byId('refreshCallsBtn');
    this.logoutBtn = DOM.byId('logoutBtn');

    this.transcriptModal = DOM.byId('transcriptModal');
    this.transcriptBody = DOM.byId('transcriptBody');
    this.copyTranscriptBtn = DOM.byId('copyTranscriptBtn');

    this.summaryModal = DOM.byId('summaryModal');
  }

  bindEvents() {
    const handleFilterChange = () => this.filterAndRender();

    this.callSearch.addEventListener('input', handleFilterChange);
    this.callStatusFilter.addEventListener('change', handleFilterChange);
    this.callAgentFilter.addEventListener('change', handleFilterChange);
    this.callDispositionFilter.addEventListener('change', handleFilterChange);
    this.callDateRangeFilter.addEventListener('change', handleFilterChange);
    this.callSortFilter.addEventListener('change', handleFilterChange);

    this.clearCallFilters.addEventListener('click', () => {
      this.callSearch.value = '';
      this.callStatusFilter.value = '';
      this.callAgentFilter.value = '';
      this.callDispositionFilter.value = '';
      this.callDateRangeFilter.value = 'all';
      this.callSortFilter.value = 'newest';
      this.filterAndRender();
    });

    this.refreshCallsBtn.addEventListener('click', () => this.loadData());

    this.logoutBtn.addEventListener('click', async () => {
      await fetch('/admin/logout', { method: 'POST' }).catch(() => {});
      window.location.replace('/admin/login');
    });

    this.exportCallsBtn.addEventListener('click', () => this.exportCsv());

    // Table Row Actions (Event Delegation)
    this.callsBody.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-action]');
      if (!btn) return;
      const action = btn.dataset.action;
      const index = Number(btn.dataset.index);
      const call = this.visibleCalls[index];
      if (!call) return;

      if (action === 'play') this.audioPlayer.open(call);
      else if (action === 'transcript') this.openTranscript(call);
      else if (action === 'summary') this.openSummary(call);
    });

    // Transcript Modals
    DOM.byId('closeTranscriptModal').addEventListener('click', () => {
      this.transcriptModal.hidden = true;
      document.body.style.overflow = '';
    });

    this.copyTranscriptBtn.addEventListener('click', () => {
      if (!this.activeTranscript) return;
      navigator.clipboard.writeText(this.activeTranscript).then(() => {
        this.copyTranscriptBtn.textContent = 'Copied! ✓';
        setTimeout(() => { this.copyTranscriptBtn.textContent = 'Copy transcript'; }, 1800);
      });
    });

    // Summary Modals
    DOM.byId('closeSummaryModal').addEventListener('click', () => {
      this.summaryModal.hidden = true;
      document.body.style.overflow = '';
    });

    // Escape Key Modal Listener
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.audioPlayer.close();
        this.transcriptModal.hidden = true;
        this.summaryModal.hidden = true;
        document.body.style.overflow = '';
      }
    });
  }

  async loadData() {
    // 1. Show Apple animated skeleton shimmer immediately (solves "loading always" static freeze)
    TableView.renderSkeleton(this.callsBody);
    this.callResultCount.textContent = 'Loading call records…';

    try {
      this.availableCalls = await CallApiService.fetchCalls(7000);
      this.populateDropdownFilters();
      this.filterAndRender();
    } catch (err) {
      console.error('CallRecords load error:', err);
      this.callResultCount.textContent = 'Unable to connect';
      TableView.renderError(this.callsBody, err.message, () => this.loadData());
    }
  }

  populateDropdownFilters() {
    const statuses = [...new Set(this.availableCalls.map(c => c.status).filter(Boolean))].sort();
    const agents = [...new Set(this.availableCalls.map(c => c.agent_name || c.agent_id).filter(Boolean))].sort();

    const currStatus = this.callStatusFilter.value;
    this.callStatusFilter.innerHTML = '<option value="">All statuses</option>' +
      statuses.map(s => `<option value="${DOM.safe(s)}">${DOM.safe(s.charAt(0).toUpperCase() + s.slice(1))}</option>`).join('');
    this.callStatusFilter.value = statuses.includes(currStatus) ? currStatus : '';

    const currAgent = this.callAgentFilter.value;
    this.callAgentFilter.innerHTML = '<option value="">All agents</option>' +
      agents.map(a => `<option value="${DOM.safe(a)}">${DOM.safe(a)}</option>`).join('');
    this.callAgentFilter.value = agents.includes(currAgent) ? currAgent : '';
  }

  filterAndRender() {
    const criteria = {
      query: this.callSearch.value.trim(),
      status: this.callStatusFilter.value,
      agent: this.callAgentFilter.value,
      disposition: this.callDispositionFilter.value,
      dateRange: this.callDateRangeFilter.value,
      sort: this.callSortFilter.value
    };

    this.visibleCalls = CallFilterEngine.apply(this.availableCalls, criteria);

    // Update Apple Metrics Widgets
    MetricsView.update(this.visibleCalls);

    // Update Result Header
    const hasFilters = Boolean(criteria.query || criteria.status || criteria.agent ||
      criteria.disposition || (criteria.dateRange && criteria.dateRange !== 'all'));

    this.clearCallFilters.hidden = !hasFilters;
    this.callResultCount.textContent = `${this.visibleCalls.length} of ${this.availableCalls.length} calls shown`;

    // Render Table or Empty State
    if (this.visibleCalls.length === 0) {
      TableView.renderEmpty(this.callsBody, hasFilters);
    } else {
      TableView.renderRows(this.callsBody, this.visibleCalls);
    }
  }

  openTranscript(call) {
    const name = call.student_name || 'Customer';
    DOM.byId('transcriptModalTitle').textContent = `Transcript — ${name}`;
    DOM.byId('transcriptModalMeta').textContent = [
      call.agent_name ? 'Agent: ' + call.agent_name : '',
      call.phone ? 'Phone: ' + call.phone : '',
      call.duration ? TableView.formatDuration(call.duration) : ''
    ].filter(Boolean).join(' · ');

    const rawTranscript = typeof call.transcript === 'string'
      ? call.transcript
      : JSON.stringify(call.transcript, null, 2);

    this.activeTranscript = rawTranscript;

    const lines = rawTranscript.split('\n').filter(l => l.trim());
    if (!lines.length) {
      this.transcriptBody.innerHTML = '<p class="empty">No transcript available for this conversation.</p>';
    } else {
      this.transcriptBody.innerHTML = lines.map(line => {
        const colonIdx = line.indexOf(':');
        let speaker = 'System';
        let text = line;

        if (colonIdx > 0 && colonIdx < 30) {
          speaker = line.slice(0, colonIdx).trim();
          text = line.slice(colonIdx + 1).trim();
        }

        const isAgent = speaker.toLowerCase().includes('agent') || speaker.toLowerCase().includes('assistant') || speaker.toLowerCase().includes('liza');
        const bubbleClass = isAgent ? 'agent-bubble' : 'user-bubble';
        const avatar = isAgent ? '🤖' : '👤';

        return `
          <div class="chat-bubble ${bubbleClass}">
            <div class="chat-avatar">${avatar}</div>
            <div class="chat-content">
              <span class="chat-speaker">${DOM.safe(speaker)}</span>
              <div>${DOM.safe(text)}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    this.transcriptModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  openSummary(call) {
    const name = call.student_name || 'Customer';
    DOM.byId('summaryModalTitle').textContent = `AI Summary — ${name}`;
    DOM.byId('summaryModalMeta').textContent = [
      call.agent_name ? 'Agent: ' + call.agent_name : '',
      call.course ? 'Campaign: ' + call.course : '',
      call.phone ? 'Phone: ' + call.phone : ''
    ].filter(Boolean).join(' · ');

    const dispKey = DispositionService.detect(call);
    DOM.byId('summaryModalDispBadge').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <strong style="font-size:0.85rem;color:var(--apple-label-secondary);">Outcome:</strong>
        ${DispositionService.renderPill(dispKey)}
      </div>
    `;

    DOM.byId('summaryModalText').textContent = typeof call.summary === 'string'
      ? call.summary
      : JSON.stringify(call.summary, null, 2);

    this.summaryModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  exportCsv() {
    if (!this.visibleCalls.length) {
      alert('No call records to export.');
      return;
    }

    const headers = ['Date', 'Call ID', 'Name', 'Agent', 'From', 'To', 'Call Type', 'Status', 'Disposition', 'Duration (s)', 'Cost'];
    const rows = this.visibleCalls.map(c => [
      TableView.formatDate(c.created_at || c.ended_at),
      c.snapserve_call_id || c.id || '',
      c.student_name || 'Customer',
      c.agent_name || c.agent_id || '',
      c.phone || '',
      c.course || '',
      'Outbound',
      c.status || 'completed',
      DispositionService.detect(c),
      c.duration || 0,
      TableView.formatCost(c)
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
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  new CallRecordsApp();
});
