export const ROLE_META: Record<string, { label: string; color: string; bg: string }> = {
  admin:        { label: "Administrator",  color: "#818CF8", bg: "#312E81" },
  yard_manager: { label: "Yard Manager",   color: "#34D399", bg: "#064E3B" },
  gate_guard:   { label: "Gate Guard",     color: "#60A5FA", bg: "#1E3A5F" },
  yard_jockey:  { label: "Yard Jockey",    color: "#FBBF24", bg: "#431407" },
  dock_user:    { label: "Dock User",      color: "#F87171", bg: "#450A0A" },
  carrier:      { label: "Carrier",        color: "#A78BFA", bg: "#2D1B69" },
};

export const DEMO_USERS = [
  { id: "demo-admin-001", firstName: "Sandra",  lastName: "Mitchell", username: "s.mitchell", role: "admin",        email: "s.mitchell@ymsnow.com" },
  { id: "demo-ym-001",    firstName: "Robert",  lastName: "Chen",     username: "r.chen",     role: "yard_manager", email: "r.chen@ymsnow.com" },
  { id: "demo-gg-001",    firstName: "Maria",   lastName: "Gonzalez", username: "m.gonzalez", role: "gate_guard",   email: "m.gonzalez@ymsnow.com" },
  { id: "demo-gg-002",    firstName: "Jamal",   lastName: "Williams", username: "j.williams", role: "gate_guard",   email: "j.williams@ymsnow.com" },
  { id: "demo-yj-001",    firstName: "Tommy",   lastName: "Kowalski", username: "t.kowalski", role: "yard_jockey",  email: "t.kowalski@ymsnow.com" },
  { id: "demo-yj-002",    firstName: "DeShawn", lastName: "Carter",   username: "d.carter",   role: "yard_jockey",  email: "d.carter@ymsnow.com" },
  { id: "demo-du-001",    firstName: "Lisa",    lastName: "Park",     username: "l.park",     role: "dock_user",    email: "l.park@ymsnow.com" },
  { id: "demo-cr-001",    firstName: "Tyler",   lastName: "Brooks",   username: "t.brooks",   role: "carrier",      email: "t.brooks@swifttrans.com" },
];

export type DemoUser = (typeof DEMO_USERS)[number];
