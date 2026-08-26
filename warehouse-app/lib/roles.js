// Warehouse operation roles used across the app.
// Edit STAFF to match your real team members and their assigned roles.

export const ROLES = {
  MANAGER: "MANAGER",
  PICKER: "PICKER",
  PACKER: "PACKER",
  MOVER: "MOVER",
  PUTAWAY: "PUTAWAY",
  FNV: "FNV",
  AUDIT: "AUDIT",
  EXP_AUDIT: "EXP_AUDIT",
  INVENTORY_AUDIT: "INVENTORY_AUDIT",
};

// The order-processing pipeline, in sequence.
// Each order moves through these stages; a random available staff member
// whose roles include the stage is auto-assigned.
export const STAGE_SEQUENCE = [
  { key: "PUTAWAY", label: "Putaway", role: ROLES.PUTAWAY },
  { key: "PICKING", label: "Picking", role: ROLES.PICKER },
  { key: "AUDIT", label: "Item Audit", role: ROLES.AUDIT },
  { key: "PACKING", label: "Packing", role: ROLES.PACKER },
  { key: "DISPATCH", label: "Dispatch / Move Out", role: ROLES.MOVER },
];

// Demo staff directory. phone is used for OTP login.
// roles: array of role codes this person can be auto-assigned to.
export const STAFF = [
  { id: "bhaskar", name: "Bhaskar N S (SM)", phone: "8431453058", roles: [ROLES.MANAGER, ROLES.PUTAWAY, ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.MOVER] },
  { id: "deepu", name: "Deepu B (ASM)", phone: "8050475078", roles: [ROLES.MANAGER, ROLES.PUTAWAY, ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.MOVER, ROLES.INVENTORY_AUDIT] },
  { id: "harshitha", name: "A B Harshitha (MD)", phone: "8971720997", roles: [ROLES.MANAGER, ROLES.EXP_AUDIT, ROLES.INVENTORY_AUDIT, ROLES.PICKER, ROLES.AUDIT, ROLES.PACKER, ROLES.MOVER] },
  { id: "thrupthi", name: "Thrupthi K S", phone: "9000000004", roles: [ROLES.FNV, ROLES.AUDIT, ROLES.INVENTORY_AUDIT, ROLES.PACKER, ROLES.PICKER] },
  { id: "sinchana", name: "Sinchana B R", phone: "9000000005", roles: [ROLES.INVENTORY_AUDIT, ROLES.MOVER, ROLES.PICKER, ROLES.PUTAWAY] },
];

export function staffForRole(role) {
  return STAFF.filter((s) => s.roles.includes(role));
}

export function staffByPhone(phone) {
  return STAFF.find((s) => s.phone === phone);
}

export function staffById(id) {
  return STAFF.find((s) => s.id === id);
}
