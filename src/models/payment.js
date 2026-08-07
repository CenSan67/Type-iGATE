export const PAYMENT_TYPES = ['Registration', 'Renewal']
export const PAYMENT_STATUSES = ['Paid', 'Pending']

/**
 * @typedef {Object} Payment
 * @property {string} rfidId
 * @property {string} name
 * @property {string} department
 * @property {string} plateNumber
 * @property {'Registration'|'Renewal'} paymentType
 * @property {number} amount
 * @property {'Paid'|'Pending'} status
 * @property {string} date
 * @property {string} time
 * @property {number} [validUntil]
 * @property {number} timestamp
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
  }
}
