import OpenAI from "openai";
import { db } from "../db";
import {
  carrierContacts,
  inboundEmailLog,
  emailAiAlerts,
  emailIntelligenceConfig,
  type EmailAiAlert,
  type EmailIntelligenceConfig,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";

let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({
      apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || process.env.OPENAI_API_KEY || "placeholder",
      baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
    });
  }
  return _openai;
}

const DEMO_SHIPMENTS: Record<string, { status: string; label: string }> = {
  "SHP-10024": { status: "appointment_confirmed", label: "Appointment Confirmed" },
  "SHP-10031": { status: "gate_in_completed", label: "Gate In Completed" },
  "SHP-10045": { status: "waiting_for_dock", label: "Waiting for Dock" },
  "SHP-10052": { status: "unloading_started", label: "Unloading Started" },
  "SHP-10061": { status: "vehicle_verified", label: "Vehicle Verified" },
};

const DEMO_EMAILS = [
  {
    senderEmail: "ops@fastmove.com",
    subject: "SHP-10024 - Truck delayed due to breakdown",
    emailBody:
      "Vehicle has broken down on the way. Expected delay is 3 hours. Our driver is waiting for roadside assistance. Please note this will impact planned dock timing.",
    receivedAt: new Date(Date.now() - 25 * 60000),
  },
  {
    senderEmail: "alerts@bluedartdemo.com",
    subject: "SHP-10031 - Request to reschedule appointment",
    emailBody:
      "Driver has arrived at a different site first. Please move the slot by 2 hours. We apologize for the inconvenience and appreciate your flexibility.",
    receivedAt: new Date(Date.now() - 18 * 60000),
  },
  {
    senderEmail: "dispatch@roadaxis.com",
    subject: "SHP-10045 - Urgent unloading required",
    emailBody:
      "This shipment contains priority material and requires urgent unloading. Customer has escalated to management. Please treat as high priority.",
    receivedAt: new Date(Date.now() - 12 * 60000),
  },
  {
    senderEmail: "ops@fastmove.com",
    subject: "SHP-10052 - Cancel shipment",
    emailBody:
      "Customer has asked to cancel this delivery. Please halt the unloading process immediately and arrange for return pickup.",
    receivedAt: new Date(Date.now() - 8 * 60000),
  },
  {
    senderEmail: "alerts@bluedartdemo.com",
    subject: "SHP-10061 - Vehicle changed for this shipment",
    emailBody:
      "Original truck unavailable due to mechanical issues. Replacement vehicle (different plate) will arrive instead. Driver confirmation attached.",
    receivedAt: new Date(Date.now() - 5 * 60000),
  },
  {
    senderEmail: "unknowncarrier@test.com",
    subject: "SHP-10024 - Need urgent help",
    emailBody: "Please call urgently. This is very important.",
    receivedAt: new Date(Date.now() - 3 * 60000),
  },
];

export function extractShipmentRef(subject: string): string | null {
  const patterns = [
    /\b(SHP-\d+)\b/i,
    /\b(SHIPMENT-\d+)\b/i,
    /\b(REF-\d+)\b/i,
    /\b(VST-[A-Z0-9]+)\b/i,
  ];
  for (const p of patterns) {
    const m = subject.match(p);
    if (m) return m[1].toUpperCase();
  }
  return null;
}

function checkConflict(intent: string, shipmentStatus: string): { conflict: boolean; reason: string } {
  const i = intent.toLowerCase();
  const s = shipmentStatus.toLowerCase();
  if (i.includes("reschedule") && (s === "gate_in_completed" || s === "checked_in"))
    return { conflict: true, reason: "Reschedule requested after gate-in — shipment already on premises" };
  if (i.includes("cancel") && (s === "unloading_started" || s === "loading" || s === "unloading"))
    return { conflict: true, reason: "Cancellation requested after operation start — manual override required" };
  if ((i.includes("vehicle_change") || i.includes("vehicle change")) && (s === "vehicle_verified" || s === "checked_in"))
    return { conflict: true, reason: "Vehicle change after verification — requires supervisor approval" };
  if ((i.includes("urgent_unloading") || i.includes("urgent unload")) && (s === "waiting_for_dock" || s === "at_dock"))
    return { conflict: true, reason: "Priority change may impact current dock queue" };
  return { conflict: false, reason: "" };
}

