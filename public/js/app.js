/**
 * GCP-98 ANNUAL BATCH REUNION WEB APPLICATION
 * Client-Side Application Core
 */

const App = {
  currentUser: null,
  activeYear: 2026,
  activeEvent: null,
  activeTab: 'events',
  taskFilter: 'all',
  selectedContribId: null,
  currentHeroPhoto: '/assets/reunion-2026-family.jpg',


  // Initialize Application
  async init() {
    console.log('Initializing GCP-98 Batch Reunion App...');
    await this.loadDemoPersonas();
    await this.loadCurrentUser();
    await this.loadActiveEvent();
    this.setupEventListeners();
    this.startCountdownTimer();
    this.switchTab('events');
  },

  // Auth Headers helper
  getHeaders() {
    const headers = {};
    const token = localStorage.getItem('gcp98_token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    if (this.currentUser) {
      headers['x-user-id'] = this.currentUser.id;
    }
    return headers;
  },

  // Toast System
  showToast(message, type = 'normal') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : type === 'error' ? 'toast-error' : ''}`;
    
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span style="font-size: 1.1rem;">${icon}</span><div>${message}</div>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      setTimeout(() => toast.remove(), 250);
    }, 4000);
  },

  // Copy text utility
  async copyText(text, successMsg = 'Copied to clipboard!') {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast(successMsg, 'success');
    } catch (err) {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      this.showToast(successMsg, 'success');
    }
  },

  // Demo Persona Switcher
  async loadDemoPersonas() {
    try {
      const res = await fetch('/api/auth/demo-users');
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('demo-pills-container');
      if (!container) return;

      container.innerHTML = data.personas.map(p => {
        let label = p.name.split(' ')[0];
        let roleTag = 'Member';
        if (p.role === 'admin') roleTag = 'Admin';
        else if (p.role === 'accounts_volunteer') roleTag = 'Accounts Lead';
        else if (p.assigned_team_id === 'venue') roleTag = 'Venue Lead';
        else if (p.assigned_team_id === 'catering') roleTag = 'Catering Lead';

        const isActive = this.currentUser && this.currentUser.id === p.id;

        return `
          <button class="demo-pill-btn ${isActive ? 'active' : ''}" onclick="App.switchPersona('${p.id}')">
            <span>${p.avatar || '👤'}</span>
            <span>${label} (${roleTag})</span>
          </button>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load personas:', err);
    }
  },

  async switchPersona(userId) {
    try {
      const res = await fetch('/api/auth/switch-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId })
      });
      const data = await res.json();
      if (data.success) {
        localStorage.setItem('gcp98_token', data.token);
        this.currentUser = data.user;
        this.updateNavUser();
        await this.loadDemoPersonas();
        this.showToast(`Switched persona to ${data.user.name} (${data.user.role.toUpperCase()})`, 'success');
        this.refreshActiveTab();
      }
    } catch (err) {
      this.showToast('Failed to switch persona', 'error');
    }
  },

  toggleDemoSelector() {
    const banner = document.getElementById('demo-role-banner');
    if (banner) {
      banner.style.display = banner.style.display === 'none' ? 'flex' : 'none';
    }
  },

  async loadCurrentUser() {
    try {
      const res = await fetch('/api/auth/me', { headers: this.getHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.user) {
          this.currentUser = data.user;
          this.updateNavUser();
          return;
        }
      }
      // Default to Jeeva (Admin) for seamless testing
      await this.switchPersona('usr_jeeva_admin');
    } catch (err) {
      await this.switchPersona('usr_jeeva_admin');
    }
  },

  updateNavUser() {
    if (!this.currentUser) return;
    const nameEl = document.getElementById('nav-user-name');
    const roleEl = document.getElementById('nav-user-role');
    const avatarEl = document.getElementById('nav-user-avatar');
    const adminDesktopTab = document.getElementById('desktop-admin-tab');

    // Sidebar elements
    const sNameEl = document.getElementById('sidebar-user-name');
    const sRoleEl = document.getElementById('sidebar-user-role');
    const sAvatarEl = document.getElementById('sidebar-user-avatar');
    const sAdminItem = document.getElementById('sidebar-admin-item');
    const sAdminHeading = document.getElementById('sidebar-admin-heading');

    let roleText = this.currentUser.role.replace('_', ' ');
    if (this.currentUser.role === 'accounts_volunteer') roleText = 'Accounts Lead';
    const roleDisplay = roleText.toUpperCase();

    if (nameEl) nameEl.textContent = this.currentUser.name;
    if (roleEl) roleEl.textContent = roleDisplay;
    if (avatarEl) avatarEl.textContent = this.currentUser.avatar || '👤';

    if (sNameEl) sNameEl.textContent = this.currentUser.name;
    if (sRoleEl) sRoleEl.textContent = roleDisplay;
    if (sAvatarEl) sAvatarEl.textContent = this.currentUser.avatar || '👤';

    const isAdmin = this.currentUser.role === 'admin';
    if (adminDesktopTab) {
      adminDesktopTab.style.display = isAdmin ? 'inline-flex' : 'none';
    }
    if (sAdminItem) sAdminItem.style.display = isAdmin ? 'flex' : 'none';
    if (sAdminHeading) sAdminHeading.style.display = isAdmin ? 'block' : 'none';
  },

  // Toggle Left Sidebar (Drawer on mobile/tablet)
  toggleSidebar(forceState) {
    const sidebar = document.getElementById('left-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    if (!sidebar || !backdrop) return;

    const shouldOpen = forceState !== undefined ? forceState : !sidebar.classList.contains('open');
    sidebar.classList.toggle('open', shouldOpen);
    backdrop.classList.toggle('active', shouldOpen);
  },

  // Events & Year Switcher
  async handleYearChange(year) {
    this.activeYear = parseInt(year, 10);
    const select1 = document.getElementById('event-year-select');
    const select2 = document.getElementById('sidebar-year-select');
    if (select1) select1.value = year;
    if (select2) select2.value = year;

    // Toggle 2026 gallery card visibility on Events tab
    const memories2026 = document.getElementById('memories-2026-card');
    if (memories2026) {
      memories2026.style.display = (this.activeYear === 2026) ? 'block' : 'none';
    }

    await this.loadActiveEvent();
    this.refreshActiveTab();
  },

  async loadActiveEvent() {
    try {
      const res = await fetch(`/api/events/active?year=${this.activeYear}`);
      const data = await res.json();
      if (data.success && data.event) {
        this.activeEvent = data.event;
        this.renderHero(data.event);
      }
    } catch (err) {
      console.error('Failed to load event:', err);
    }
  },

  renderHero(event) {
    const titleEl = document.getElementById('hero-title');
    const themeEl = document.getElementById('hero-theme');
    const statusEl = document.getElementById('hero-event-status');
    const datesEl = document.getElementById('hero-dates');
    const venueEl = document.getElementById('hero-venue');
    const feeEl = document.getElementById('hero-fee');
    const rsvpBtn = document.getElementById('hero-rsvp-btn');
    const pollBtn = document.getElementById('hero-poll-btn');
    const heroImg = document.getElementById('hero-img');
    const photoSwitcher = document.getElementById('hero-photo-switcher');

    // Dynamic Hero Banner Image based on active Year
    if (heroImg) {
      if (event.year === 2026) {
        heroImg.src = this.currentHeroPhoto || '/assets/reunion-2026-family.jpg';
        if (photoSwitcher) photoSwitcher.style.display = 'flex';
      } else if (event.year === 2025) {
        heroImg.src = '/assets/archive-2024.jpg';
        if (photoSwitcher) photoSwitcher.style.display = 'none';
      } else {
        heroImg.src = '/assets/banner.jpg';
        if (photoSwitcher) photoSwitcher.style.display = 'none';
      }
    }

    if (titleEl) titleEl.textContent = event.title;
    if (themeEl) themeEl.textContent = `✨ "${event.theme || 'GCP Batch of 98 Batch Day'}"`;
    if (statusEl) {
      if (event.status === 'completed' || (event.year === 2026 && event.status !== 'planning')) {
        statusEl.textContent = '● Completed on Oct 11, 2026 (Trichy)';
        statusEl.className = 'badge badge-emerald';
      } else if (event.status === 'planning') {
        statusEl.textContent = '● Planning Phase (October 2027)';
        statusEl.className = 'badge badge-gold';
      } else if (event.status === 'archived') {
        statusEl.textContent = '● Archived Edition';
        statusEl.className = 'badge badge-sky';
      } else {
        statusEl.textContent = '● Active Batch Day';
        statusEl.className = 'badge badge-gold';
      }
    }
    if (datesEl) datesEl.textContent = event.dates_display || 'TBD';
    if (venueEl) venueEl.textContent = `${event.venue_name || 'TBD'}, ${event.venue_location || ''}`;
    if (feeEl) feeEl.textContent = event.fee_per_member ? `₹${event.fee_per_member.toLocaleString()} / Member` : 'TBD';

    if (event.year === 2026) {
      if (rsvpBtn) rsvpBtn.textContent = '📜 View 2026 Attendance Register';
      if (pollBtn) pollBtn.textContent = '🗳️ View 2026 Decision';
    } else if (event.year === 2027) {
      if (rsvpBtn) rsvpBtn.textContent = '🎟️ Submit 2027 RSVP';
      if (pollBtn) pollBtn.textContent = '🗳️ Vote on October 2027 Dates';
    } else {
      if (rsvpBtn) rsvpBtn.textContent = '📜 View Archived Attendance';
      if (pollBtn) pollBtn.textContent = '🗳️ View Poll History';
    }

    if (this.updateTimerFn) {
      this.updateTimerFn();
    }
  },

  // Switch between 2026 Hero Banner Photos
  switchHeroPhoto(type) {
    const heroImg = document.getElementById('hero-img');
    const btnFamily = document.getElementById('btn-hero-family');
    const btnBatch = document.getElementById('btn-hero-batchmates');
    if (!heroImg) return;

    if (type === 'batchmates') {
      this.currentHeroPhoto = '/assets/reunion-2026-batchmates.jpg';
      heroImg.src = this.currentHeroPhoto;
      if (btnFamily) btnFamily.classList.remove('active');
      if (btnBatch) btnBatch.classList.add('active');
      this.showToast('Switched to Batchmates Photo', 'normal');
    } else {
      this.currentHeroPhoto = '/assets/reunion-2026-family.jpg';
      heroImg.src = this.currentHeroPhoto;
      if (btnFamily) btnFamily.classList.add('active');
      if (btnBatch) btnBatch.classList.remove('active');
      this.showToast('Switched to Family & Batch Photo', 'normal');
    }
  },

  // Open Lightbox for the currently active Hero Photo
  openCurrentHeroPhoto() {
    const heroImg = document.getElementById('hero-img');
    const src = (heroImg && heroImg.src) ? heroImg.src : '/assets/reunion-2026-family.jpg';
    const isBatch = src.includes('batchmates');
    const title = isBatch ? 'GCP-98 Batchmates Reunion 2026' : 'GCP-98 Alumni & Families Reunion 2026';
    const caption = isBatch
      ? 'Alumni of Government College of Physiotherapy (GCP) Batch of 1998 standing side-by-side at Mullai Resort, Trichy.'
      : 'Full reunion celebration of batchmates, spouses, and kids seated and standing together at Mullai Resort, Trichy.';
    this.openPhotoModal(src, title, caption);
  },

  // Full-Screen Lightbox Photo Modal
  openPhotoModal(src, title, caption) {
    const modal = document.getElementById('modal-photo-viewer');
    const img = document.getElementById('photo-viewer-img');
    const titleEl = document.getElementById('photo-viewer-title');
    const capEl = document.getElementById('photo-viewer-caption');
    const downloadEl = document.getElementById('photo-viewer-download');
    if (!modal) return;

    if (img) img.src = src;
    if (titleEl) {
      titleEl.innerHTML = `<span>📸</span> <span>${title || 'Reunion Celebration Photo'}</span>`;
    }
    if (capEl) capEl.textContent = caption || '';
    if (downloadEl) {
      downloadEl.href = src;
      downloadEl.download = (title ? title.toLowerCase().replace(/[^a-z0-9]/g, '-') : 'reunion-photo') + '.jpg';
    }
    modal.classList.add('show');
  },

  closePhotoModal() {
    const modal = document.getElementById('modal-photo-viewer');
    if (modal) modal.classList.remove('show');
  },


  startCountdownTimer() {
    const countdownEl = document.getElementById('hero-countdown');
    const sidebarCountdown = document.getElementById('sidebar-countdown');
    const sidebarCountdownSub = document.getElementById('sidebar-countdown-sub');

    const updateTimer = () => {
      const event = this.activeEvent;
      if (!event) return;

      if (event.year === 2026 || event.status === 'completed') {
        const text = '🏆 Concluded on Oct 11, 2026';
        if (countdownEl) countdownEl.textContent = text;
        if (sidebarCountdown) sidebarCountdown.textContent = 'Completed';
        if (sidebarCountdownSub) sidebarCountdownSub.textContent = 'Oct 11, 2026 • Mullai Resort, Trichy';
        return;
      }

      if (event.status === 'archived') {
        const text = `🏛️ Concluded (${event.year})`;
        if (countdownEl) countdownEl.textContent = text;
        if (sidebarCountdown) sidebarCountdown.textContent = 'Archived';
        if (sidebarCountdownSub) sidebarCountdownSub.textContent = `${event.dates_display} • ${event.venue_location}`;
        return;
      }

      // Planning / Future event (e.g. 2027 in October)
      const targetDateStr = event.start_date || '2027-10-09';
      const targetDate = new Date(`${targetDateStr}T10:00:00+05:30`).getTime();
      const now = new Date().getTime();
      const diff = targetDate - now;

      if (sidebarCountdownSub) {
        sidebarCountdownSub.textContent = `${event.dates_display} • ${event.venue_location || 'Trichy'}`;
      }

      if (diff <= 0) {
        const text = '🎉 Batch Day In Session!';
        if (countdownEl) countdownEl.textContent = text;
        if (sidebarCountdown) sidebarCountdown.textContent = text;
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      const str = `${days}d : ${hours}h : ${minutes}m left`;
      if (countdownEl) countdownEl.textContent = str;
      if (sidebarCountdown) sidebarCountdown.textContent = str;
    };

    this.updateTimerFn = updateTimer;
    updateTimer();
    setInterval(updateTimer, 60000);
  },

  // Navigation & Tab Switching
  switchTab(tabId) {
    this.activeTab = tabId;

    const titleMap = {
      events: '🗓️ Events & Date Polls',
      rsvp: '🎟️ My RSVP & Meal Preferences',
      teams: '👥 6 Volunteer Committee Teams',
      tasks: '📋 Tasks & Volunteer Deadlines',
      quotes: '📑 Vendor Quotations & Bids',
      finance: '💰 Treasury, Verified Ledger & Expenses',
      announcements: '📢 Announcements & Scheduled Reminders',
      archives: '🏛️ Annual Archives & Retrospective',
      reports: '📊 Exportable Attendance & Audit Reports',
      admin: '⚙️ Administrator Control Center'
    };

    // Update Top Breadcrumbs Title
    const breadcrumbTitle = document.getElementById('top-bar-page-title');
    if (breadcrumbTitle) {
      breadcrumbTitle.textContent = titleMap[tabId] || tabId;
    }

    // Update desktop nav buttons
    document.querySelectorAll('.desktop-nav .nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update Left Sidebar Navigation Items
    document.querySelectorAll('.sidebar-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Update mobile bottom nav buttons
    document.querySelectorAll('.mobile-bottom-nav .mobile-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });

    // Auto-close sidebar on mobile if open
    if (window.innerWidth < 1024) {
      this.toggleSidebar(false);
    }

    // Show active section
    document.querySelectorAll('.section').forEach(sec => {
      sec.classList.remove('active');
    });

    const activeSec = document.getElementById(`tab-${tabId}`);
    if (activeSec) {
      activeSec.classList.add('active');
    }

    // Load data for specific tab
    this.refreshActiveTab();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  refreshActiveTab() {
    switch (this.activeTab) {
      case 'events':
        this.loadPolls();
        this.loadAllEvents();
        break;
      case 'rsvp':
        this.loadRsvpData();
        break;
      case 'teams':
        this.loadTeams();
        break;
      case 'tasks':
        this.loadTasks();
        break;
      case 'quotes':
        this.loadQuotations();
        break;
      case 'finance':
        this.loadFinanceSummary();
        this.loadContributions();
        this.loadExpenses();
        break;
      case 'announcements':
        this.loadAnnouncements();
        this.loadScheduledReminders();
        break;
      case 'archives':
        break;
      case 'reports':
        break;
      case 'admin':
        this.loadAdminDashboard();
        break;
    }
  },

  // ========================================================================
  // SECTION 1: DATE POLLS & MULTI-YEAR EVENTS
  // ========================================================================
  async loadPolls() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/polls?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('polls-container');
      if (!container) return;

      if (!data.polls || data.polls.length === 0) {
        container.innerHTML = `
          <div class="glass-card" style="text-align: center; padding: 30px;">
            <p style="color: var(--text-muted);">No date polls are currently active for this event.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.polls.map(poll => {
        const isFinalized = poll.status === 'finalized';
        const totalVotes = poll.options.reduce((sum, o) => sum + (o.yes_count || 0), 0);

        return `
          <div class="glass-card mb-12">
            <div class="flex-between mb-12">
              <div>
                <span class="badge ${isFinalized ? 'badge-emerald' : 'badge-gold'}">
                  ${isFinalized ? '✅ Dates Finalized' : '🗳️ Active Poll (Voting Open)'}
                </span>
                <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; color: #fff; margin-top: 6px;">
                  ${poll.title}
                </h3>
                <p style="font-size: 0.82rem; color: var(--text-muted);">${poll.description || ''}</p>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Total Ballots</div>
                <div style="font-size: 1.2rem; font-weight: 800; color: var(--accent-gold);">${totalVotes} Votes</div>
              </div>
            </div>

            <!-- Poll Options -->
            <div class="poll-options-list">
              ${poll.options.map(opt => {
                const yesCount = opt.yes_count || 0;
                const percent = totalVotes > 0 ? Math.round((yesCount / totalVotes) * 100) : 0;
                const hasVotedThis = poll.votes.some(v => v.option_id === opt.id && v.user_id === (this.currentUser ? this.currentUser.id : ''));
                const isFinalizedChoice = poll.finalized_option_id === opt.id;

                return `
                  <div class="poll-option-card ${hasVotedThis ? 'voted' : ''}">
                    <div class="poll-header-row">
                      <div>
                        <div class="poll-option-title">
                          ${opt.option_text}
                          ${isFinalizedChoice ? '<span class="badge badge-emerald" style="margin-left: 6px;">Winning Choice</span>' : ''}
                        </div>
                        <div class="poll-option-sub">📍 ${opt.location_hint} • 📅 ${opt.dates_hint}</div>
                      </div>
                      <div style="text-align: right;">
                        <span style="font-weight: 800; font-size: 1rem; color: var(--accent-gold);">${yesCount}</span>
                        <span style="font-size: 0.75rem; color: var(--text-muted);"> (${percent}%)</span>
                      </div>
                    </div>

                    <div class="poll-progress-bar">
                      <div class="poll-progress-fill" style="width: ${percent}%;"></div>
                    </div>

                    <div class="poll-footer-row">
                      <div>
                        ${hasVotedThis ? '<span style="color: #34d399; font-weight: 700;">✓ You voted for this</span>' : ''}
                      </div>
                      <div style="display: flex; gap: 8px;">
                        ${!isFinalized ? `
                          <button class="btn btn-sm ${hasVotedThis ? 'btn-emerald' : 'btn-secondary'}" onclick="App.castPollVote('${poll.id}', '${opt.id}')">
                            ${hasVotedThis ? 'Voted' : 'Vote For This Date'}
                          </button>
                        ` : ''}

                        ${(!isFinalized && this.canFinalizePoll()) ? `
                          <button class="btn btn-sm btn-primary" onclick="App.finalizePollDate('${poll.id}', '${opt.id}')" title="Lock this date as the official reunion date">
                            🔒 Finalize Date
                          </button>
                        ` : ''}
                      </div>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load polls:', err);
    }
  },

  canFinalizePoll() {
    if (!this.currentUser) return false;
    return this.currentUser.role === 'admin' || this.currentUser.role === 'coordinator';
  },

  async castPollVote(pollId, optionId) {
    try {
      const res = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ pollId, optionId, voteChoice: 'yes' })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Your vote has been recorded!', 'success');
        this.loadPolls();
      } else {
        this.showToast(data.error || 'Failed to record vote', 'error');
      }
    } catch (err) {
      this.showToast('Failed to cast vote', 'error');
    }
  },

  async finalizePollDate(pollId, optionId) {
    if (!confirm('Are you sure you want to finalize this date as the official reunion schedule? This will update the main event dates.')) {
      return;
    }
    try {
      const res = await fetch(`/api/polls/${pollId}/finalize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ optionId })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        await this.loadActiveEvent();
        this.loadPolls();
      } else {
        this.showToast(data.error || 'Failed to finalize date', 'error');
      }
    } catch (err) {
      this.showToast('Failed to finalize date', 'error');
    }
  },

  async loadAllEvents() {
    try {
      const res = await fetch('/api/events');
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('all-events-grid');
      if (!container) return;

      container.innerHTML = data.events.map(e => `
        <div class="glass-card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="flex-between mb-12">
              <span class="badge ${e.status === 'active' ? 'badge-gold' : (e.status === 'archived' ? 'badge-emerald' : 'badge-sky')}">
                ${e.status.toUpperCase()}
              </span>
              <span style="font-weight: 800; font-family: var(--font-heading); color: var(--accent-gold);">${e.year}</span>
            </div>
            <h4 style="font-family: var(--font-heading); font-size: 1.1rem; font-weight: 700; color: #fff;">${e.title}</h4>
            <p style="font-size: 0.8rem; color: var(--text-muted); margin: 6px 0 12px;">📍 ${e.venue_name}, ${e.venue_location}</p>
            <div style="font-size: 0.78rem; color: var(--text-dim);">
              Attendees: <strong>${e.stats.attending_count}</strong> • Treasury: <strong>₹${e.stats.verified_funds.toLocaleString()}</strong>
            </div>
          </div>
          <div style="margin-top: 14px;">
            <button class="btn btn-sm btn-secondary btn-block" onclick="App.handleYearChange(${e.year})">
              Switch to ${e.year} View
            </button>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load all events:', err);
    }
  },

  // ========================================================================
  // SECTION 2: RSVP & GUEST MANAGEMENT
  // ========================================================================
  async loadRsvpData() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/rsvps?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const { summary, rsvps } = data;

      // Update aggregate cards
      const metricsContainer = document.getElementById('rsvp-summary-metrics');
      if (metricsContainer && summary) {
        metricsContainer.innerHTML = `
          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-title">Confirmed Attendees</span>
              <span class="stat-icon">👥</span>
            </div>
            <div class="stat-value text-gold">${summary.attending_members || 0}</div>
            <div class="stat-sub">Total Headcount: ${summary.total_attending_headcount || 0} (Adults: ${summary.total_adult_guests || 0}, Kids: ${summary.total_kids_count || 0})</div>
          </div>

          <div class="stat-card stat-emerald">
            <div class="stat-header">
              <span class="stat-title">Catering Breakdown</span>
              <span class="stat-icon">🍽️</span>
            </div>
            <div class="stat-value text-emerald">
              ${(summary.veg_meals || 0) + (summary.non_veg_meals || 0)} Meals
            </div>
            <div class="stat-sub">Veg: ${summary.veg_meals || 0} • Non-Veg: ${summary.non_veg_meals || 0} • Jain: ${summary.jain_meals || 0} • Kids: ${summary.kids_meals || 0}</div>
          </div>

          <div class="stat-card stat-sky">
            <div class="stat-header">
              <span class="stat-title">Resort Rooms Needed</span>
              <span class="stat-icon">🏨</span>
            </div>
            <div class="stat-value" style="color: #38bdf8;">${summary.rooms_needed || 0} Rooms</div>
            <div class="stat-sub">${summary.tentative_members || 0} members pending confirmation</div>
          </div>
        `;
      }

      // Update hero counter
      const heroCounter = document.getElementById('hero-rsvp-counter');
      if (heroCounter && summary) {
        heroCounter.textContent = `${summary.total_attending_headcount || 0} Confirmed Attendees`;
      }

      // Load current user RSVP
      await this.loadMyRsvp();

      // Render attendees table
      const tbody = document.getElementById('attendees-table-body');
      if (tbody) {
        if (!rsvps.length) {
          tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted);">No RSVPs submitted yet.</td></tr>`;
          return;
        }

        tbody.innerHTML = rsvps.map(r => `
          <tr>
            <td>
              <div style="display: flex; align-items: center; gap: 8px;">
                <span style="font-size: 1.2rem;">${r.member_avatar || '🎓'}</span>
                <div>
                  <div style="font-weight: 700; color: #fff;">${r.member_name}</div>
                  <div style="font-size: 0.72rem; color: var(--text-dim);">${r.member_city || ''}</div>
                </div>
              </div>
            </td>
            <td>
              <span class="badge ${r.status === 'attending' ? 'badge-emerald' : (r.status === 'tentative' ? 'badge-gold' : 'badge-rose')}">
                ${r.status.toUpperCase()}
              </span>
            </td>
            <td>
              <strong>${r.total_headcount}</strong>
              <span style="font-size: 0.72rem; color: var(--text-muted);"> (1 + ${r.adult_guests} + ${r.kids_count}k)</span>
            </td>
            <td>
              <span style="text-transform: capitalize; font-weight: 600;">${r.meal_preference.replace('_', ' ')}</span>
            </td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">${r.dietary_notes || '—'}</td>
            <td>${r.accommodation_needed ? '🏨 Yes' : 'No'}</td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">${r.travel_mode || r.arrival_date || '—'}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load RSVP data:', err);
    }
  },

  async loadMyRsvp() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/rsvps/me?eventId=${eventId}`, { headers: this.getHeaders() });
      const data = await res.json();

      const container = document.getElementById('my-rsvp-card');
      if (!container) return;

      if (data.rsvp) {
        const r = data.rsvp;
        container.innerHTML = `
          <div class="flex-between">
            <div>
              <span class="badge ${r.status === 'attending' ? 'badge-emerald' : 'badge-gold'}">
                Your Status: ${r.status.toUpperCase()}
              </span>
              <h3 style="font-family: var(--font-heading); font-size: 1.25rem; font-weight: 800; color: #fff; margin-top: 6px;">
                You are registered with ${r.total_headcount} attendee${r.total_headcount > 1 ? 's' : ''}!
              </h3>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
                Meal: <strong>${r.meal_preference.toUpperCase()}</strong> • Hotel Room: <strong>${r.accommodation_needed ? 'Reserved' : 'Not Requested'}</strong>
                ${r.dietary_notes ? ` • Note: <em>"${r.dietary_notes}"</em>` : ''}
              </p>
            </div>
            <div>
              <button class="btn btn-secondary btn-sm" onclick="App.openRsvpModal()">
                ✏️ Edit RSVP
              </button>
            </div>
          </div>
        `;
      } else {
        container.innerHTML = `
          <div class="flex-between">
            <div>
              <h3 style="font-family: var(--font-heading); font-size: 1.2rem; font-weight: 700; color: #fff;">
                You haven't submitted your RSVP yet!
              </h3>
              <p style="font-size: 0.82rem; color: var(--text-muted); margin-top: 2px;">
                Please let the Hospitality & Catering teams know if you're coming to Goa with family.
              </p>
            </div>
            <button class="btn btn-primary" onclick="App.openRsvpModal()">
              Confirm RSVP Now
            </button>
          </div>
        `;
      }
    } catch (err) {
      console.error('Failed to load my RSVP:', err);
    }
  },

  openRsvpModal() {
    this.openModal('modal-rsvp');
  },

  async handleRsvpSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const status = document.getElementById('rsvp-status').value;
    const adultGuests = document.getElementById('rsvp-adults').value;
    const kidsCount = document.getElementById('rsvp-kids').value;
    const mealPreference = document.getElementById('rsvp-meal').value;
    const dietaryNotes = document.getElementById('rsvp-dietary').value;
    const accommodationNeeded = document.getElementById('rsvp-accommodation').checked;
    const arrivalDate = document.getElementById('rsvp-arrival').value;
    const departureDate = document.getElementById('rsvp-departure').value;
    const travelMode = document.getElementById('rsvp-travel').value;
    const notes = document.getElementById('rsvp-notes').value;

    try {
      const res = await fetch('/api/rsvps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({
          eventId,
          status,
          adultGuests,
          kidsCount,
          mealPreference,
          dietaryNotes,
          accommodationNeeded,
          arrivalDate,
          departureDate,
          travelMode,
          notes
        })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeModal('modal-rsvp');
        this.loadRsvpData();
      } else {
        this.showToast(data.error || 'Failed to save RSVP', 'error');
      }
    } catch (err) {
      this.showToast('Failed to submit RSVP', 'error');
    }
  },

  // ========================================================================
  // SECTION 3: SIX VOLUNTEER TEAMS (2 COORDINATORS EACH)
  // ========================================================================
  async loadTeams() {
    try {
      const res = await fetch('/api/teams');
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('teams-grid');
      if (!container) return;

      container.innerHTML = data.teams.map(team => {
        const c1 = team.coordinator_1;
        const c2 = team.coordinator_2;

        return `
          <div class="team-card">
            <div>
              <div class="team-header">
                <div class="team-icon-bubble">${team.icon || '👥'}</div>
                <div>
                  <h3 class="team-name">${team.name}</h3>
                  <p class="team-purpose">${team.purpose}</p>
                </div>
              </div>

              <!-- Two Designated Coordinators -->
              <div class="coordinators-section">
                <div class="coordinators-heading">Coordinators (2 Designated Leads)</div>

                <!-- Coordinator 1 -->
                ${c1 ? `
                  <div class="coordinator-item">
                    <div class="coord-details">
                      <span style="font-size: 1.1rem;">${c1.avatar || '👨‍💼'}</span>
                      <div>
                        <div class="coord-name">${c1.name}</div>
                        <div class="coord-title">${c1.profession || 'Coordinator'} • ${c1.city || ''}</div>
                      </div>
                    </div>
                    <div class="coord-actions">
                      ${c1.phone ? `<a href="tel:${c1.phone}" class="icon-action-btn" title="Call">📞</a>` : ''}
                      ${c1.whatsapp ? `<a href="https://wa.me/${c1.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="icon-action-btn wa" title="WhatsApp">💬</a>` : ''}
                    </div>
                  </div>
                ` : '<div style="font-size: 0.78rem; color: var(--text-dim);">Coordinator 1 not assigned</div>'}

                <!-- Coordinator 2 -->
                ${c2 ? `
                  <div class="coordinator-item">
                    <div class="coord-details">
                      <span style="font-size: 1.1rem;">${c2.avatar || '👩‍💼'}</span>
                      <div>
                        <div class="coord-name">${c2.name}</div>
                        <div class="coord-title">${c2.profession || 'Co-Lead'} • ${c2.city || ''}</div>
                      </div>
                    </div>
                    <div class="coord-actions">
                      ${c2.phone ? `<a href="tel:${c2.phone}" class="icon-action-btn" title="Call">📞</a>` : ''}
                      ${c2.whatsapp ? `<a href="https://wa.me/${c2.whatsapp.replace(/[^0-9]/g, '')}" target="_blank" class="icon-action-btn wa" title="WhatsApp">💬</a>` : ''}
                    </div>
                  </div>
                ` : '<div style="font-size: 0.78rem; color: var(--text-dim);">Coordinator 2 not assigned</div>'}
              </div>

              <!-- Metrics -->
              <div style="display: flex; justify-content: space-between; font-size: 0.78rem; color: var(--text-muted); margin-bottom: 12px;">
                <span>Active Tasks: <strong>${team.stats.total_tasks}</strong> (${team.stats.completed_tasks} done)</span>
                <span>Budget Cap: <strong>₹${(team.budget_allocation || 0).toLocaleString()}</strong></span>
              </div>
            </div>

            <div style="display: flex; gap: 8px; margin-top: 10px;">
              <button class="btn btn-secondary btn-sm btn-block" onclick="App.joinVolunteerTeam('${team.id}')">
                🤝 Join As Volunteer
              </button>
              ${this.currentUser && this.currentUser.role === 'admin' ? `
                <button class="btn btn-sm btn-secondary" onclick="App.openReassignModal('${team.id}', '${team.name}')" title="Reassign coordinators">
                  ⚙️
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load teams:', err);
    }
  },

  async joinVolunteerTeam(teamId) {
    try {
      const res = await fetch(`/api/teams/${teamId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() }
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadTeams();
      }
    } catch (err) {
      this.showToast('Failed to join team', 'error');
    }
  },

  async openReassignModal(teamId, teamName) {
    document.getElementById('reassign-team-id').value = teamId;
    document.getElementById('reassign-team-title').textContent = `Team: ${teamName}`;

    // Load users for select
    const res = await fetch('/api/admin/dashboard', { headers: this.getHeaders() });
    const data = await res.json();
    if (data.success) {
      const optHtml = data.users.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
      document.getElementById('coord-select-1').innerHTML = optHtml;
      document.getElementById('coord-select-2').innerHTML = optHtml;
      this.openModal('modal-reassign-coords');
    }
  },

  async handleSaveCoordinators(e) {
    e.preventDefault();
    const teamId = document.getElementById('reassign-team-id').value;
    const c1 = document.getElementById('coord-select-1').value;
    const c2 = document.getElementById('coord-select-2').value;

    try {
      const res = await fetch(`/api/teams/${teamId}/coordinators`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ coordinator_1_id: c1, coordinator_2_id: c2 })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeModal('modal-reassign-coords');
        this.loadTeams();
      }
    } catch (err) {
      this.showToast('Failed to update coordinators', 'error');
    }
  },

  // ========================================================================
  // SECTION 4: TASKS & DEADLINES
  // ========================================================================
  async loadTasks() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      let url = `/api/tasks?eventId=${eventId}`;

      if (this.taskFilter === 'urgent') url += '&priority=urgent';
      else if (this.taskFilter === 'mine') url += '&assignedToMe=true';
      else if (['todo', 'in_progress', 'completed'].includes(this.taskFilter)) url += `&status=${this.taskFilter}`;

      const res = await fetch(url, { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('tasks-container');
      if (!container) return;

      if (!data.tasks.length) {
        container.innerHTML = `
          <div class="glass-card" style="text-align: center; padding: 30px; grid-column: 1 / -1;">
            <p style="color: var(--text-muted);">No tasks match the selected filter.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.tasks.map(t => {
        const isDone = t.status === 'completed';

        return `
          <div class="glass-card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div class="flex-between mb-12">
                <span class="badge ${t.priority === 'urgent' ? 'badge-rose' : (t.priority === 'high' ? 'badge-gold' : 'badge-sky')}">
                  ${t.priority.toUpperCase()}
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px;">
                  ${t.team_icon} ${t.team_name}
                </span>
              </div>
              <h4 style="font-family: var(--font-heading); font-size: 1.05rem; font-weight: 700; color: #fff; text-decoration: ${isDone ? 'line-through' : 'none'};">
                ${t.title}
              </h4>
              <p style="font-size: 0.8rem; color: var(--text-muted); margin: 6px 0 12px; line-height: 1.4;">
                ${t.description || ''}
              </p>
            </div>

            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 10px;">
              <div class="flex-between" style="font-size: 0.78rem; margin-bottom: 10px;">
                <span style="color: var(--text-muted);">
                  Assignee: <strong style="color: #fff;">${t.assignee_name || 'Unassigned'}</strong>
                </span>
                <span style="color: ${t.priority === 'urgent' ? '#fb7185' : 'var(--accent-gold)'}; font-weight: 700;">
                  📅 Due ${t.due_date}
                </span>
              </div>

              <div style="display: flex; gap: 8px;">
                <select class="form-control btn-sm" onchange="App.updateTaskStatus('${t.id}', this.value)" style="font-size: 0.75rem;">
                  <option value="todo" ${t.status === 'todo' ? 'selected' : ''}>To Do</option>
                  <option value="in_progress" ${t.status === 'in_progress' ? 'selected' : ''}>In Progress</option>
                  <option value="review" ${t.status === 'review' ? 'selected' : ''}>In Review</option>
                  <option value="completed" ${t.status === 'completed' ? 'selected' : ''}>Completed</option>
                </select>
              </div>
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load tasks:', err);
    }
  },

  filterTasks(filter, btn) {
    this.taskFilter = filter;
    document.querySelectorAll('.active-filter').forEach(b => b.classList.remove('active-filter'));
    if (btn) btn.classList.add('active-filter');
    this.loadTasks();
  },

  async updateTaskStatus(taskId, status) {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ status })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Task status updated', 'success');
        this.loadTasks();
      } else {
        this.showToast(data.error || 'Failed to update task', 'error');
      }
    } catch (err) {
      this.showToast('Failed to update task', 'error');
    }
  },

  async openCreateTaskModal() {
    // Populate user assignees
    try {
      const res = await fetch('/api/admin/dashboard', { headers: this.getHeaders() });
      const data = await res.json();
      if (data.success) {
        const select = document.getElementById('task-assignee');
        select.innerHTML = '<option value="">Unassigned</option>' +
          data.users.map(u => `<option value="${u.id}">${u.name} (${u.role})</option>`).join('');
      }
    } catch (e) {}

    this.openModal('modal-create-task');
  },

  async handleTaskSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const teamId = document.getElementById('task-team').value;
    const title = document.getElementById('task-title').value;
    const description = document.getElementById('task-desc').value;
    const assignedTo = document.getElementById('task-assignee').value;
    const priority = document.getElementById('task-priority').value;
    const dueDate = document.getElementById('task-deadline').value;

    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ eventId, teamId, title, description, assignedTo, priority, dueDate })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Task added successfully', 'success');
        this.closeModal('modal-create-task');
        this.loadTasks();
      } else {
        this.showToast(data.error || 'Failed to create task', 'error');
      }
    } catch (err) {
      this.showToast('Failed to create task', 'error');
    }
  },

  // ========================================================================
  // SECTION 5: QUOTATIONS / VENDOR BIDS
  // ========================================================================
  async loadQuotations() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/quotes?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('quotes-container');
      if (!container) return;

      if (!data.quotations.length) {
        container.innerHTML = `
          <div class="glass-card" style="text-align: center; padding: 30px; grid-column: 1 / -1;">
            <p style="color: var(--text-muted);">No vendor quotations uploaded yet.</p>
          </div>
        `;
        return;
      }

      container.innerHTML = data.quotations.map(q => {
        const isApproved = q.status === 'approved';
        const isRejected = q.status === 'rejected';

        return `
          <div class="glass-card" style="margin-bottom: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div class="flex-between mb-12">
                <span class="badge ${isApproved ? 'badge-emerald' : (isRejected ? 'badge-rose' : 'badge-gold')}">
                  ${q.status.toUpperCase()}
                </span>
                <span style="font-size: 0.75rem; color: var(--text-muted);">
                  ${q.team_icon} ${q.category.toUpperCase()}
                </span>
              </div>

              <h4 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: #fff;">
                ${q.vendor_name}
              </h4>
              <div style="font-size: 1.35rem; font-weight: 800; font-family: var(--font-heading); color: var(--accent-gold); margin: 6px 0;">
                ₹${q.amount.toLocaleString()}
              </div>
              <p style="font-size: 0.8rem; color: var(--text-muted); line-height: 1.4;">${q.notes || ''}</p>

              ${q.rejection_reason ? `
                <div style="font-size: 0.75rem; color: #fb7185; margin-top: 6px;">Reason: ${q.rejection_reason}</div>
              ` : ''}
            </div>

            <div style="border-top: 1px solid var(--border-subtle); padding-top: 12px; margin-top: 14px;">
              <div class="flex-between" style="font-size: 0.75rem; color: var(--text-dim); margin-bottom: 10px;">
                <span>By: ${q.submitter_name || 'Volunteer'}</span>
                ${q.file_name ? `<span style="color: var(--accent-gold);">📎 ${q.file_name}</span>` : ''}
              </div>

              ${q.status === 'pending' ? `
                <div style="display: flex; gap: 8px;">
                  <button class="btn btn-emerald btn-sm btn-block" onclick="App.approveQuotation('${q.id}')">
                    ✓ Approve Quote
                  </button>
                  <button class="btn btn-danger btn-sm" onclick="App.rejectQuotation('${q.id}')">
                    ✕ Reject
                  </button>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load quotes:', err);
    }
  },

  openUploadQuoteModal() {
    this.openModal('modal-quote');
  },

  async handleQuoteSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const form = document.getElementById('form-quote');
    const formData = new FormData();

    formData.append('eventId', eventId);
    formData.append('teamId', document.getElementById('quote-team').value);
    formData.append('vendorName', document.getElementById('quote-vendor').value);
    formData.append('category', document.getElementById('quote-category').value);
    formData.append('amount', document.getElementById('quote-amount').value);
    formData.append('notes', document.getElementById('quote-notes').value);

    const fileInput = document.getElementById('quote-file');
    if (fileInput.files.length) {
      formData.append('quoteFile', fileInput.files[0]);
    }

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Quotation uploaded successfully', 'success');
        this.closeModal('modal-quote');
        this.loadQuotations();
      } else {
        this.showToast(data.error || 'Failed to upload quotation', 'error');
      }
    } catch (err) {
      this.showToast('Failed to upload quotation', 'error');
    }
  },

  async approveQuotation(quoteId) {
    if (!confirm('Approve this vendor quotation?')) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() }
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadQuotations();
      } else {
        this.showToast(data.error || 'Approval failed', 'error');
      }
    } catch (err) {
      this.showToast('Approval failed', 'error');
    }
  },

  async rejectQuotation(quoteId) {
    const reason = prompt('Please enter reason for rejecting this bid:');
    if (reason === null) return;

    try {
      const res = await fetch(`/api/quotes/${quoteId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadQuotations();
      } else {
        this.showToast(data.error || 'Rejection failed', 'error');
      }
    } catch (err) {
      this.showToast('Rejection failed', 'error');
    }
  },

  // ========================================================================
  // SECTION 6: TREASURY, CONTRIBUTIONS & STRICT ACCOUNTS VERIFICATION
  // ========================================================================
  async loadFinanceSummary() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/finance/summary?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const s = data.summary;
      const container = document.getElementById('treasury-card');
      if (!container) return;

      container.innerHTML = `
        <div class="treasury-row">
          <div class="treasury-stat-box">
            <span class="treasury-label">Target Budget</span>
            <span class="treasury-amount">₹${s.targetBudget.toLocaleString()}</span>
          </div>
          <div class="treasury-stat-box">
            <span class="treasury-label">Verified Collections</span>
            <span class="treasury-amount amount-emerald">₹${s.verifiedTotal.toLocaleString()}</span>
            <span style="font-size: 0.72rem; color: #34d399;">(${s.verifiedCount} batchmates verified)</span>
          </div>
          <div class="treasury-stat-box">
            <span class="treasury-label">Pending Verification</span>
            <span class="treasury-amount amount-gold">₹${s.pendingTotal.toLocaleString()}</span>
            <span style="font-size: 0.72rem; color: var(--accent-gold);">(${s.pendingCount} awaiting Accounts)</span>
          </div>
          <div class="treasury-stat-box">
            <span class="treasury-label">Total Expenses</span>
            <span class="treasury-amount amount-rose">₹${s.totalExpenses.toLocaleString()}</span>
          </div>
          <div class="treasury-stat-box">
            <span class="treasury-label">Net Cash in Escrow</span>
            <span class="treasury-amount" style="color: #38bdf8;">₹${s.netBalance.toLocaleString()}</span>
          </div>
        </div>

        <div class="budget-progress-track">
          <div class="budget-progress-bar" style="width: ${s.fundingPercent}%;"></div>
        </div>
        <div class="flex-between mt-12" style="font-size: 0.75rem; color: var(--text-muted);">
          <span>Funded: <strong>${s.fundingPercent}%</strong> of Target Budget</span>
          <span>Per Member Standard Fee: <strong>₹${s.feePerMember.toLocaleString()}</strong></span>
        </div>
      `;

      // Update badge
      const heroTreasury = document.getElementById('hero-accounts-badge');
      if (heroTreasury) {
        heroTreasury.textContent = `Verified Treasury: ₹${s.verifiedTotal.toLocaleString()}`;
      }

      const pendingBadge = document.getElementById('pending-verification-badge');
      if (pendingBadge) {
        pendingBadge.textContent = `${s.pendingCount} Pending Verification`;
      }
    } catch (err) {
      console.error('Failed to load finance summary:', err);
    }
  },

  async loadContributions() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/finance/contributions?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('contributions-table-body');
      if (!tbody) return;

      if (!data.contributions.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No payment records found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.contributions.map(c => {
        const isVerified = c.status === 'verified';
        const isPending = c.status === 'pending';
        const isRejected = c.status === 'rejected';

        return `
          <tr>
            <td style="white-space: nowrap; font-size: 0.78rem;">${c.payment_date}</td>
            <td>
              <div style="font-weight: 700; color: #fff;">${c.member_name}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${c.member_email || ''}</div>
            </td>
            <td style="font-weight: 800; font-family: var(--font-heading); color: var(--accent-gold);">
              ₹${c.amount.toLocaleString()}
            </td>
            <td>${c.payment_method}</td>
            <td>
              <code style="background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 4px; font-size: 0.75rem;">
                ${c.reference_id}
              </code>
            </td>
            <td>
              <span class="badge ${isVerified ? 'badge-emerald' : (isPending ? 'badge-gold' : 'badge-rose')}">
                ${isVerified ? 'VERIFIED' : (isPending ? 'PENDING' : 'REJECTED')}
              </span>
            </td>
            <td style="font-size: 0.75rem;">
              ${isVerified ? `
                <div style="color: #34d399; font-weight: 600;">✓ ${c.verifier_name || 'Accounts Lead'}</div>
                <div style="color: var(--text-dim); font-size: 0.68rem;">${c.verified_at ? c.verified_at.split('T')[0] : ''}</div>
              ` : (isRejected ? '<span style="color: #fb7185;">Flagged</span>' : '<span style="color: var(--text-dim);">Awaiting review</span>')}
            </td>
            <td>
              ${isPending ? `
                <button class="btn btn-emerald btn-sm" onclick="App.openVerifyDialog('${c.id}', '${c.member_name}', ${c.amount}, '${c.reference_id}')">
                  🛡️ Verify Payment
                </button>
              ` : `
                <span style="font-size: 0.75rem; color: var(--text-dim);">Reconciled</span>
              `}
            </td>
          </tr>
        `;
      }).join('');
    } catch (err) {
      console.error('Failed to load contributions:', err);
    }
  },

  // STRICT ACCOUNTS VOLUNTEER PERMISSION GATE
  openVerifyDialog(contribId, memberName, amount, refId) {
    this.selectedContribId = contribId;

    // Check client-side role for clear feedback, but server ALSO strictly enforces it
    const isAccountsAuth =
      this.currentUser &&
      (this.currentUser.role === 'admin' ||
       this.currentUser.role === 'accounts_volunteer' ||
       (this.currentUser.assigned_team_id === 'finance' && this.currentUser.role === 'coordinator'));

    const modalBody = document.getElementById('verify-modal-details');
    modalBody.innerHTML = `
      <div class="stat-card stat-emerald mb-12">
        <div style="font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase;">Batchmate Payment Details</div>
        <div style="font-size: 1.15rem; font-weight: 800; color: #fff; margin-top: 4px;">
          ${memberName} — ₹${amount.toLocaleString()}
        </div>
        <div style="font-size: 0.8rem; color: var(--accent-gold); margin-top: 2px;">
          Bank Reference / UTR: <strong>${refId}</strong>
        </div>
      </div>

      ${!isAccountsAuth ? `
        <div class="accounts-volunteer-alert" style="background: rgba(244, 63, 94, 0.15); border-color: rgba(244, 63, 94, 0.4); color: #fda4af;">
          <span>⛔</span>
          <div>
            <strong>Notice:</strong> You are currently viewing as <em>${this.currentUser.name} (${this.currentUser.role})</em>.
            Only an <strong>authorised Accounts volunteer</strong> (Padmaraj or Nichoelles) or Admin can verify payments.
            <div style="margin-top: 4px;">
              <button class="btn btn-sm btn-primary" onclick="App.switchPersona('usr_padmaraj_acc')">
                Switch to Padmaraj (Accounts Lead)
              </button>
            </div>
          </div>
        </div>
      ` : `
        <div style="font-size: 0.82rem; color: #34d399; margin-bottom: 10px;">
          ✓ You are logged in as an authorised Accounts Volunteer. Proceed with verification after checking the bank credit.
        </div>
      `}
    `;

    this.openModal('modal-verify-contrib');
  },

  async executeVerifyPayment() {
    if (!this.selectedContribId) return;
    const notes = document.getElementById('verify-notes').value;

    try {
      const res = await fetch(`/api/finance/contributions/${this.selectedContribId}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ notes })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeModal('modal-verify-contrib');
        this.loadFinanceSummary();
        this.loadContributions();
      } else {
        // Displays the strict server-side 403 response!
        this.showToast(data.error || 'Verification forbidden', 'error');
      }
    } catch (err) {
      this.showToast('Verification failed', 'error');
    }
  },

  async executeRejectPayment() {
    if (!this.selectedContribId) return;
    const reason = document.getElementById('verify-notes').value || 'Bank statement UTR mismatch';

    try {
      const res = await fetch(`/api/finance/contributions/${this.selectedContribId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeModal('modal-verify-contrib');
        this.loadFinanceSummary();
        this.loadContributions();
      } else {
        this.showToast(data.error || 'Action forbidden', 'error');
      }
    } catch (err) {
      this.showToast('Failed to reject payment', 'error');
    }
  },

  openPaymentModal() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('pay-date');
    if (dateInput) dateInput.value = today;
    this.openModal('modal-payment');
  },

  async handlePaymentSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const formData = new FormData();

    formData.append('eventId', eventId);
    formData.append('amount', document.getElementById('pay-amount').value);
    formData.append('paymentMethod', document.getElementById('pay-method').value);
    formData.append('referenceId', document.getElementById('pay-ref').value);
    formData.append('paymentDate', document.getElementById('pay-date').value);
    formData.append('notes', document.getElementById('pay-notes').value);

    const proofFile = document.getElementById('pay-proof');
    if (proofFile.files.length) {
      formData.append('proofFile', proofFile.files[0]);
    }

    try {
      const res = await fetch('/api/finance/contributions', {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.closeModal('modal-payment');
        this.loadFinanceSummary();
        this.loadContributions();
      } else {
        this.showToast(data.error || 'Payment submission failed', 'error');
      }
    } catch (err) {
      this.showToast('Payment submission failed', 'error');
    }
  },

  async loadExpenses() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/finance/expenses?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('expenses-table-body');
      if (!tbody) return;

      if (!data.expenses.length) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted);">No expenses recorded yet.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.expenses.map(e => `
        <tr>
          <td style="white-space: nowrap; font-size: 0.78rem;">${e.payment_date}</td>
          <td>${e.team_icon} ${e.team_name}</td>
          <td style="text-transform: uppercase; font-size: 0.72rem; color: var(--text-dim);">${e.category}</td>
          <td style="font-weight: 700; color: #fff;">${e.title}</td>
          <td>${e.vendor_name || '—'}</td>
          <td style="font-weight: 800; font-family: var(--font-heading); color: #fb7185;">
            ₹${e.amount.toLocaleString()}
          </td>
          <td>${e.payment_mode}</td>
          <td>${e.receipt_name ? `<span style="color: var(--accent-gold);">🧾 Receipt</span>` : '—'}</td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load expenses:', err);
    }
  },

  openExpenseModal() {
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('exp-date');
    if (dateInput) dateInput.value = today;
    this.openModal('modal-expense');
  },

  async handleExpenseSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const formData = new FormData();

    formData.append('eventId', eventId);
    formData.append('teamId', document.getElementById('exp-team').value);
    formData.append('title', document.getElementById('exp-title').value);
    formData.append('amount', document.getElementById('exp-amount').value);
    formData.append('paymentDate', document.getElementById('exp-date').value);
    formData.append('vendorName', document.getElementById('exp-vendor').value);
    formData.append('paymentMode', document.getElementById('exp-mode').value);

    const receipt = document.getElementById('exp-receipt');
    if (receipt.files.length) {
      formData.append('receiptFile', receipt.files[0]);
    }

    try {
      const res = await fetch('/api/finance/expenses', {
        method: 'POST',
        headers: this.getHeaders(),
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Expense recorded successfully', 'success');
        this.closeModal('modal-expense');
        this.loadFinanceSummary();
        this.loadExpenses();
      } else {
        this.showToast(data.error || 'Failed to record expense', 'error');
      }
    } catch (err) {
      this.showToast('Failed to record expense', 'error');
    }
  },

  // ========================================================================
  // SECTION 7: ANNOUNCEMENTS, EMAIL REMINDERS & WHATSAPP GENERATOR
  // ========================================================================
  async loadAnnouncements() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/announcements?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const container = document.getElementById('announcements-container');
      if (!container) return;

      if (!data.announcements.length) {
        container.innerHTML = `<div class="glass-card" style="text-align: center; color: var(--text-muted); padding: 30px; grid-column: 1 / -1;">No announcements published yet.</div>`;
        return;
      }

      container.innerHTML = data.announcements.map(a => `
        <div class="glass-card" style="margin-bottom: 0;">
          <div class="flex-between mb-12">
            <span class="badge ${a.priority === 'urgent' ? 'badge-rose' : (a.priority === 'important' ? 'badge-gold' : 'badge-sky')}">
              ${a.priority.toUpperCase()}
            </span>
            ${a.is_pinned ? '<span style="color: var(--accent-gold); font-size: 0.8rem; font-weight: 700;">📌 Pinned</span>' : ''}
          </div>
          <h4 style="font-family: var(--font-heading); font-size: 1.15rem; font-weight: 800; color: #fff; margin-bottom: 8px;">
            ${a.title}
          </h4>
          <p style="font-size: 0.85rem; color: var(--text-muted); line-height: 1.6; white-space: pre-line;">
            ${a.content}
          </p>
          <div style="border-top: 1px solid var(--border-subtle); padding-top: 10px; margin-top: 14px; font-size: 0.75rem; color: var(--text-dim); display: flex; align-items: center; justify-content: space-between;">
            <span>By: <strong>${a.author_name || 'Committee'}</strong></span>
            <span>${a.created_at ? a.created_at.split('T')[0] : ''}</span>
          </div>
        </div>
      `).join('');
    } catch (err) {
      console.error('Failed to load announcements:', err);
    }
  },

  openAnnouncementModal() {
    this.openModal('modal-announcement');
  },

  async handleAnnouncementSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const title = document.getElementById('anc-title').value;
    const content = document.getElementById('anc-content').value;
    const priority = document.getElementById('anc-priority').value;
    const isPinned = document.getElementById('anc-pinned').checked;

    try {
      const res = await fetch('/api/announcements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ eventId, title, content, priority, isPinned })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Announcement broadcasted successfully!', 'success');
        this.closeModal('modal-announcement');
        this.loadAnnouncements();
      } else {
        this.showToast(data.error || 'Failed to post announcement', 'error');
      }
    } catch (err) {
      this.showToast('Failed to post announcement', 'error');
    }
  },

  async loadScheduledReminders() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/reminders?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('reminders-table-body');
      if (!tbody) return;

      if (!data.reminders.length) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted);">No scheduled reminders queued.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.reminders.map(r => `
        <tr>
          <td style="font-size: 0.78rem;">${r.scheduled_at ? r.scheduled_at.replace('T', ' ').substring(0, 16) : ''}</td>
          <td>
            <span class="badge badge-sky" style="font-size: 0.68rem;">
              ${r.target_audience.replace('_', ' ').toUpperCase()}
            </span>
          </td>
          <td style="font-weight: 700; color: #fff;">${r.subject}</td>
          <td>
            <span class="badge ${r.status === 'sent' ? 'badge-emerald' : 'badge-gold'}">
              ${r.status.toUpperCase()}
            </span>
          </td>
          <td>${r.sent_count || 0} sent</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="App.triggerReminderNow('${r.id}')" title="Trigger send immediately">
              🚀 Send Now
            </button>
          </td>
        </tr>
      `).join('');
    } catch (err) {
      console.error('Failed to load reminders:', err);
    }
  },

  async triggerReminderNow(reminderId) {
    if (!confirm('Dispatch this reminder email to all eligible batchmates immediately?')) return;
    try {
      const res = await fetch(`/api/reminders/${reminderId}/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() }
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadScheduledReminders();
      } else {
        this.showToast(data.error || 'Failed to dispatch reminder', 'error');
      }
    } catch (err) {
      this.showToast('Failed to dispatch reminder', 'error');
    }
  },

  openScheduleReminderModal() {
    this.openModal('modal-schedule-reminder');
  },

  async handleScheduleReminderSubmit(e) {
    e.preventDefault();
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const title = document.getElementById('rem-title').value;
    const targetAudience = document.getElementById('rem-audience').value;
    const scheduledAt = document.getElementById('rem-time').value;
    const subject = document.getElementById('rem-subject').value;
    const messageBody = document.getElementById('rem-body').value;

    try {
      const res = await fetch('/api/reminders/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ eventId, title, targetAudience, scheduledAt, subject, messageBody })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Reminder scheduled successfully', 'success');
        this.closeModal('modal-schedule-reminder');
        this.loadScheduledReminders();
      } else {
        this.showToast(data.error || 'Failed to schedule reminder', 'error');
      }
    } catch (err) {
      this.showToast('Failed to schedule reminder', 'error');
    }
  },

  async loadSentRemindersLog() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/reminders/sent-log?eventId=${eventId}`);
      const data = await res.json();
      if (!data.success) return;

      const tbody = document.getElementById('sent-reminders-tbody');
      if (tbody) {
        if (!data.logs.length) {
          tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted);">No emails sent yet.</td></tr>`;
        } else {
          tbody.innerHTML = data.logs.map(l => `
            <tr>
              <td style="font-size: 0.75rem;">${l.sent_at.replace('T', ' ').substring(0, 16)}</td>
              <td><strong>${l.recipient_name}</strong> (${l.recipient_email})</td>
              <td style="color: #fff;">${l.subject}</td>
              <td><span class="badge badge-emerald">SENT</span></td>
            </tr>
          `).join('');
        }
      }
      this.openModal('modal-sent-reminders');
    } catch (err) {
      this.showToast('Failed to load sent log', 'error');
    }
  },

  // 1-Click WhatsApp Broadcast Generator
  openWhatsAppModal(template = 'rsvp_alert') {
    const sel = document.getElementById('wa-template-select');
    if (sel) sel.value = template;
    this.generateWhatsAppText();
    this.openModal('modal-whatsapp');
  },

  async generateWhatsAppText() {
    const template = document.getElementById('wa-template-select').value;
    const customNotes = document.getElementById('wa-custom-notes').value;
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';

    try {
      const res = await fetch('/api/reminders/whatsapp-share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ eventId, messageType: template, customNotes })
      });
      const data = await res.json();
      if (data.success) {
        this.currentWhatsAppText = data.messageText;
        this.currentWhatsAppUrl = data.whatsappUrl;
        const bubble = document.getElementById('wa-preview-bubble');
        if (bubble) bubble.textContent = data.messageText;
      }
    } catch (err) {
      console.error('Failed to generate WhatsApp text:', err);
    }
  },

  openWhatsAppShare() {
    if (this.currentWhatsAppUrl) {
      window.open(this.currentWhatsAppUrl, '_blank');
    }
  },

  copyWhatsAppText() {
    if (this.currentWhatsAppText) {
      this.copyText(this.currentWhatsAppText, 'Formatted WhatsApp text copied! Paste it in your alumni group.');
    }
  },

  // ========================================================================
  // SECTION 8: ADMINISTRATOR DASHBOARD
  // ========================================================================
  async loadAdminDashboard() {
    try {
      const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
      const res = await fetch(`/api/admin/dashboard?eventId=${eventId}`, { headers: this.getHeaders() });
      const data = await res.json();
      if (!data.success) return;

      const { stats, users, inviteCodes, recentAudits } = data;

      // Render Admin Stats
      const statsGrid = document.getElementById('admin-stats-grid');
      if (statsGrid) {
        statsGrid.innerHTML = `
          <div class="stat-card">
            <div class="stat-header">
              <span class="stat-title">Total Batch Members</span>
              <span class="stat-icon">🎓</span>
            </div>
            <div class="stat-value text-gold">${stats.totalMembers}</div>
            <div class="stat-sub">${stats.accountsVolunteersCount} Accounts Volunteers • ${stats.coordinatorsCount} Coordinators</div>
          </div>

          <div class="stat-card stat-emerald">
            <div class="stat-header">
              <span class="stat-title">Financial Verification</span>
              <span class="stat-icon">🛡️</span>
            </div>
            <div class="stat-value text-emerald">₹${stats.verifiedFunds.toLocaleString()}</div>
            <div class="stat-sub">${stats.pendingVerificationsCount} payments awaiting Accounts approval</div>
          </div>

          <div class="stat-card stat-sky">
            <div class="stat-header">
              <span class="stat-title">Operational Tasks</span>
              <span class="stat-icon">📋</span>
            </div>
            <div class="stat-value" style="color: #38bdf8;">${stats.openTasks} Active</div>
            <div class="stat-sub">${stats.urgentTasks} urgent deadlines • ${stats.pendingQuotes} vendor bids pending</div>
          </div>
        `;
      }

      // Render Members Directory Table
      const membersBody = document.getElementById('admin-members-body');
      if (membersBody) {
        membersBody.innerHTML = users.map(u => `
          <tr>
            <td>
              <div style="font-weight: 700; color: #fff;">${u.avatar || '👤'} ${u.name}</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${u.profession || ''}</div>
            </td>
            <td>${u.email}</td>
            <td>${u.whatsapp || u.phone || '—'}</td>
            <td>${u.city || '—'}</td>
            <td>
              <span class="badge ${u.role === 'admin' ? 'badge-rose' : (u.role === 'accounts_volunteer' ? 'badge-emerald' : (u.role === 'coordinator' ? 'badge-gold' : 'badge-sky'))}">
                ${u.role.replace('_', ' ').toUpperCase()}
              </span>
            </td>
            <td style="text-transform: capitalize;">${u.assigned_team_id || 'General'}</td>
            <td>
              <select class="form-control btn-sm" onchange="App.changeUserRole('${u.id}', this.value)" style="font-size: 0.75rem;">
                <option value="member" ${u.role === 'member' ? 'selected' : ''}>Member</option>
                <option value="coordinator" ${u.role === 'coordinator' ? 'selected' : ''}>Coordinator</option>
                <option value="accounts_volunteer" ${u.role === 'accounts_volunteer' ? 'selected' : ''}>Accounts Volunteer</option>
                <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
              </select>
            </td>
          </tr>
        `).join('');
      }

      // Render Invite Codes Table
      const inviteBody = document.getElementById('invite-codes-body');
      if (inviteBody) {
        inviteBody.innerHTML = inviteCodes.map(c => `
          <tr>
            <td><code style="color: var(--accent-gold); font-weight: 700; font-size: 0.85rem;">${c.code}</code></td>
            <td><span class="badge badge-sky">${c.role.toUpperCase()}</span></td>
            <td>${c.assigned_team_id ? c.assigned_team_id.toUpperCase() : 'None'}</td>
            <td><strong>${c.used_count}</strong> / ${c.max_uses}</td>
            <td style="font-size: 0.75rem; color: var(--text-muted);">${c.notes || ''}</td>
            <td>
              <button class="btn btn-secondary btn-sm" onclick="App.copyText('${window.location.origin}/?invite=${c.code}', 'Registration invite link copied!')">
                📋 Copy Link
              </button>
            </td>
          </tr>
        `).join('');
      }

      // Render Audit Trail
      const auditBody = document.getElementById('admin-audit-body');
      if (auditBody) {
        auditBody.innerHTML = recentAudits.map(a => `
          <tr>
            <td style="font-size: 0.75rem; white-space: nowrap;">${a.created_at ? a.created_at.replace('T', ' ').substring(0, 16) : ''}</td>
            <td><strong>${a.user_name || 'System'}</strong></td>
            <td><span class="badge badge-gold" style="font-size: 0.68rem;">${a.action}</span></td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${a.details}</td>
          </tr>
        `).join('');
      }
    } catch (err) {
      console.error('Failed to load admin dashboard:', err);
    }
  },

  async changeUserRole(userId, newRole) {
    try {
      const res = await fetch('/api/admin/users/role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ userId, role: newRole })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast(data.message, 'success');
        this.loadAdminDashboard();
      } else {
        this.showToast(data.error || 'Failed to update role', 'error');
      }
    } catch (err) {
      this.showToast('Failed to update role', 'error');
    }
  },

  openCreateInviteModal() {
    this.openModal('modal-invite');
  },

  async handleCreateInvite(e) {
    e.preventDefault();
    const code = document.getElementById('inv-code').value;
    const role = document.getElementById('inv-role').value;
    const maxUses = document.getElementById('inv-quota').value;
    const assignedTeamId = document.getElementById('inv-team').value;
    const notes = document.getElementById('inv-notes').value;

    try {
      const res = await fetch('/api/admin/invite-codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...this.getHeaders() },
        body: JSON.stringify({ code, role, maxUses, assignedTeamId, notes })
      });
      const data = await res.json();
      if (data.success) {
        this.showToast('Invite code generated!', 'success');
        this.closeModal('modal-invite');
        this.loadAdminDashboard();
      } else {
        this.showToast(data.error || 'Failed to create code', 'error');
      }
    } catch (err) {
      this.showToast('Failed to create code', 'error');
    }
  },

  // ========================================================================
  // SECTION 9: PRINTABLE REPORTS PREVIEW
  // ========================================================================
  async openPrintableReport(type) {
    const eventId = this.activeEvent ? this.activeEvent.id : 'evt_2026';
    const res = await fetch(`/api/reports/data?eventId=${eventId}`);
    const data = await res.json();
    if (!data.success) return;

    const modalTitle = document.getElementById('printable-modal-title');
    const modalBody = document.getElementById('printable-report-body');

    if (type === 'attendance') {
      modalTitle.textContent = '🖨️ Official Reunion Attendance Sheet Preview';
      modalBody.innerHTML = `
        <div style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="font-size: 1.2rem; margin: 0; color: #000; letter-spacing: -0.01em;">GOVERNMENT COLLEGE OF PHYSIOTHERAPY (GCP), TRICHY</h2>
          <h3 style="font-size: 1.05rem; margin: 4px 0 0 0; color: #333;">GCP BATCH OF 98 - OFFICIAL ATTENDANCE REGISTER</h3>
          <div style="font-size: 0.9rem; color: #444; margin-top: 4px;">
            Event: ${data.event.title} • Venue: ${data.event.venue_name} • Date: ${data.event.dates_display}
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
          <thead>
            <tr style="background: #eee; border-bottom: 1px solid #999;">
              <th style="padding: 6px;">#</th>
              <th style="padding: 6px;">Batchmate Name</th>
              <th style="padding: 6px;">Phone</th>
              <th style="padding: 6px;">Status</th>
              <th style="padding: 6px;">Total Guests</th>
              <th style="padding: 6px;">Meal Choice</th>
              <th style="padding: 6px;">Dietary & Allergies</th>
              <th style="padding: 6px;">Room</th>
            </tr>
          </thead>
          <tbody>
            ${data.rsvps.map((r, i) => `
              <tr style="border-bottom: 1px solid #ddd;">
                <td style="padding: 6px;">${i + 1}</td>
                <td style="padding: 6px; font-weight: bold;">${r.member_name}</td>
                <td style="padding: 6px;">${r.member_phone || ''}</td>
                <td style="padding: 6px;">${r.status.toUpperCase()}</td>
                <td style="padding: 6px;">${r.total_headcount}</td>
                <td style="padding: 6px; text-transform: uppercase;">${r.meal_preference}</td>
                <td style="padding: 6px;">${r.dietary_notes || 'None'}</td>
                <td style="padding: 6px;">${r.accommodation_needed ? 'Yes' : 'No'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    } else {
      modalTitle.textContent = '🖨️ Official Financial Audit & Accounts Statement';
      const totalVerified = data.contributions.filter(c => c.status === 'verified').reduce((sum, c) => sum + c.amount, 0);
      const totalExp = data.expenses.reduce((sum, e) => sum + e.amount, 0);
      const netCash = totalVerified - totalExp;

      modalBody.innerHTML = `
        <div style="border-bottom: 2px solid #000; padding-bottom: 12px; margin-bottom: 16px;">
          <h2 style="font-size: 1.2rem; margin: 0; color: #000; letter-spacing: -0.01em;">GOVERNMENT COLLEGE OF PHYSIOTHERAPY (GCP), TRICHY</h2>
          <h3 style="font-size: 1.05rem; margin: 4px 0 0 0; color: #333;">GCP BATCH OF 98 - STATEMENT OF AUDITED ACCOUNTS</h3>
          <div style="font-size: 0.9rem; color: #444; margin-top: 4px;">
            Event: ${data.event.title} • Target Budget: ₹${data.event.target_budget.toLocaleString()} • Generated: ${new Date().toLocaleDateString()}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between; background: #f4f4f4; padding: 12px; border-radius: 4px; margin-bottom: 16px; font-weight: bold;">
          <div>Verified Collections: ₹${totalVerified.toLocaleString()}</div>
          <div>Total Disbursements: ₹${totalExp.toLocaleString()}</div>
          <div>Net Balance in Escrow: ₹${netCash.toLocaleString()}</div>
        </div>

        <h4 style="margin: 12px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Verified Contributions</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; margin-bottom: 16px;">
          <tr style="background: #eee;">
            <th style="padding: 5px;">Date</th>
            <th style="padding: 5px;">Member</th>
            <th style="padding: 5px;">Amount</th>
            <th style="padding: 5px;">Mode</th>
            <th style="padding: 5px;">Reference / UTR</th>
            <th style="padding: 5px;">Auditor Signoff</th>
          </tr>
          ${data.contributions.filter(c => c.status === 'verified').map(c => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 5px;">${c.payment_date}</td>
              <td style="padding: 5px; font-weight: bold;">${c.member_name}</td>
              <td style="padding: 5px;">₹${c.amount.toLocaleString()}</td>
              <td style="padding: 5px;">${c.payment_method}</td>
              <td style="padding: 5px;">${c.reference_id}</td>
              <td style="padding: 5px;">Verified by ${c.verifier_name}</td>
            </tr>
          `).join('')}
        </table>

        <h4 style="margin: 12px 0 6px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Disbursements & Expenses</h4>
        <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem;">
          <tr style="background: #eee;">
            <th style="padding: 5px;">Date</th>
            <th style="padding: 5px;">Team</th>
            <th style="padding: 5px;">Description</th>
            <th style="padding: 5px;">Vendor</th>
            <th style="padding: 5px;">Amount</th>
            <th style="padding: 5px;">Payment Mode</th>
          </tr>
          ${data.expenses.map(e => `
            <tr style="border-bottom: 1px solid #ddd;">
              <td style="padding: 5px;">${e.payment_date}</td>
              <td style="padding: 5px;">${e.team_name}</td>
              <td style="padding: 5px; font-weight: bold;">${e.title}</td>
              <td style="padding: 5px;">${e.vendor_name || '—'}</td>
              <td style="padding: 5px;">₹${e.amount.toLocaleString()}</td>
              <td style="padding: 5px;">${e.payment_mode}</td>
            </tr>
          `).join('')}
        </table>

        <div style="margin-top: 24px; padding-top: 12px; border-top: 1px dashed #999; display: flex; justify-content: space-between; font-size: 0.8rem;">
          <div>Audited by: <strong>Padmaraj & Nichoelles (Accounts Volunteers)</strong></div>
          <div>Approved by: <strong>Jeeva (Batch Admin)</strong></div>
        </div>
      `;
    }

    this.openModal('modal-printable-report');
  },

  // Modal helpers
  openModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.add('show');
  },

  closeModal(modalId) {
    const el = document.getElementById(modalId);
    if (el) el.classList.remove('show');
  },

  setupEventListeners() {
    // Close modal on backdrop click
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });
  }
};

// Auto-run on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
