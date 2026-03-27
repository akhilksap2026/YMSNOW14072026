import fs from "fs";
import path from "path";

function screenshotDataUrl(name: string): string {
  try {
    const dir = path.join(process.cwd(), "..", "yms", "public", "screenshots");
    const buf = fs.readFileSync(path.join(dir, `${name}.png`));
    return `data:image/png;base64,${buf.toString("base64")}`;
  } catch {
    return "";
  }
}

function screenshotImg(name: string, caption?: string): string {
  const src = screenshotDataUrl(name);
  if (!src) return "";
  return `<div style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;margin:12px 0 20px;">
    <img src="${src}" alt="${caption ?? name}" style="width:100%;display:block;max-height:320px;object-fit:cover;object-position:top;" />
    ${caption ? `<p style="text-align:center;font-size:10px;color:#888;padding:4px 0;margin:0;border-top:1px solid #f0f0f0;background:#fafafa;">${caption}</p>` : ""}
  </div>`;
}

export function generateManualHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>YMSNOW Product Manual v2.0 — KSAP OTM Now</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; font-size: 13px; line-height: 1.6; color: #1a1a1a; background: #fff; }
    .page { max-width: 960px; margin: 0 auto; padding: 40px 48px; }
    h1 { font-size: 36px; font-weight: 900; color: #2B5DAD; letter-spacing: -0.5px; }
    h2 { font-size: 18px; font-weight: 700; color: #2B5DAD; border-bottom: 2px solid #2B5DAD; padding-bottom: 6px; margin: 40px 0 16px; }
    h3 { font-size: 14px; font-weight: 600; margin: 24px 0 8px; }
    p { margin-bottom: 12px; }
    .title-page { min-height: 60vh; display: flex; flex-direction: column; justify-content: center; text-align: center; border-bottom: 3px solid #2B5DAD; margin-bottom: 48px; padding: 48px 0; gap: 12px; }
    .title-page .logo { display: inline-block; width: 72px; height: 72px; border-radius: 16px; background: #2B5DAD; color: #fff; font-size: 28px; font-weight: 900; line-height: 72px; text-align: center; margin: 0 auto 16px; }
    .title-page .brand { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 3px; color: #666; margin-bottom: 4px; }
    .title-page h1 { font-size: 42px; }
    .title-page .subtitle { font-size: 18px; font-weight: 600; color: #333; }
    .title-page .tagline { font-size: 14px; color: #666; }
    .title-page .meta { font-size: 12px; color: #888; margin-top: 24px; }
    .meta strong { color: #333; }
    .toc { margin-bottom: 48px; }
    .toc-item { display: flex; align-items: center; gap: 8px; padding: 5px 0; border-top: 1px solid #eee; }
    .toc-item.sub { padding-left: 24px; border-top: none; }
    .toc-num { font-family: monospace; font-size: 11px; color: #2B5DAD; font-weight: 700; min-width: 40px; }
    .toc-item.sub .toc-num { color: #888; font-weight: normal; }
    .toc-dots { flex: 1; border-bottom: 1px dotted #ccc; margin: 0 8px; }
    .toc-label { font-size: 13px; }
    .toc-item.sub .toc-label { color: #666; }
    .kpi-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 24px 0; }
    .kpi-card { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; background: #f0f4fc; }
    .kpi-card .metric { font-size: 32px; font-weight: 900; color: #2B5DAD; }
    .kpi-card .label { font-size: 13px; font-weight: 600; margin-top: 4px; }
    .kpi-card .sub { font-size: 11px; color: #888; margin-top: 2px; }
    .module-card { border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; margin-bottom: 32px; page-break-inside: avoid; }
    .module-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; background: #eef3fb; border-bottom: 1px solid #d1ddf7; }
    .badge { padding: 2px 8px; border-radius: 999px; background: #2B5DAD; color: #fff; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; }
    .module-header h3 { font-size: 14px; font-weight: 700; }
    .module-body { padding: 16px; }
    .module-body .section-label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-top: 12px; margin-bottom: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; border-radius: 6px; overflow: hidden; border: 1px solid #e5e7eb; }
    thead { background: #f3f4f6; }
    th { text-align: left; padding: 8px 12px; font-size: 11px; font-weight: 600; }
    td { padding: 7px 12px; border-top: 1px solid #f0f0f0; }
    tr:nth-child(even) td { background: #fafafa; }
    td.mono { font-family: monospace; font-size: 11px; color: #2B5DAD; }
    .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-top: 8px; }
    .action-list, .validation-list { list-style: none; }
    .action-list li, .validation-list li { font-size: 12px; padding: 2px 0; padding-left: 14px; position: relative; }
    .action-list li::before { content: "▸"; color: #2B5DAD; position: absolute; left: 0; }
    .validation-list li::before { content: "✓"; color: #16a34a; position: absolute; left: 0; }
    .next-step { font-size: 11px; color: #2B5DAD; font-weight: 600; margin-top: 12px; padding: 8px 12px; background: #f0f4fc; border-radius: 6px; border-left: 3px solid #2B5DAD; }
    .lifecycle-table { margin: 24px 0; }
    .process-box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin: 16px 0; }
    .process-box .step { display: flex; gap: 16px; margin-bottom: 16px; align-items: flex-start; }
    .step-num { width: 32px; height: 32px; border-radius: 50%; background: #2B5DAD; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 13px; font-weight: 700; flex-shrink: 0; }
    .step-content h4 { font-size: 13px; font-weight: 600; }
    .step-content p { font-size: 12px; color: #555; margin: 2px 0 0; }
    .step-outcome { font-size: 10px; font-family: monospace; color: #2B5DAD; background: #f0f4fc; border: 1px solid #d1ddf7; border-radius: 4px; padding: 2px 6px; display: inline-block; margin-top: 4px; }
    .warning-box { border: 1px solid #fde68a; background: #fffbeb; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #92400e; margin: 16px 0; }
    .info-box { border: 1px solid #bfdbfe; background: #eff6ff; border-radius: 8px; padding: 12px 16px; font-size: 12px; color: #1e40af; margin: 16px 0; }
    @media print {
      body { font-size: 11px; }
      .page { padding: 24px 32px; }
      h2 { page-break-before: always; }
      .module-card { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
<div class="page">

  <!-- TITLE PAGE -->
  <div class="title-page">
    <div><div class="logo">Y</div></div>
    <div class="brand">KSAP OTM Now</div>
    <h1>YMSNOW</h1>
    <div class="subtitle">Yard Management System</div>
    <div class="tagline">Enterprise Operations Platform for Warehouse &amp; Plant Yards<br/>End-to-End Truck Lifecycle Management</div>
    <div class="meta">
      <strong>Document Type:</strong> Product User Manual &amp; Operations Reference &nbsp;|&nbsp;
      <strong>Version:</strong> 2.0 &nbsp;|&nbsp;
      <strong>Date:</strong> March 2026 &nbsp;|&nbsp;
      <strong>Classification:</strong> Internal — Confidential
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <h2>Table of Contents</h2>
  <div class="toc">
    ${[
      ["1","Executive Summary"],["2","System Architecture Overview"],["3","End-to-End Application Lifecycle"],
      ["4","Module-by-Module Documentation"],
      ["  4.1","Dashboard"],["  4.2","Appointments"],["  4.3","Gate Check-In"],["  4.4","Gate Check-Out"],
      ["  4.5","Yard Inventory"],["  4.6","Yard Map"],["  4.7","Dock Management"],["  4.8","Move Tasks"],
      ["  4.9","Holds &amp; Exceptions"],["  4.10","Yard Walk / Audit"],["  4.11","Inspections"],
      ["  4.12","Reports &amp; Analytics"],["  4.13","Administration Modules"],
      ["  4.14","Notifications Center"],["  4.15","Gate Guard Mode"],["  4.16","Carrier Self-Service Portal"],
      ["  4.17","AI Operations Copilot"],["  4.18","AI Copilot Configuration"],
      ["5","Functional Capability Inventory"],["6","User Role Journey Mapping"],
      ["7","Exception Handling &amp; Operational Rules"],
      ["8","Operational Workflow Chain — Guided Processing"],
      ["9","Jockey Board View — Shift Planning"],
      ["10","Operational Notes &amp; Best Practices"],
      ["11","AI Operations Copilot — Full Reference"],["12","AI Copilot Configuration — Full Reference"],
    ].map(([n,t])=>`<div class="toc-item${n.startsWith(" ")?" sub":""}"><span class="toc-num">${n.trim()}</span><span class="toc-dots"></span><span class="toc-label">${t}</span></div>`).join("")}
  </div>

  <!-- 1. EXECUTIVE SUMMARY -->
  <h2>1. Executive Summary</h2>
  <p>YMSNOW is a production-grade Tier 1 Yard Management System (YMS) built on the KSAP OTM Now platform, designed for high-throughput warehouse and plant yard operations. The platform handles the complete lifecycle of every trailer movement — from appointment booking through gate check-in, yard placement, dock assignment, load/unload operations, exception management, and final gate check-out — providing real-time visibility and control at every step.</p>
  <div class="kpi-grid">
    <div class="kpi-card"><div class="metric">50–150</div><div class="label">Trailers / Day</div><div class="sub">Design throughput capacity</div></div>
    <div class="kpi-card"><div class="metric">6</div><div class="label">User Roles</div><div class="sub">Admin, Manager, Guard, Jockey, Dock, Carrier</div></div>
    <div class="kpi-card"><div class="metric">18+</div><div class="label">Core Modules</div><div class="sub">End-to-end operational coverage</div></div>
  </div>
  <p>The system is built on a modern full-stack architecture: <strong>React + TypeScript</strong> frontend with <strong>shadcn/ui</strong> components, <strong>Express.js + Drizzle ORM</strong> backend, and <strong>PostgreSQL</strong> for persistent data. The platform is designed to be deployed on enterprise cloud infrastructure with zero downtime and real-time data refresh.</p>

  <!-- 2. SYSTEM ARCHITECTURE -->
  <h2>2. System Architecture Overview</h2>
  <p>The YMSNOW platform follows a modular, layered architecture that separates presentation, business logic, and data persistence cleanly across three tiers.</p>
  <table>
    <thead><tr><th>Layer</th><th>Technology</th><th>Responsibility</th></tr></thead>
    <tbody>
      <tr><td><strong>Frontend</strong></td><td>React 18 + TypeScript + Vite</td><td>All user interfaces, module rendering, real-time KPI display</td></tr>
      <tr><td><strong>UI Component Library</strong></td><td>shadcn/ui + Tailwind CSS</td><td>Design system, consistent interaction patterns</td></tr>
      <tr><td><strong>Client Routing</strong></td><td>Wouter v3</td><td>Client-side navigation between modules</td></tr>
      <tr><td><strong>Data Fetching</strong></td><td>TanStack Query v5</td><td>Server state management, caching, optimistic updates</td></tr>
      <tr><td><strong>API Layer</strong></td><td>Express.js + TypeScript</td><td>REST API, business logic, role-based access control</td></tr>
      <tr><td><strong>ORM</strong></td><td>Drizzle ORM</td><td>Type-safe database access, schema migrations</td></tr>
      <tr><td><strong>Database</strong></td><td>PostgreSQL</td><td>Persistent storage for all operational data</td></tr>
      <tr><td><strong>AI Layer</strong></td><td>LLM via API + context compiler</td><td>AI Operations Copilot — live yard data + language model</td></tr>
    </tbody>
  </table>

  <!-- 3. LIFECYCLE -->
  <h2>3. End-to-End Application Lifecycle</h2>
  <p>Every truck that enters the yard follows a defined operational lifecycle managed end-to-end by YMSNOW:</p>
  <table class="lifecycle-table">
    <thead><tr><th>Stage</th><th>Actor</th><th>Module</th><th>System State Change</th></tr></thead>
    <tbody>
      ${[
        ["1. Appointment Booking","Carrier / Scheduler","Appointments","status: booked"],
        ["2. Gate Check-In","Gate Guard","Gate Check-In","status: checked_in → Visit record created"],
        ["3. Slot Assignment (Workflow Chain Step 1)","Gate Guard / Supervisor","Gate Check-In (inline)","status: in_yard → slot assigned"],
        ["4. Move to Slot","Yard Jockey","Move Tasks","Move task created → completed"],
        ["5. Dock Assignment","Dock Supervisor","Dock Management","trailer assigned to door"],
        ["6. Move to Dock","Yard Jockey","Move Tasks","in_yard → at_dock"],
        ["7. Load / Unload","Dock Operations","Dock Management","status: loading / unloading"],
        ["8. Staging","Yard Jockey","Move Tasks","at_dock → in_staging"],
        ["9. Pre-Departure Inspection","Gate Guard","Inspections","Inspection record created"],
        ["10. Gate Check-Out","Gate Guard","Gate Check-Out","status: closed → visit ended"],
      ].map((r,i)=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td><td class="mono">${r[3]}</td></tr>`).join("")}
    </tbody>
  </table>

  <!-- 4. MODULE DOCUMENTATION -->
  <h2>4. Module-by-Module Documentation</h2>

  ${[
    {
      id:"4.1",name:"Dashboard",badge:"OPS",screenshot:"dashboard",
      purpose:"Central command view providing a real-time KPI strip, recent arrivals feed, dock status, and operational alerts. The starting point for yard managers and administrators at the beginning of each shift. Clicking any KPI card deep-links into the relevant module with the appropriate filter pre-applied.",
      fields:[["Yard Inventory","Total active trailers currently in yard"],["Arrivals Today","Trucks checked in since midnight"],["Trailers at Dock","Trailers currently assigned to a dock door"],["On Hold","Trailers with active hold status"],["Avg Dwell","Average yard residence time (minutes)"],["Open Move Tasks","Pending move tasks not yet completed"],["Aged Trailers","Trailers exceeding dwell threshold (>24h)"],["Awaiting Slot","Checked-in trailers without a yard slot assigned"],["Ready Out","Trailers staged and ready for departure"]],
      actions:["Deep-link KPI navigation with pre-applied filters","Monitor recent visit feed","View dock door occupancy at a glance","Access AI Copilot for shift briefing"],
      validations:["KPI data refreshes every 30 seconds","Aged trailer threshold configurable by admin"],
      next:"→ Appointments (review schedule) or Gate Check-In (process arrivals)"
    },
    {
      id:"4.2",name:"Appointments",badge:"APT",screenshot:"appointments",
      purpose:"Schedule and manage carrier time windows for inbound, outbound, live load, and live unload operations. Hover any confirmed appointment row to reveal an inline Check-In button — starting the gate check-in workflow pre-populated without leaving the page.",
      fields:[["Reference Number","APT-XXXXXX system identifier"],["Carrier","Carrier company for this appointment"],["Scheduled Date","Date of the appointment"],["Time Window","Start and end time for arrival window"],["Movement Type","inbound / outbound / live_load / live_unload"],["Trailer Number","Expected trailer identifier"],["Status","booked / confirmed / checked_in / completed / no_show"]],
      actions:["Create / edit / cancel appointments","Filter by date, carrier, or status","Inline Check-In on hover — no page navigation required","Link to visit on check-in"],
      validations:["Time window end must be after start","Carrier must exist in system","Duplicate appointment detection by trailer + date"],
      next:"→ Gate Check-In (when carrier arrives)"
    },
    {
      id:"4.3",name:"Gate Check-In",badge:"GATE",screenshot:"gate-checkin",
      purpose:"Unified gate operations interface combining Check-In and Check-Out workflows in a single tabbed view. Tab badges show pending counts. After check-in, transitions into a guided two-step Operational Workflow Chain for slot assignment and move dispatch.",
      fields:[["Trailer Number","Physical trailer ID (e.g., SWFT-53201)"],["Carrier","Carrier company or unknown for walk-ins"],["Driver Name","Name of the driver"],["Movement Type","Classifies the operation type"],["Gate","Entry gate used (Gate A, Gate B, etc.)"],["Notes","Free-text notes (damage, seal condition, etc.)"]],
      actions:["Standard check-in (full form)","Quick check-in (Alt+Q shortcut)","Walk-in admission","Appointment auto-link","Post-check-in Step 1: Assign yard slot inline","Post-check-in Step 2: Create move task to dock (unlocked after Step 1)","Switch to Check-Out tab from same screen"],
      validations:["Trailer number required and unique per active visit","Duplicate active trailer detection","Move task creation locked until slot assigned"],
      next:"→ Move Tasks (jockey moves trailer to assigned slot or dock)"
    },
    {
      id:"4.4",name:"Gate Check-Out",badge:"GATE",screenshot:"gate-checkout",
      purpose:"Process outbound truck departures. Verifies all holds are cleared before allowing departure. Records check-out time and closes the visit record.",
      fields:[["Visit / Trailer","Identifies the departing trailer"],["Seal Number","Outbound seal for security verification"],["Hold Status","All holds must be cleared before checkout"],["Check-Out Time","Timestamp of gate departure"],["Notes","Departure notes or final comments"]],
      actions:["Process standard check-out","Verify hold clearance","View ready-out queue","Record seal number"],
      validations:["Cannot check out if active hold exists","Trailer must be in ready_out or at_gate_out status"],
      next:"→ Visit record closed; KPI data captured; audit log updated"
    },
    {
      id:"4.5",name:"Yard Inventory",badge:"INV",screenshot:"inventory",
      purpose:"Complete live view of all trailers currently in the yard. Features include status-based grouping (collapsible groups with counts), hover-reveal row actions, and a detail drawer with a Continue Processing CTA that navigates to the trailer's next operational step.",
      fields:[["Visit Number","VST-XXXXXXXX system identifier"],["Trailer Number","Physical trailer ID"],["Carrier","Associated carrier name"],["Visit Status","arrived / checked_in / in_yard / at_dock / loading / unloading / ready_out"],["Hold Status","Active hold type or none"],["Location","Current position (slot, door, or at-gate)"],["Dwell Time","Time elapsed since check-in (auto-calculated)"],["Next Step","System-computed recommended action"]],
      actions:["Search by trailer, carrier, or visit number","Filter by status, hold, zone, or type","Group by Status view — collapses to status groups with counts","Hover row to reveal secondary action buttons","Open detail drawer with Continue Processing CTA","Navigate directly to Move Tasks, Dock, or Gate Check-Out from drawer"],
      validations:["Dwell time updates every minute","Aged threshold flagged in orange","Continue Processing CTA only shown for actionable statuses"],
      next:"→ Move Tasks (dispatch jockey) or Dock Management (assign door)"
    },
    {
      id:"4.6",name:"Yard Map",badge:"MAP",screenshot:"yard-map",
      purpose:"Visual overhead representation of the yard showing all zones and slots in real time. Enables dispatchers and yard managers to see capacity at a glance.",
      fields:[["Zone","Named yard zone (Staging Area A, Reefer Yard, etc.)"],["Slot","Individual parking position within a zone"],["Slot Status","Empty (green), Occupied (blue), Hold (red)"],["Dock Doors","10 dock doors shown at building face"]],
      actions:["View real-time slot occupancy","Hover slot for trailer details","Identify available slots visually","Monitor dock door occupancy"],
      validations:["Slot colors reflect live database state","Dock doors show current trailer assignment"],
      next:"→ Move Tasks (to dispatch jockey) or Dock Management"
    },
    {
      id:"4.7",name:"Dock Management",badge:"DOCK",screenshot:"dock",
      purpose:"Real-time management of all dock doors displayed as interactive cards. Hovering a door card reveals secondary action buttons (Release Door, View Visit, Create Move) for quick updates without opening a dialog — reducing click depth for routine operations.",
      fields:[["Door Number","D-01 through D-10"],["Door Status","available / loading / unloading / at_dock"],["Trailer Number","Trailer currently at this door"],["Carrier","Carrier for the trailer at dock"],["Movement Type","live_load / live_unload / outbound / inbound"],["Time at Dock","Duration since trailer assigned to door"]],
      actions:["Assign trailer to door","Update status via primary action button","Hover card: Release Door / View Visit / Create Move — no dialog required","View all 10 doors simultaneously"],
      validations:["One trailer per door at a time","Door must be available to accept new assignment"],
      next:"→ Move Tasks (stage for departure) or Gate Check-Out"
    },
    {
      id:"4.8",name:"Move Tasks",badge:"MOVE",screenshot:"move-tasks",
      purpose:"Dispatch and tracking system for all yard jockey operations. Features two view modes: Table (default) and Jockey Board (kanban with drag-and-drop reassignment). Sticky Jockey and Actions columns, multi-select batch toolbar, and audio alerts complete the operational workflow.",
      fields:[["Move Type","gate_to_slot / slot_to_dock / dock_to_yard / reposition / slot_to_gate"],["Trailer / Visit","The trailer to be moved"],["From / To Location","Current and target positions"],["Priority","Critical / High / Medium / Low"],["Status","open → assigned → accepted → in_progress → completed"],["Assigned To","Yard jockey responsible"],["SLA Age","Time since task created (overdue if >2h)"]],
      actions:["Supervisor: create task, bulk assign, change priority","Jockey: claim, accept, start, complete","Reject task with reason","Queue tabs: Unassigned / In Progress / Completed","Toggle to Jockey Board (kanban) view — supervisors only","Drag task card between jockey columns to reassign","Multi-select + floating batch toolbar for bulk operations","Audio alert on task completion"],
      validations:["One active move per trailer at a time","SLA breach flags task after 2 hours","Batch operations apply atomically"],
      next:"→ Dock Management (slot-to-dock) or Gate Check-Out (staging-to-gate)"
    },
    {
      id:"4.9",name:"Holds & Exceptions",badge:"HLD",screenshot:"exceptions",
      purpose:"Centralized exception management for all trailer holds. Holds block gate check-out and trigger notifications. Supervisors can create, escalate, and resolve holds with full audit trail.",
      fields:[["Hold Type","quality / customs / safety / carrier / damage / other"],["Severity","low / medium / high / critical"],["Visit / Trailer","The affected trailer and visit record"],["Created By","User who opened the hold"],["Resolution","Free-text resolution note and resolver identity"],["Status","open / escalated / resolved"]],
      actions:["Create hold with type and severity","Escalate hold to higher severity","Resolve hold with resolution note","Filter by status, type, or severity","View full hold history per trailer"],
      validations:["Gate check-out blocked while hold is active","Escalation requires reason text","Resolution requires supervisor role"],
      next:"→ Gate Check-Out (after hold resolution) or Yard Inventory (trailer remains in yard)"
    },
    {
      id:"4.10",name:"Yard Walk / Audit",badge:"WALK",screenshot:"yard-audit",
      purpose:"Physical yard audit tool for confirming or correcting slot assignments during a yard walk. Guards scan or manually enter trailer positions to reconcile digital records with physical reality.",
      fields:[["Slot","The yard slot being verified"],["Expected Trailer","What the system shows in that slot"],["Actual Trailer","What the guard physically observed"],["Discrepancy","Flagged when expected ≠ actual"],["Audit Timestamp","When the slot was verified"],["Auditor","User who performed the walk"]],
      actions:["Start a yard walk session","Verify each slot (match or mismatch)","Flag discrepancies for supervisor review","Complete audit and generate summary report"],
      validations:["All slots must be visited to mark audit complete","Discrepancies require supervisor acknowledgment"],
      next:"→ Yard Inventory (correct slot assignments) or Holds & Exceptions (if trailer missing)"
    },
    {
      id:"4.11",name:"Inspections",badge:"INSP",screenshot:"inspections",
      purpose:"Pre-departure and arrival inspection checklist system. Captures trailer condition, seal verification, and safety compliance before gate exit.",
      fields:[["Inspection Type","arrival / pre-departure / damage / safety"],["Trailer / Visit","Inspected trailer and linked visit"],["Checklist Items","Pass/fail for each inspection point"],["Damage Notes","Free-text description of any damage observed"],["Inspector","User conducting the inspection"],["Outcome","pass / fail / conditional"]],
      actions:["Create inspection for a trailer","Complete checklist items","Mark pass / fail / conditional","Add damage notes and photo references","Link inspection to visit record"],
      validations:["All checklist items must be completed","Failed inspections auto-create a hold","Conditional outcome requires supervisor sign-off"],
      next:"→ Gate Check-Out (if passed) or Holds & Exceptions (if failed)"
    },
    {
      id:"4.12",name:"Reports & Analytics",badge:"RPT",screenshot:"reports",
      purpose:"Operational intelligence center providing daily throughput, dwell time analysis, carrier performance, move task efficiency, and detention/demurrage summaries.",
      fields:[["Report Type","Daily Throughput / Dwell Analysis / Carrier Scorecard / Move Efficiency / D&D Summary"],["Date Range","Configurable time window for report scope"],["Carrier Filter","Narrow report to a specific carrier"],["Export Format","PDF / CSV download"]],
      actions:["Select report type and date range","Filter by carrier or zone","Generate on-demand report","Export to PDF or CSV","View trend charts"],
      validations:["Date range end must be after start","Carrier filter optional for all report types"],
      next:"→ Management review; data feeds back into operational planning"
    },
    {
      id:"4.13",name:"Administration Modules",badge:"ADM",screenshot:"yard-setup",
      purpose:"System configuration and management modules including Carrier Management (SCAC code registry, contact records, performance tracking), Yard Setup (zones, slots, dock doors, SLA thresholds), Audit Log (immutable system event log), and User Management.",
      fields:[["Carrier","SCAC code, company name, contact info, active status"],["Yard Zone","Zone name, capacity, type (staging/reefer/dry)"],["Yard Slot","Slot ID, zone assignment, slot type"],["Dock Door","Door number, type (inbound/outbound/cross)"],["User","Name, role, active status, last login"]],
      actions:["Add/edit/deactivate carriers","Create/modify yard zones and slots","Configure dock doors","View immutable audit log with filters","Manage user accounts and role assignments"],
      validations:["SCAC code unique per carrier","Slot ID unique within zone","Audit log is read-only — no edits permitted"],
      next:"→ All operational modules rely on this reference data"
    },
  ].map(m=>`
    <h3>${m.id} — ${m.name} <span class="badge">${m.badge}</span></h3>
    <div class="module-card">
      <div class="module-header"><span class="badge">${m.badge}</span><h3>${m.name}</h3></div>
      <div class="module-body">
        ${screenshotImg(m.screenshot ?? "", `${m.name} — live application screenshot`)}
        <div class="section-label">Purpose</div>
        <p>${m.purpose}</p>
        <div class="section-label">Key Fields &amp; Data Elements</div>
        <table><thead><tr><th>Field</th><th>Description</th></tr></thead><tbody>${m.fields.map((f: string[])=>`<tr><td class="mono">${f[0]}</td><td>${f[1]}</td></tr>`).join("")}</tbody></table>
        <div class="two-col">
          <div><div class="section-label">Available Actions</div><ul class="action-list">${m.actions.map((a: string)=>`<li>${a}</li>`).join("")}</ul></div>
          <div><div class="section-label">Validations &amp; Rules</div><ul class="validation-list">${m.validations.map((v: string)=>`<li>${v}</li>`).join("")}</ul></div>
        </div>
        <div class="next-step">${m.next}</div>
      </div>
    </div>
  `).join("")}

  <!-- NEW MODULES -->
  <h3>4.14 — Notifications Center <span class="badge" style="background:#6366f1">SYS</span></h3>
  <div class="module-card">
    <div class="module-header"><span class="badge" style="background:#6366f1">SYS</span><h3>Notifications Center</h3></div>
    <div class="module-body">
      ${screenshotImg("notifications", "Notifications Center — live application screenshot")}
      <div class="section-label">Purpose</div>
      <p>Real-time alert hub consolidating all system-generated events: holds, aged trailers, dock conflicts, inspection failures, and move completions. Badge count on the bell icon provides at-a-glance awareness from any module.</p>
      <div class="section-label">Key Fields</div>
      <table><thead><tr><th>Field</th><th>Description</th></tr></thead><tbody>
        <tr><td class="mono">Alert Type</td><td>Hold Created, Trailer Aged, Dock Conflict, Inspection Failed, Move Completed, Gate Activity</td></tr>
        <tr><td class="mono">Severity</td><td>Critical / High / Medium / Low — controls badge color and sort order</td></tr>
        <tr><td class="mono">Timestamp</td><td>Exact time the event was generated</td></tr>
        <tr><td class="mono">Related Entity</td><td>Visit ID, trailer number, or dock door linked to the notification</td></tr>
      </tbody></table>
      <div class="next-step">→ Respective module linked in the alert (Holds &amp; Exceptions, Dock Management, Move Tasks)</div>
    </div>
  </div>

  <h3>4.15 — Gate Guard Mode <span class="badge" style="background:#CC2229">GATE</span></h3>
  <div class="module-card">
    <div class="module-header"><span class="badge" style="background:#CC2229">GATE</span><h3>Gate Guard Mode</h3></div>
    <div class="module-body">
      ${screenshotImg("gate-guard", "Gate Guard Mode — live application screenshot")}
      <div class="section-label">Purpose</div>
      <p>Simplified, full-screen interface for gate workstations. Presents only Check-In and Check-Out in a focused tabbed view. Designed for tablet or kiosk hardware at physical gate stations.</p>
      <div class="info-box"><strong>Role Context:</strong> Users logged in with the Gate Guard role see a streamlined interface with administrative navigation hidden, optimized for high-speed gate processing.</div>
      <div class="next-step">→ Yard Inventory (trailer registered after check-in) → Move Tasks (movement dispatched)</div>
    </div>
  </div>

  <h3>4.16 — Carrier Self-Service Portal <span class="badge" style="background:#0891b2">PRT</span></h3>
  <div class="module-card">
    <div class="module-header"><span class="badge" style="background:#0891b2">PRT</span><h3>Carrier Self-Service Portal</h3></div>
    <div class="module-body">
      ${screenshotImg("carrier-portal", "Carrier Self-Service Portal — live application screenshot")}
      <div class="section-label">Purpose</div>
      <p>Carrier-facing interface allowing logistics partners to view their own appointment status, check trailer position, and receive arrival instructions — without accessing the full operational system.</p>
      <div class="section-label">Access Rules</div>
      <ul class="validation-list">
        <li>Carrier role sees only their own trailers and appointments</li>
        <li>No ability to create or modify records — read-only access</li>
        <li>Sensitive dock details visible only after check-in</li>
      </ul>
      <div class="next-step">→ Read-only view; operational actions require internal YMSNOW user roles</div>
    </div>
  </div>

  <!-- 8. WORKFLOW CHAIN -->
  <h2>8. Operational Workflow Chain — Guided Processing</h2>
  <p>The Operational Workflow Chain eliminates decision paralysis by surfacing the next operational action contextually — exactly where and when it is needed.</p>
  ${screenshotImg("gate-checkin", "Figure 8-A — Gate Check-In module showing two-step Workflow Chain panel after trailer confirmation")}
  <h3>Trigger: Gate Check-In Completion</h3>
  <p>After check-in confirmation, the system transitions into a two-step guided panel:</p>
  <div class="process-box">
    <div class="step"><div class="step-num">1</div><div class="step-content"><h4>Assign to Yard Slot</h4><p>Slot picker appears with available slots by zone. Selecting a slot marks the circle green. A "View in Yard →" link appears.</p><div class="step-outcome">visit.yardSlot updated → status: in_yard</div></div></div>
    <div class="step"><div class="step-num">2</div><div class="step-content"><h4>Ready for Dock? Create Move</h4><p>Locked until Step 1 completes. Creates a move task to dock directly from the check-in panel.</p><div class="step-outcome">Move task created → trailer enters jockey work queue</div></div></div>
  </div>
  <h3>Trigger: Yard Inventory Detail Drawer</h3>
  <p>The drawer bottom shows a "Continue Processing" CTA based on trailer status:</p>
  <table>
    <thead><tr><th>Trailer Status</th><th>CTA Label</th><th>Destination</th></tr></thead>
    <tbody>
      <tr><td class="mono">in_yard / checked_in</td><td>Create Move to Dock</td><td>Move Tasks (/moves)</td></tr>
      <tr><td class="mono">at_dock / loading / unloading</td><td>Go to Dock Management</td><td>Dock Management (/dock)</td></tr>
      <tr><td class="mono">ready_out</td><td>Process Gate Exit</td><td>Gate Check-Out (/gate/check-out)</td></tr>
      <tr><td class="mono">on_hold / inspection</td><td>No CTA shown</td><td>Resolve exception first</td></tr>
    </tbody>
  </table>

  <!-- 9. JOCKEY BOARD -->
  <h2>9. Jockey Board View — Shift Planning</h2>
  <p>A kanban-style shift planning interface in the Move Tasks module for supervisors and yard managers. Provides visual, drag-and-drop workload distribution across all active jockeys.</p>
  ${screenshotImg("jockey-board", "Figure 9-A — Jockey Board kanban columns per jockey with drag-and-drop task reassignment")}
  <div class="info-box"><strong>Access:</strong> Admin, Yard Manager, Supervisor roles only. Toggle is in the Move Tasks filter bar (Table / Board icon buttons). Jockeys see their own personal card grid.</div>
  <h3>Board Layout</h3>
  <table>
    <thead><tr><th>Column</th><th>Description</th></tr></thead>
    <tbody>
      <tr><td class="mono">Unassigned</td><td>All tasks with no jockey assigned. Must be claimed or assigned before work begins.</td></tr>
      <tr><td class="mono">Jockey Name</td><td>One column per jockey. Shows task count and availability (Available / On Break / Busy). Tasks sorted by priority.</td></tr>
    </tbody>
  </table>
  <h3>Drag-and-Drop Reassignment</h3>
  <p>Drag a task card from one column to another to reassign. The system calls PATCH /api/moves/:id immediately on drop, updating the jockey assignment in real time. The Table view reflects changes instantly when toggled back.</p>
  <div class="warning-box"><strong>Operational Note:</strong> Board and Table views are fully synchronized. Changes in one view are immediately reflected in the other.</div>

  <hr style="margin: 48px 0; border-color: #e5e7eb;" />
  <p style="text-align:center; font-size:11px; color:#999;">KSAP OTM Now — YMSNOW Yard Management System &nbsp;|&nbsp; Product Manual v2.0 &nbsp;|&nbsp; March 2026 &nbsp;|&nbsp; Confidential</p>
</div>
</body>
</html>`;
}
