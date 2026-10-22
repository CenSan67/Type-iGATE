// The one emergency RFID card, fixed like the master card. Decimal "Card DEC" id as the gate
// reader decodes it (26-bit card: the raw 26-bit value incl. parity) - the same form
// rfidUsers.rfidId uses. HAND-COPIED in sketch_scanner's secrets.h (SECRET_EMERGENCY_CARD_ID)
// and database.rules.json (rfidUsers/$id/rfidId) - change all three together.
export const EMERGENCY_CARD_ID = '42502658'
