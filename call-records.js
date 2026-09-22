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
    callback: {
      key: 'callback',
      label: 'Call Back Requested',
      class: 'disp-followup',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    followup: {
      key: 'callback',
      label: 'Call Back Requested',
      class: 'disp-followup',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`
    },
    voicemail: {
      key: 'voicemail',
      label: 'No Answer / Voicemail',
      class: 'disp-noanswer',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 3.41l2.48-2.48a1 1 0 0 1 1.05-.24 11.2 11.2 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1 11.2 11.2 0 0 0 .56 3.5 1 1 0 0 1-.24 1.05z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`
    },
    noanswer: {
      key: 'voicemail',
      label: 'No Answer / Voicemail',
      class: 'disp-noanswer',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.68 13.31a16 16 0 0 0 3.41 3.41l2.48-2.48a1 1 0 0 1 1.05-.24 11.2 11.2 0 0 0 3.5.56 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h4.5a1 1 0 0 1 1 1 11.2 11.2 0 0 0 .56 3.5 1 1 0 0 1-.24 1.05z"/><line x1="23" y1="1" x2="1" y2="23"/></svg>`
    },
    notinterested: {
      key: 'notinterested',
      label: 'Not Interested',
      class: 'disp-notinterested',
      icon: `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`
    },
    converted: {
      key: 'interested',
      label: 'Interested',
      class: 'disp-interested',
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
    if (!call) return 'interested';
    const rawDisp = String(call.disposition || call.dispositionResult || '').toLowerCase();
    const evalStr = String(call.success_evaluation || '').toLowerCase();
    const summaryStr = String(call.summary || '').toLowerCase();
    const statusStr = String(call.status || '').toLowerCase();
    const transcriptStr = String(call.transcript || '').toLowerCase();
    const combined = `${rawDisp} ${evalStr} ${summaryStr} ${statusStr} ${transcriptStr}`;

    if (combined.includes('not interested') || combined.includes('not_interested') || combined.includes('rejected') || combined.includes('wrong number') || combined.includes('do not call')) {
      return 'notinterested';
    }
    if (combined.includes('call back') || combined.includes('callback') || combined.includes('follow up') || combined.includes('followup') || combined.includes('reschedule') || combined.includes('call later')) {
      return 'callback';
    }
    if (statusStr === 'failed' || statusStr === 'error' || combined.includes('failed') || combined.includes('timeout') || combined.includes('dropped')) {
      return 'failed';
    }
    if (statusStr === 'no-pickup' || statusStr === 'no_pickup' || statusStr === 'no_answer' || statusStr === 'no-answer' || statusStr === 'busy' || combined.includes('no answer') || combined.includes('no pickup') || combined.includes('voicemail') || combined.includes('unreachable')) {
      return 'voicemail';
    }
    if (combined.includes('interested') || combined.includes('enrolled') || combined.includes('converted') || combined.includes('passed') || combined.includes('success') || evalStr.includes('pass') || combined.includes('demo') || combined.includes('joined')) {
      return 'interested';
    }
    if (Number(call.duration || 0) > 0) {
      return 'interested';
    }
    return 'voicemail';
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
  static async fetchCalls(timeoutMs = 15000, sync = false) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const url = '/calls' + (sync ? '?sync=true' : '');
      const response = await fetch(url, {
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
    const { query, status, agent, course, disposition, dateRange, dateFrom, dateTo, sort, tab } = criteria;

    let result = calls.filter(call => {
      // Subtab check (Calls, Callbacks, Transfers)
      if (tab === 'callbacks') {
        const dStr = String(call.disposition || '').toLowerCase();
        if (!dStr.includes('call back') && !dStr.includes('callback')) return false;
      } else if (tab === 'transfers') {
        const cType = String(call.call_type || '').toLowerCase();
        const cStat = String(call.status || '').toLowerCase();
        if (!cType.includes('transfer') && !cStat.includes('transfer')) return false;
      }

      const callId = call.snapserve_call_id || call.id || '';
      const agentName = call.agent_name || call.agent_id || '';
      const fromPhone = call.from_number || '';
      const toPhone = call.to_number || call.phone || '';
      const callType = call.call_type || '';
      const callStatus = call.status || '';
      const callDisp = call.disposition || '';
      const studentName = call.student_name || '';
      const summary = typeof call.summary === 'string' ? call.summary : '';
      const nature = call.nature_of_business || '';
      const courseVal = call.course || '';

      const haystack = [callId, agentName, fromPhone, toPhone, callType, callStatus, callDisp, studentName, summary, nature].join(' ').toLowerCase();

      const searchMatch = !query || haystack.includes(query.toLowerCase());
      
      let statusMatch = true;
      if (status) {
        const sNorm = String(callStatus).toLowerCase().replace(/[\s_-]+/g, '');
        const fNorm = status.toLowerCase().replace(/[\s_-]+/g, '');
        statusMatch = sNorm === fNorm || sNorm.includes(fNorm);
      }

      const agentMatch = !agent || agentName.toLowerCase() === agent.toLowerCase();
      const courseMatch = !course || courseVal.toLowerCase() === course.toLowerCase();
      
      let dispMatch = true;
      if (disposition && disposition !== 'all') {
        const fVal = disposition.toLowerCase().trim();
        const dVal = callDisp.toLowerCase().trim();
        const nVal = String(nature).toLowerCase().trim();

        if (fVal === 'interested_eligible') {
          dispMatch = dVal.includes('interested_eligible') || dVal.includes('interested eligible');
        } else if (fVal === 'not interested') {
          dispMatch = dVal.includes('not interested') || dVal.includes('not_interested');
        } else if (fVal === 'below_turnover_threshold') {
          dispMatch = dVal.includes('below_turnover') || dVal.includes('below turnover');
        } else if (fVal === 'call back requested') {
          dispMatch = dVal.includes('call back') || dVal.includes('callback');
        } else if (fVal === 'monthly_turnover') {
          dispMatch = dVal.includes('monthly_turnover') || Boolean(call.monthly_turnover);
        } else if (fVal === 'fund_required') {
          dispMatch = dVal.includes('fund_required') || Boolean(call.fund_required);
        } else if (fVal === 'nature_of_business') {
          dispMatch = dVal.includes('nature_of_business') || Boolean(call.nature_of_business);
        } else if (fVal === 'real estate') {
          dispMatch = dVal.includes('real estate') || nVal.includes('real estate');
        } else if (fVal === 'steel business') {
          dispMatch = dVal.includes('steel business') || nVal.includes('steel business');
        } else {
          dispMatch = dVal.includes(fVal) || nVal.includes(fVal);
        }
      }

      // Date matching
      let dateMatch = true;
      const callTime = new Date(call.created_at || call.ended_at).getTime();
      if (dateFrom) {
        const fromTime = new Date(dateFrom).setHours(0, 0, 0, 0);
        if (!isNaN(fromTime) && callTime < fromTime) dateMatch = false;
      }
      if (dateTo && dateMatch) {
        const toTime = new Date(dateTo).setHours(23, 59, 59, 999);
        if (!isNaN(toTime) && callTime > toTime) dateMatch = false;
      }
      if (!dateFrom && !dateTo) {
        dateMatch = this.isWithinDateRange(call.created_at || call.ended_at, dateRange);
      }

      return searchMatch && statusMatch && agentMatch && courseMatch && dispMatch && dateMatch;
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
// 5. Metrics View (5 Metrics Cards + Quick Buckets Matching Screenshots)
// ============================================================================
class MetricsView {
  static update(calls, allCalls) {
    const listForCards = calls;
    const listForBuckets = allCalls || calls;

    const total = listForCards.length;
    let completed = 0;
    let voicemail = 0;
    let failed = 0;
    let totalDuration = 0;
    let durationCount = 0;

    listForCards.forEach(call => {
      const status = String(call.status || '').toLowerCase().replace(/[\s_-]+/g, '');
      const disp = String(call.disposition || '').toLowerCase();
      const dur = Number(call.duration) || 0;

      if (status === 'completed') {
        completed++;
      } else if (status === 'failed' || status === 'error') {
        failed++;
      } else if (status === 'voicemail' || disp.includes('voicemail')) {
        voicemail++;
      }

      if (dur > 0) {
        totalDuration += dur;
        durationCount++;
      }
    });

    const avgDur = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;

    const elTotal = DOM.byId('dispCountTotal');
    const elCompleted = DOM.byId('dispCountCompleted');
    const elVoicemail = DOM.byId('dispCountVoicemail');
    const elFailed = DOM.byId('dispCountFailed');
    const elAvgDur = DOM.byId('dispAvgDuration');

    if (elTotal) elTotal.textContent = total;
    if (elCompleted) elCompleted.textContent = completed;
    if (elVoicemail) elVoicemail.textContent = voicemail;
    if (elFailed) elFailed.textContent = failed;
    if (elAvgDur) elAvgDur.textContent = `${avgDur}s`;

    // Update Quick Buckets
    const bucketCounts = {
      all: listForBuckets.length,
      interested: 0,
      callback: 0,
      voicemail: 0,
      notinterested: 0,
      failed: 0
    };

    listForBuckets.forEach(call => {
      const d = String(call.disposition || '').toLowerCase();
      const s = String(call.status || '').toLowerCase();
      if (d.includes('interested') || d.includes('eligible')) {
        bucketCounts.interested++;
      } else if (d.includes('call back') || d.includes('callback')) {
        bucketCounts.callback++;
      } else if (d.includes('not interested') || d.includes('not_interested')) {
        bucketCounts.notinterested++;
      } else if (s === 'failed' || s === 'error') {
        bucketCounts.failed++;
      } else if (s.includes('voicemail') || s.includes('pickup') || s.includes('no_answer')) {
        bucketCounts.voicemail++;
      }
    });

    const bAll = DOM.byId('dispBucketCountAll');
    const bInterested = DOM.byId('dispBucketCountInterested');
    const bCallback = DOM.byId('dispBucketCountCallback');
    const bVoicemail = DOM.byId('dispBucketCountVoicemail');
    const bNotInterested = DOM.byId('dispBucketCountNotInterested');
    const bFailed = DOM.byId('dispBucketCountFailed');

    if (bAll) bAll.textContent = bucketCounts.all;
    if (bInterested) bInterested.textContent = bucketCounts.interested;
    if (bCallback) bCallback.textContent = bucketCounts.callback;
    if (bVoicemail) bVoicemail.textContent = bucketCounts.voicemail;
    if (bNotInterested) bNotInterested.textContent = bucketCounts.notinterested;
    if (bFailed) bFailed.textContent = bucketCounts.failed;
  }
}

// ============================================================================
// 6. Table View (10 Columns Matching Screenshot)
// ============================================================================
class TableView {
  static formatDate(value) {
    if (!value) return '—';
    const { date, time } = this.formatDateParts(value);
    return date !== '—' ? `${date} ${time}` : '—';
  }

  static formatDuration(seconds) {
    const s = Number(seconds) || 0;
    const mins = Math.floor(s / 60);
    const rem = s % 60;
    if (mins === 0) return `${rem}s`;
    return `${mins}m ${rem}s`;
  }

  static formatDateParts(value) {
    if (!value) return { date: '—', time: '—' };
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return { date: '—', time: '—' };

    const dateStr = date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    const hours = String(date.getHours()).padStart(2, '0');
    const mins = String(date.getMinutes()).padStart(2, '0');
    const secs = String(date.getSeconds()).padStart(2, '0');
    return { date: dateStr, time: `${hours}:${mins}:${secs}` };
  }

  static renderSkeleton(container) {
    const rows = Array.from({ length: 5 }).map(() => `
      <tr class="skeleton-row">
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer short"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer badge"></span></td>
        <td><span class="skeleton-shimmer short"></span></td>
        <td><span class="skeleton-shimmer short"></span></td>
      </tr>
    `).join('');
    container.innerHTML = rows;
  }

  static renderError(container, message, onRetry) {
    container.innerHTML = `
      <tr>
        <td colspan="10">
          <div class="empty-state-card">
            <span class="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
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
        <td colspan="10">
          <div class="empty-state-card">
            <span class="empty-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
            </span>
            <div class="empty-title">${DOM.safe(title)}</div>
            <div class="empty-desc">${DOM.safe(desc)}</div>
          </div>
        </td>
      </tr>
    `;
  }

  static renderRows(container, calls) {
    container.innerHTML = calls.map((call, idx) => {
      const callId = call.snapserve_call_id || call.id || '—';
      const agentName = call.agent_name || call.agent_id || 'MR Fin Tamil';
      const fromPhone = call.from_number || '—';
      const toPhone = call.to_number || call.phone || '—';
      const callType = call.call_type || 'Live Call';
      const isCampaign = String(callType).toLowerCase().includes('campaign');
      const status = String(call.status || 'completed').toLowerCase().replace(/[\s_-]+/g, '');
      const dur = Number(call.duration) || 0;
      const cost = call.cost || '';
      const { date, time } = this.formatDateParts(call.created_at || call.ended_at);

      // Call Type Pill
      const callTypeBadge = isCampaign
        ? `<span class="call-type-pill">↗ 📢 Campaign</span>`
        : `<span class="call-type-pill">↙ 📞 Live Call</span>`;

      // Status Pill matching Screenshot 2
      let statusBadge = '';
      if (status === 'calling' || status === 'ringing' || status === 'inprogress') {
        statusBadge = `<span class="status-pill status-calling"><span class="status-dot"></span>Calling</span>`;
      } else if (status === 'failed' || status === 'error') {
        statusBadge = `<span class="status-pill status-failed"><span class="status-dot"></span>Failed</span>`;
      } else if (status === 'nopickup' || status === 'noanswer' || status === 'busy') {
        statusBadge = `<span class="status-pill status-nopickup"><span class="status-dot"></span>No Pickup</span>`;
      } else if (status === 'pending') {
        statusBadge = `<span class="status-pill status-calling"><span class="status-dot"></span>Pending</span>`;
      } else if (status === 'cancelled') {
        statusBadge = `<span class="status-pill status-failed"><span class="status-dot"></span>Cancelled</span>`;
      } else if (status === 'transferred') {
        statusBadge = `<span class="status-pill status-calling"><span class="status-dot"></span>Transferred</span>`;
      } else {
        statusBadge = `<span class="status-pill status-completed"><span class="status-dot"></span>Completed</span>`;
      }

      // Disposition Badge matching Screenshot 2
      const rawDisp = (call.disposition || '').trim();
      let dispBadge = '<span class="table-dash">—</span>';
      if (rawDisp && rawDisp !== '—') {
        const norm = rawDisp.toLowerCase();
        let pillClass = 'disp-neutral';
        if (norm.includes('interested_eligible') || norm === 'interested') {
          pillClass = 'disp-interested';
        } else if (norm.includes('not interested') || norm.includes('not_interested')) {
          pillClass = 'disp-notinterested';
        } else if (norm.includes('call back') || norm.includes('callback')) {
          pillClass = 'disp-followup';
        } else if (norm.includes('below_turnover') || norm.includes('threshold')) {
          pillClass = 'disp-threshold';
        } else if (norm.includes('nature') || norm.includes('steel') || norm.includes('real estate') || norm.includes('fund') || norm.includes('turnover')) {
          pillClass = 'disp-info';
        } else if (norm.includes('no pickup') || norm.includes('no_answer') || norm.includes('busy')) {
          pillClass = 'disp-noanswer';
        }
        const displayLabel = rawDisp.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        dispBadge = `<span class="disp-badge ${pillClass}">${DOM.safe(displayLabel)}</span>`;
      }

      // Duration
      const durationStr = (status === 'calling' || status === 'failed' || dur <= 0)
        ? `<span class="table-dash">—</span>`
        : `${dur}s`;

      // Cost
      const costStr = (cost && cost !== '—' && cost !== '0' && cost !== '₹0.00' && cost !== '$0.00')
        ? `<span class="cost-cell">${DOM.safe(cost)}</span>`
        : `<span class="table-dash">—</span>`;

      return `
        <tr data-index="${idx}" title="Click to view call recording, summary and transcript">
          <td>
            <div class="date-cell-wrap">
              <span class="date-cell-main">${DOM.safe(date)}</span>
              <span class="date-cell-time">${DOM.safe(time)}</span>
            </div>
          </td>
          <td><span class="call-id-mono">${DOM.safe(callId)}</span></td>
          <td>
            <div class="agent-cell-wrap">
              <span class="agent-avatar-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span class="agent-cell-name">${DOM.safe(agentName)}</span>
            </div>
          </td>
          <td><span class="phone-cell">${DOM.safe(fromPhone)}</span></td>
          <td><span class="phone-cell">${DOM.safe(toPhone)}</span></td>
          <td>${callTypeBadge}</td>
          <td>${statusBadge}</td>
          <td>${dispBadge}</td>
          <td style="font-weight:500;">${durationStr}</td>
          <td>${costStr}</td>
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
    this.callCourseFilter = DOM.byId('callCourseFilter');
    this.callDispositionFilter = DOM.byId('callDispositionFilter');
    this.callDateRangeFilter = DOM.byId('callDateRangeFilter');
    this.dateRangeBtn = DOM.byId('dateRangeBtn');
    this.dateRangePopover = DOM.byId('dateRangePopover');
    this.dateRangeFrom = DOM.byId('dateRangeFrom');
    this.dateRangeTo = DOM.byId('dateRangeTo');
    this.dateRangeClearBtn = DOM.byId('dateRangeClearBtn');
    this.dateRangeTodayBtn = DOM.byId('dateRangeTodayBtn');

    this.callSortFilter = DOM.byId('callSortFilter');
    this.exportCallsBtn = DOM.byId('exportCallsBtn');
    this.exportCsvBtn = DOM.byId('exportCsvBtn');
    this.clearCallFilters = DOM.byId('clearCallFilters');
    this.callResultCount = DOM.byId('callResultCount');
    this.callsBody = DOM.byId('callsBody');
    this.refreshCallsBtn = DOM.byId('refreshCallsBtn');
    this.logoutBtn = DOM.byId('logoutBtn');

    this.transcriptModal = DOM.byId('transcriptModal');
    this.transcriptBody = DOM.byId('transcriptBody');
    this.copyTranscriptBtn = DOM.byId('copyTranscriptBtn');

    this.summaryModal = DOM.byId('summaryModal');
    this.activeTab = 'calls';
  }

  bindEvents() {
    const handleFilterChange = () => {
      const val = this.callDispositionFilter.value || 'all';
      const bucketBtns = document.querySelectorAll('.disp-bucket-btn');
      bucketBtns.forEach(b => b.classList.toggle('active', (b.dataset.disp || 'all') === val));
      this.filterAndRender();
    };

    this.callSearch.addEventListener('input', handleFilterChange);
    this.callStatusFilter.addEventListener('change', handleFilterChange);
    this.callAgentFilter.addEventListener('change', handleFilterChange);
    if (this.callCourseFilter) this.callCourseFilter.addEventListener('change', handleFilterChange);
    this.callDispositionFilter.addEventListener('change', handleFilterChange);
    this.callDateRangeFilter.addEventListener('change', handleFilterChange);
    this.callSortFilter.addEventListener('change', handleFilterChange);

    // Date Range Popover Toggle & Inputs
    if (this.dateRangeBtn && this.dateRangePopover) {
      this.dateRangeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.dateRangePopover.hidden = !this.dateRangePopover.hidden;
      });
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.date-range-btn-wrap')) {
          this.dateRangePopover.hidden = true;
        }
      });
    }

    if (this.dateRangeFrom) this.dateRangeFrom.addEventListener('change', handleFilterChange);
    if (this.dateRangeTo) this.dateRangeTo.addEventListener('change', handleFilterChange);
    if (this.dateRangeClearBtn) {
      this.dateRangeClearBtn.addEventListener('click', () => {
        if (this.dateRangeFrom) this.dateRangeFrom.value = '';
        if (this.dateRangeTo) this.dateRangeTo.value = '';
        handleFilterChange();
      });
    }
    if (this.dateRangeTodayBtn) {
      this.dateRangeTodayBtn.addEventListener('click', () => {
        const today = new Date().toISOString().slice(0, 10);
        if (this.dateRangeFrom) this.dateRangeFrom.value = today;
        if (this.dateRangeTo) this.dateRangeTo.value = today;
        handleFilterChange();
      });
    }

    // Quick Bucket Buttons
    const bucketBtns = document.querySelectorAll('.disp-bucket-btn');
    bucketBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        bucketBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const disp = btn.dataset.disp || 'all';
        this.callDispositionFilter.value = disp === 'all' ? '' : disp;
        this.filterAndRender();
      });
    });

    this.clearCallFilters.addEventListener('click', () => {
      this.callSearch.value = '';
      this.callStatusFilter.value = '';
      this.callAgentFilter.value = '';
      if (this.callCourseFilter) this.callCourseFilter.value = '';
      this.callDispositionFilter.value = '';
      this.callDateRangeFilter.value = 'all';
      if (this.dateRangeFrom) this.dateRangeFrom.value = '';
      if (this.dateRangeTo) this.dateRangeTo.value = '';
      this.callSortFilter.value = 'newest';
      bucketBtns.forEach(b => b.classList.toggle('active', (b.dataset.disp || 'all') === 'all'));
      this.filterAndRender();
    });

    this.refreshCallsBtn.addEventListener('click', () => this.loadData());

    this.logoutBtn.addEventListener('click', async () => {
      await fetch('/admin/logout', { method: 'POST' }).catch(() => {});
      window.location.replace('/admin/login');
    });

    if (this.exportCallsBtn) {
      this.exportCallsBtn.addEventListener('click', () => this.exportExcel());
    }
    if (this.exportCsvBtn) {
      this.exportCsvBtn.addEventListener('click', () => this.exportCsv());
    }

    // Sub-Tabs Switching (Calls, Callbacks, Transfers)
    const subTabs = document.querySelectorAll('.sub-tab-btn');
    subTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        subTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.activeTab = tab.dataset.tab || 'calls';
        this.filterAndRender();
      });
    });

    // Table Row Click Actions
    this.callsBody.addEventListener('click', (e) => {
      const row = e.target.closest('tr[data-index]');
      if (!row) return;
      const index = Number(row.dataset.index);
      const call = this.visibleCalls[index];
      if (!call) return;

      if (call.recording_url) {
        this.audioPlayer.open(call);
      } else if (call.transcript) {
        this.openTranscript(call);
      } else if (call.summary) {
        this.openSummary(call);
      }
    });

    // Transcript Modals
    DOM.byId('closeTranscriptModal').addEventListener('click', () => {
      this.transcriptModal.hidden = true;
      document.body.style.overflow = '';
    });

    this.copyTranscriptBtn.addEventListener('click', () => {
      if (!this.activeTranscript) return;
      navigator.clipboard.writeText(this.activeTranscript).then(() => {
        this.copyTranscriptBtn.textContent = 'Copied';
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
    TableView.renderSkeleton(this.callsBody);
    this.callResultCount.textContent = 'Loading call records…';

    try {
      this.availableCalls = await CallApiService.fetchCalls(20000);
      this.populateDropdownFilters();
      this.filterAndRender();
    } catch (err) {
      console.error('CallRecords load error:', err);
      this.callResultCount.textContent = 'Unable to connect';
      TableView.renderError(this.callsBody, err.message, () => this.loadData());
    }
  }

  populateDropdownFilters() {
    // 1. Statuses
    const knownStatuses = ['calling', 'in_progress', 'completed', 'failed', 'pending', 'cancelled', 'transferred', 'no_pickup'];
    const callStatuses = [...new Set(this.availableCalls.map(c => c.status).filter(Boolean))];
    const allStatuses = [...new Set([...knownStatuses, ...callStatuses])];

    const currStatus = this.callStatusFilter.value;
    this.callStatusFilter.innerHTML = '<option value="">All statuses</option>' +
      allStatuses.map(s => {
        const label = s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
        return `<option value="${DOM.safe(s)}">${DOM.safe(label)}</option>`;
      }).join('');
    this.callStatusFilter.value = currStatus || '';

    // 2. Agents
    const agents = [...new Set(this.availableCalls.map(c => c.agent_name || c.agent_id).filter(Boolean))].sort();
    const currAgent = this.callAgentFilter.value;
    this.callAgentFilter.innerHTML = '<option value="">All agents</option>' +
      agents.map(a => `<option value="${DOM.safe(a)}">${DOM.safe(a)}</option>`).join('');
    this.callAgentFilter.value = agents.includes(currAgent) ? currAgent : '';

    // 3. Courses
    if (this.callCourseFilter) {
      const courses = [...new Set(this.availableCalls.map(c => c.course).filter(Boolean))].sort();
      const currCourse = this.callCourseFilter.value;
      this.callCourseFilter.innerHTML = '<option value="">All courses</option>' +
        courses.map(c => `<option value="${DOM.safe(c)}">${DOM.safe(c)}</option>`).join('');
      this.callCourseFilter.value = courses.includes(currCourse) ? currCourse : '';
    }

    // 4. Dispositions (including all specified by user & present in calls)
    const baseDispositions = [
      'interested_eligible',
      'not interested',
      'below_turnover_threshold',
      'call back requested',
      'monthly_turnover',
      'fund_required',
      'nature_of_business',
      'real estate',
      'steel business',
      'no pickup',
      'no_answer',
      'busy',
      'interested'
    ];
    const callDisps = this.availableCalls.map(c => c.disposition).filter(Boolean);
    const callNatures = this.availableCalls.map(c => c.nature_of_business).filter(Boolean);
    const allDispositions = [...new Set([...baseDispositions, ...callDisps, ...callNatures])];

    const currDisp = this.callDispositionFilter.value;
    this.callDispositionFilter.innerHTML = '<option value="">All dispositions</option>' +
      allDispositions.map(d => `<option value="${DOM.safe(d)}">${DOM.safe(d)}</option>`).join('');
    this.callDispositionFilter.value = currDisp || '';
  }

  filterAndRender() {
    const criteria = {
      query: this.callSearch.value.trim(),
      status: this.callStatusFilter.value,
      agent: this.callAgentFilter.value,
      course: this.callCourseFilter ? this.callCourseFilter.value : '',
      disposition: this.callDispositionFilter.value,
      dateRange: this.callDateRangeFilter.value,
      dateFrom: this.dateRangeFrom ? this.dateRangeFrom.value : '',
      dateTo: this.dateRangeTo ? this.dateRangeTo.value : '',
      sort: this.callSortFilter.value,
      tab: this.activeTab || 'calls'
    };

    this.visibleCalls = CallFilterEngine.apply(this.availableCalls, criteria);

    // Update Apple Metrics Widgets and Quick Buckets
    MetricsView.update(this.visibleCalls, this.availableCalls);

    // Update Result Header
    const hasFilters = Boolean(criteria.query || criteria.status || criteria.agent ||
      criteria.course || criteria.disposition || criteria.dateFrom || criteria.dateTo ||
      (criteria.dateRange && criteria.dateRange !== 'all'));

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
        const avatar = isAgent ? 'A' : 'C';

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
      call.phone ? 'Phone: ' + call.phone : ''
    ].filter(Boolean).join(' · ');

    const rawDisp = (call.disposition || '').trim();
    DOM.byId('summaryModalDispBadge').innerHTML = `
      <div style="display:flex;align-items:center;gap:10px;">
        <strong style="font-size:0.85rem;color:var(--apple-label-secondary);">Outcome:</strong>
        <span class="disp-badge">${DOM.safe(rawDisp || 'Completed')}</span>
      </div>
    `;

    DOM.byId('summaryModalText').textContent = typeof call.summary === 'string'
      ? call.summary
      : JSON.stringify(call.summary, null, 2);

    this.summaryModal.hidden = false;
    document.body.style.overflow = 'hidden';
  }

  exportExcel() {
    if (!this.visibleCalls.length) {
      alert('No call records to export.');
      return;
    }

    const xmlEscape = (str) => {
      return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
    };

    const headers = [
      'Date & Time',
      'Call ID',
      'Agent',
      'From Number',
      'To Number',
      'Call Type',
      'Status',
      'Disposition',
      'Duration (sec)',
      'Cost',
      'Monthly Turnover',
      'Fund Required',
      'Nature of Business',
      'AI Summary',
      'Recording URL'
    ];

    const rowsXml = this.visibleCalls.map(c => {
      const dateFormatted = TableView.formatDate(c.created_at || c.ended_at);
      const dur = Number(c.duration) || 0;
      const disp = c.disposition || '—';

      return `
    <Row ss:AutoFitHeight="0" ss:Height="22">
      <Cell ss:StyleID="DateStyle"><Data ss:Type="String">${xmlEscape(dateFormatted)}</Data></Cell>
      <Cell ss:StyleID="MonoStyle"><Data ss:Type="String">${xmlEscape(c.snapserve_call_id || c.id || '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.agent_name || c.agent_id || 'MR Fin Tamil')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.from_number || '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.to_number || c.phone || '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.call_type || 'Live Call')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.status || 'completed')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(disp)}</Data></Cell>
      <Cell ss:StyleID="NumberStyle"><Data ss:Type="Number">${dur}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.cost || '—')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.monthly_turnover || '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.fund_required || '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.nature_of_business || '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(typeof c.summary === 'string' ? c.summary : '')}</Data></Cell>
      <Cell ss:StyleID="Default"><Data ss:Type="String">${xmlEscape(c.recording_url || '')}</Data></Cell>
    </Row>`;
    }).join('\n');

    const xmlTemplate = `<?xml version="1.0" encoding="UTF-8"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <DocumentProperties xmlns="urn:schemas-microsoft-com:office:office">
  <Title>SnapServe Call Records</Title>
  <Author>SnapServe Voice Intelligence</Author>
  <Created>${new Date().toISOString()}</Created>
 </DocumentProperties>
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5EA"/>
   </Borders>
   <Font ss:FontName="Segoe UI, -apple-system, sans-serif" ss:Size="10" ss:Color="#1D1D1F"/>
  </Style>
  <Style ss:ID="Header">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="2" ss:Color="#000000"/>
   </Borders>
   <Font ss:FontName="Segoe UI, -apple-system, sans-serif" ss:Size="10" ss:Bold="1" ss:Color="#FFFFFF"/>
   <Interior ss:Color="#1D1D1F" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="DateStyle">
   <Alignment ss:Horizontal="Center" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5EA"/></Borders>
   <Font ss:FontName="Segoe UI, -apple-system, sans-serif" ss:Size="10" ss:Color="#6E6E73"/>
  </Style>
  <Style ss:ID="MonoStyle">
   <Alignment ss:Horizontal="Left" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5EA"/></Borders>
   <Font ss:FontName="SF Mono, Consolas, monospace" ss:Size="9" ss:Color="#0071E3"/>
  </Style>
  <Style ss:ID="NumberStyle">
   <Alignment ss:Horizontal="Right" ss:Vertical="Center"/>
   <Borders><Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1" ss:Color="#E5E5EA"/></Borders>
   <Font ss:FontName="Segoe UI, -apple-system, sans-serif" ss:Size="10" ss:Bold="1" ss:Color="#1D1D1F"/>
   <NumberFormat ss:Format="#,##0"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Call Records">
  <Table ss:DefaultRowHeight="20">
   <Column ss:Width="130"/>
   <Column ss:Width="130"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="110"/>
   <Column ss:Width="90"/>
   <Column ss:Width="90"/>
   <Column ss:Width="150"/>
   <Column ss:Width="90"/>
   <Column ss:Width="80"/>
   <Column ss:Width="120"/>
   <Column ss:Width="120"/>
   <Column ss:Width="150"/>
   <Column ss:Width="260"/>
   <Column ss:Width="180"/>
   <Row ss:AutoFitHeight="0" ss:Height="26">
    ${headers.map(h => `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`).join('')}
   </Row>
   ${rowsXml}
  </Table>
 </Worksheet>
</Workbook>`;

    const blob = new Blob([xmlTemplate], { type: 'application/vnd.ms-excel;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `call_records_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  exportCsv() {
    if (!this.visibleCalls.length) {
      alert('No call records to export.');
      return;
    }

    const headers = [
      'Date & Time',
      'Call ID',
      'Agent',
      'From Number',
      'To Number',
      'Call Type',
      'Status',
      'Disposition',
      'Duration (sec)',
      'Cost',
      'Monthly Turnover',
      'Fund Required',
      'Nature of Business',
      'Summary',
      'Recording URL'
    ];

    const rows = this.visibleCalls.map(c => {
      return [
        TableView.formatDate(c.created_at || c.ended_at),
        c.snapserve_call_id || c.id || '',
        c.agent_name || c.agent_id || 'MR Fin Tamil',
        c.from_number || '',
        c.to_number || c.phone || '',
        c.call_type || 'Live Call',
        c.status || 'completed',
        c.disposition || '—',
        c.duration || 0,
        c.cost || '',
        c.monthly_turnover || '',
        c.fund_required || '',
        c.nature_of_business || '',
        typeof c.summary === 'string' ? c.summary.replace(/[\r\n]+/g, ' ') : '',
        c.recording_url || ''
      ];
    });

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `call_records_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

// Bootstrap on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  new CallRecordsApp();
});
