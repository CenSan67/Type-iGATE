export const PAYMENT_TYPES = ['Registration', 'Renewal']
export const PAYMENT_STATUSES = ['Paid', 'Pending']

/**
 * @typedef {Object} Payment
 * @property {string} rfidId
 * @property {string} name
 * @property {string} department
 * @property {string} plateNumber
 * @property {'Registration'|'Renewal'} paymentType
 * @property {number} amount - the fee charged (what "Total Collected" sums).
 * @property {'Paid'|'Pending'} status
 * @property {string} date
 * @property {string} time
 * @property {number} [validUntil]
 * @property {number} timestamp
 * @property {string} [vehicleType]
 * @property {number} [amountTendered] - cash handed over; >= amount. Older records: equals amount.
 * @property {number} [change] - amountTendered - amount.
 * @property {string} [receiptNo] - system-issued sequential receipt number (OR-000123).
 * @property {string} [receivedBy] - uid of the staff member who took the payment (rules force it to be the writer).
 * @property {string} [receivedByName]
 * @property {string[]} [docsVerified] - documents the guard checked against the originals
 *   ('license' | 'orcr' | 'validId'). Verify-only: no document images or numbers are stored.
 * @property {string} [licenseExpiry] - YYYY-MM-DD read off the driver's license, to flag expiry later.
 * @property {number} [consentAt] - when the privacy consent was recorded (ms epoch).
 * @property {string} [privacyNoticeVersion] - version of the consent wording shown.
 */

/** @param {Partial<Payment>} data @returns {Payment} */
export function validatePayment(data) {
  if (!data.rfidId || typeof data.rfidId !== 'string' || !data.rfidId.trim()) {
    throw new Error('Payment: rfidId is required')
  }
  if (typeof data.amount !== 'number' || Number.isNaN(data.amount) || data.amount < 0) {
    throw new Error('Payment: amount must be a non-negative number')
  }
  if (data.paymentType && !PAYMENT_TYPES.includes(data.paymentType)) {
    throw new Error(`Payment: paymentType must be one of ${PAYMENT_TYPES.join(', ')}`)
  }
  if (data.status && !PAYMENT_STATUSES.includes(data.status)) {
    throw new Error(`Payment: status must be one of ${PAYMENT_STATUSES.join(', ')}`)
  }
  if (data.amountTendered != null && (typeof data.amountTendered !== 'number' || data.amountTendered < data.amount)) {
    throw new Error('Payment: amount paid is less than the amount due')
  }
  const amountTendered = data.amountTendered ?? data.amount

  return {
    rfidId: data.rfidId,
    name: data.name || '',
    department: data.department || '',
    plateNumber: data.plateNumber || '',
    paymentType: data.paymentType || 'Registration',
    amount: data.amount,
    status: data.status || 'Paid',
    date: data.date || '',
    time: data.time || '',
    validUntil: typeof data.validUntil === 'number' ? data.validUntil : null,
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : Date.now(),
    vehicleType: data.vehicleType || '',
    amountTendered,
    change: amountTendered - data.amount,
    receiptNo: data.receiptNo || '',
    receivedBy: data.receivedBy || '',
    receivedByName: data.receivedByName || '',
    docsVerified: Array.isArray(data.docsVerified) ? data.docsVerified : [],
    licenseExpiry: data.licenseExpiry || '',
    consentAt: typeof data.consentAt === 'number' ? data.consentAt : null,
    privacyNoticeVersion: data.privacyNoticeVersion || '',
  }
}