export async function getEmailIntelligenceConfig(): Promise<EmailIntelligenceConfig> {
  const rows = await db.select().from(emailIntelligenceConfig).limit(1);
  if (rows.length === 0) {
    const [created] = await db
      .insert(emailIntelligenceConfig)
      .values({ testModeEnabled: true, fixedTestSupervisorEmail: "akhil@ksaptech.com", allowedSenderValidation: true, aiConfidenceThreshold: "0.70" })
      .returning();
    return created;
  }
  return rows[0];
}

async function runAiAnalysis(emailData: {
  senderEmail: string;
  subject: string;
  emailBody: string;
  shipmentStatus: string;
}): Promise<{
  detected_intent: string;
  summary_for_supervisor: string;
  actionable_for_supervisor: string;
  recommended_yms_action: string;
  conflict_check_needed: boolean;
  confidence_score: number;
}> {
  const fallback = {
    detected_intent: "general_escalation",
    summary_for_supervisor: "Carrier email received — review required.",
    actionable_for_supervisor: "Review email and determine appropriate action.",
    recommended_yms_action: "Contact carrier and update shipment status as needed.",
    conflict_check_needed: false,
    confidence_score: 0.5,
  };
  try {
    const resp = await getOpenAI().chat.completions.create({
      model: "gpt-5.1",
      max_completion_tokens: 400,
      messages: [
        {
          role: "system",
          content:
            "You are a YMS (Yard Management System) AI assistant. Analyze carrier emails and provide structured operational recommendations. Respond ONLY with valid JSON — no markdown.",
        },
        {
          role: "user",
          content: `Analyze this inbound carrier email:\nFrom: ${emailData.senderEmail}\nSubject: ${emailData.subject}\nBody: ${emailData.emailBody}\nCurrent Shipment Status: ${emailData.shipmentStatus}\n\nReturn JSON:\n{\n  "detected_intent": "delay|reschedule_request|urgent_unloading_request|cancellation_request|vehicle_change_request|general_escalation",\n  "summary_for_supervisor": "one sentence",\n  "actionable_for_supervisor": "specific next step",\n  "recommended_yms_action": "exact YMS action",\n  "conflict_check_needed": true/false,\n  "confidence_score": 0.0-1.0\n}`,
        },
      ],
    });
    const text = (resp.choices[0]?.message?.content ?? "{}").replace(/```json?\n?/gi, "").replace(/```/g, "").trim();
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

export async function seedCarrierContacts() {
  const existing = await db.select().from(carrierContacts);
  if (existing.length === 0) {
    await db.insert(carrierContacts).values([
      { carrierName: "FastMove Logistics", contactName: "FastMove Operations", contactEmail: "ops@fastmove.com", isActive: true, allowedForEmailIntelligence: true },
      { carrierName: "BlueDart Carrier Ops", contactName: "BlueDart Alerts", contactEmail: "alerts@bluedartdemo.com", isActive: true, allowedForEmailIntelligence: true },
      { carrierName: "RoadAxis Transport", contactName: "RoadAxis Dispatch", contactEmail: "dispatch@roadaxis.com", isActive: true, allowedForEmailIntelligence: true },
    ]);
  }
}

function intentLabel(intent: string) {
  return intent.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export async function processDemoEmails(): Promise<{ processed: number; alerts: EmailAiAlert[] }> {
  const config = await getEmailIntelligenceConfig();
  await db.delete(emailAiAlerts);
  await db.delete(inboundEmailLog);
  await seedCarrierContacts();

  const allContacts = await db.select().from(carrierContacts);
  const contactMap = new Map(allContacts.map((c) => [c.contactEmail.toLowerCase(), c]));
  const alerts: EmailAiAlert[] = [];

  for (const demo of DEMO_EMAILS) {
    const contact = contactMap.get(demo.senderEmail.toLowerCase());
    const isValid = !!contact && contact.isActive && contact.allowedForEmailIntelligence;
    const ref = extractShipmentRef(demo.subject);
    const shipment = ref ? DEMO_SHIPMENTS[ref.toUpperCase()] : null;

    const matchStatus = !isValid ? "invalid_sender" : shipment ? "matched" : ref ? "unmatched" : "no_ref";

    let aiResult = {
      detected_intent: "general_escalation",
      summary_for_supervisor: "Invalid sender — cannot process automatically.",
      actionable_for_supervisor: "Verify sender identity before taking action.",
      recommended_yms_action: "Flag for manual review.",
      conflict_check_needed: false,
      confidence_score: 0.0,
    };
    let clash = { conflict: false, reason: "" };

    if (isValid) {
      aiResult = await runAiAnalysis({
        senderEmail: demo.senderEmail,
        subject: demo.subject,
        emailBody: demo.emailBody,
        shipmentStatus: shipment?.label ?? "Unknown",
      });
      if (shipment) clash = checkConflict(aiResult.detected_intent, shipment.status);
    }

    const supervisorEmail = config.testModeEnabled ? config.fixedTestSupervisorEmail : null;

    const [log] = await db
      .insert(inboundEmailLog)
      .values({
        senderEmail: demo.senderEmail,
        subject: demo.subject,
        emailBody: demo.emailBody,
        receivedAt: demo.receivedAt,
        matchedShipmentRef: ref,
        matchedShipmentId: null,
        matchStatus,
        aiSummary: aiResult.summary_for_supervisor,
        aiActionable: aiResult.actionable_for_supervisor,
        aiIntent: aiResult.detected_intent,
        conflictFlag: clash.conflict,
        conflictReason: clash.reason || null,
        routedSupervisorEmail: supervisorEmail,
        status: "new",
      })
      .returning();

    const priority = !isValid ? "low" : clash.conflict ? "high" : aiResult.detected_intent === "urgent_unloading_request" ? "high" : "medium";
    const alertTitle = !isValid
      ? `Invalid Sender: ${demo.senderEmail}`
      : ref
      ? `${ref}: ${intentLabel(aiResult.detected_intent)}`
      : `Unmatched Email — ${contact?.carrierName ?? demo.senderEmail}`;
    const alertMessage = ref
      ? `Shipment ${ref}: ${aiResult.summary_for_supervisor} Suggested action: ${aiResult.recommended_yms_action}. Conflict: ${clash.conflict ? "Yes" : "No"}.`
      : aiResult.summary_for_supervisor;

    const [alert] = await db
      .insert(emailAiAlerts)
      .values({
        inboundEmailId: log.id,
        shipmentId: null,
        shipmentRefNo: ref,
        alertTitle,
        alertMessage,
        priority,
        suggestedAction: aiResult.recommended_yms_action,
        conflictFlag: clash.conflict,
        conflictReason: clash.reason || null,
        supervisorEmailTarget: supervisorEmail,
        alertStatus: "new",
      })
      .returning();
    alerts.push(alert);
  }
  return { processed: DEMO_EMAILS.length, alerts };
}

export async function getEmailAlertsFull() {
  return db
    .select({
      id: emailAiAlerts.id,
      alertTitle: emailAiAlerts.alertTitle,
      alertMessage: emailAiAlerts.alertMessage,
      priority: emailAiAlerts.priority,
      shipmentRefNo: emailAiAlerts.shipmentRefNo,
      suggestedAction: emailAiAlerts.suggestedAction,
      conflictFlag: emailAiAlerts.conflictFlag,
      conflictReason: emailAiAlerts.conflictReason,
      supervisorEmailTarget: emailAiAlerts.supervisorEmailTarget,
      alertStatus: emailAiAlerts.alertStatus,
      createdAt: emailAiAlerts.createdAt,
      senderEmail: inboundEmailLog.senderEmail,
      subject: inboundEmailLog.subject,
      emailBody: inboundEmailLog.emailBody,
      receivedAt: inboundEmailLog.receivedAt,
      matchStatus: inboundEmailLog.matchStatus,
      aiSummary: inboundEmailLog.aiSummary,
      aiActionable: inboundEmailLog.aiActionable,
      aiIntent: inboundEmailLog.aiIntent,
      routedSupervisorEmail: inboundEmailLog.routedSupervisorEmail,
      inboundEmailId: emailAiAlerts.inboundEmailId,
    })
    .from(emailAiAlerts)
    .leftJoin(inboundEmailLog, eq(emailAiAlerts.inboundEmailId, inboundEmailLog.id))
    .orderBy(desc(emailAiAlerts.createdAt));
}
