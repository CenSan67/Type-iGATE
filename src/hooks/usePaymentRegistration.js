import { useAuth } from '../context/AuthContext'
import { upsertRfidUser, getNextReceiptNo, assertOnline } from '../services/firebase'
import { getVehicleFee, REGISTRATION_VALIDITY_MONTHS, PRIVACY_NOTICE_VERSION } from '../constants/fees'
import { toLocalISODate } from '../utils/dateRange'

// A successful payment doubles as registration: it creates the rfidUsers record if this card is
// new, or refreshes it (and its validity) on renewal, then records the payment with the
// verification/consent evidence and a system-issued receipt number. Returns the receipt data
// for ReceiptModal. `form` is RegistrationModal's form state.
export default function usePaymentRegistration() {
  const { user, profile } = useAuth()
  const staffName = profile?.fullName || profile?.displayName || user?.email || ''

  const register = async (form) => {
    // Needs a receipt number from the server - checked first so nothing is half-saved offline.
    assertOnline('registration')
    const now = new Date()
    const rfidId = form.rfid.trim()
    const name = form.name.trim()
    const department = form.department.trim() || 'BSIT'
    const plateNumber = form.plate.trim().toUpperCase()
    const amountDue = getVehicleFee(form.vehicle)
    const amountPaid = Number(form.tendered)

    const validUntilDate = new Date(now)
    validUntilDate.setMonth(validUntilDate.getMonth() + REGISTRATION_VALIDITY_MONTHS)

    const receiptNo = await getNextReceiptNo()

    // One atomic write: the registration only exists together with its payment (rules).
    await upsertRfidUser({
      rfidId,
      name,
      department,
      plateNumber,
      vehicleType: form.vehicle,
      vehicleColor: form.color,
      role: form.role,
      email: form.email?.trim() || '',
      phone: form.phone,
    }, { payment: {
      rfidId,
      name,
      department,
      plateNumber,
      paymentType: form.paymentType,
      amount: amountDue,
      amountTendered: amountPaid,
      status: 'Paid',
      date: toLocalISODate(now),
      time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
      validUntil: validUntilDate.getTime(),
      vehicleType: form.vehicle,
      receiptNo,
      receivedBy: user?.uid,
      receivedByName: staffName,
      docsVerified: Object.keys(form.docs).filter((doc) => form.docs[doc]),
      licenseExpiry: form.licenseExpiry,
      consentAt: now.getTime(),
      privacyNoticeVersion: PRIVACY_NOTICE_VERSION,
    } })

    return {
      receiptNo,
      name,
      plate: plateNumber,
      department,
      rfid: rfidId,
      vehicle: form.vehicle,
      paymentType: form.paymentType,
      amountDue,
      amountPaid,
      change: amountPaid - amountDue,
      validUntil: validUntilDate.getTime(),
      receivedBy: staffName,
      paidAt: now.getTime(),
    }
  }

  return { register, staffName }
}
