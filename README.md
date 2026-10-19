# GCP Batch of 98 — Annual Batch Reunion Web Application
### Government College of Physiotherapy (GCP), Trichy

A private, mobile-first reunion web app built for the alumni of **Government College of Physiotherapy (GCP), Trichy — Batch of 1998**.

## 🌟 Key Features

1. **Multi-Year Support & Annual Archives**
   - Active event switcher: 2026 Batch Day (Mullai Resort, Vayaloor, Trichy - Completed Oct 11, 2026), 2027 Batch Day (October Planning & Date Polls), 2025 Silver Jubilee (Archived), 2024 Winter Reunion (Archived).
   - Past years are archived with locked historical records, photo galleries, and audited balance sheets.

2. **Invite-Only Membership & Role-Based Access**
   - Access restricted by invite codes/tokens (`BATCH98-VIP`, `GCP98-REUNITE`, `ACCOUNTS-VOLUNTEER-98`).
   - Server-side role enforcement: `Admin`, `Coordinator`, `Accounts_Volunteer`, `Member`.

3. **Date Polls & Democratic Scheduling**
   - Interactive member voting on candidate reunion weekends.
   - Live progress bars, voter list breakdown, and date locking.

4. **RSVP with Guest & Meal Counts**
   - Headcount calculation: Member (1) + Adult guests (+) + Kids count (0-12 yrs).
   - Meal preferences: Pure Veg, Non-Veg (Chicken/Fish), Jain (No root veg), Vegan, and Kids meals.
   - Hotel room requests, arrival/departure dates, and flight shuttle coordination.

5. **Leadership & Volunteer Committee Teams (Coordinators & Roles)**
   - **Admin / Batch President**: Jeeva (Chennai)
   - **Location Team**: Kumaresh (Dindigul)
   - **Finance & Accounts**: Lead: Padmaraj (Chennai) & Nichoelles (Trichy) *(Authorized Accounts Volunteers)*
   - **Venue & Hospitality**: Lead: Kumaresh (Dindigul) & Babu (Chennai)
   - **Food & Menu**: Lead: Kavitha (Hosur) & Ilaveyini (Chennai)
   - **Entertainment & Mementos**: Lead: Dhatchina Moorthy (Madurai) & Jebaraj Fletcher (Puducherry)
   - **Transport**: Lead: Pandithurai (Karaikudi) & Kumaresh (Dindigul)
   - **Communications & Outreach**: Lead: Babu (Chennai) & Kavitha (Hosur)
   - Direct Call (`tel:`) and WhatsApp (`wa.me`) click-to-contact links for every coordinator.

6. **Task Ownership & Deadlines**
   - Team task board with priorities (`Urgent`, `High`, `Medium`, `Low`), deadlines, assignees, and status workflow (`To Do`, `In Progress`, `Review`, `Completed`).

7. **Vendor Quotations & Bid Approvals**
   - Quotation file uploads with quote amounts, category breakdown, notes, and approval/rejection review workflow.

8. **Treasury, Contributions & Strict Accounts Volunteer Guard**
   - Bank escrow details and copyable UPI ID (`gcp98reunion@hdfcbank`).
   - Member contribution submission with UTR reference number and payment proof screenshot.
   - **Strict Rule Enforcement**: Contributions default to `PENDING` and *cannot be marked verified* without confirmation from an authorised Accounts volunteer (`accounts_volunteer` role or Admin). Unauthorized attempts return HTTP 403 Forbidden.
   - Full expense tracking and real-time cash balance in escrow.

9. **Announcements, Scheduled Reminders & WhatsApp Generator**
   - Priority broadcast notices with feed pinning.
   - Scheduled email reminder engine (runs every 60 seconds with target filters: non-RSVP, unpaid, all).
   - In-app Sent Reminders Inbox.
   - 1-Click WhatsApp Broadcast Generator with formatted bold text, emojis, and group share link.

10. **Administrator Control Center & Reports**
    - Executive health metrics counters.
    - Member roster with instant role promotion/demotion.
    - Invite code token generator with usage quotas.
    - Security and financial audit trail.
    - Exportable Attendance CSV (`/api/reports/attendance.csv`).
    - Exportable Accounts Ledger CSV (`/api/reports/accounts.csv`).
    - In-app printable report previews.
    - 1-Click atomic SQLite database backup download (`/api/backup/download`) and JSON export (`/api/backup/export-json`).

## 🚀 Running Locally

```bash
# Install dependencies
npm install

# Start server
npm start
# App runs at: http://localhost:3000
```
