import React, { useEffect, useMemo, useState } from 'react'
import Modal from './Modal'
import ReceiptSummary from '../shared/ReceiptSummary'
import DummyFillButton from '../shared/DummyFillButton'
import VehicleBrandField from '../shared/VehicleBrandField'
import { resolveVehicleBrand, vehicleBrandFormValue } from '../../constants/vehicleBrands'
import useRfidScanner from '../../hooks/useRfidScanner'
import useRfidUsers from '../../hooks/useRfidUsers'
import { useAuth } from '../../context/AuthContext'
import { isValidRfid, isValidPlate, isValidEmail, isValidPhone, formatPhoneInput, generateDummyRfid } from '../../utils/validators'
import { getErrorMessage } from '../../utils/errors'
import { toLocalISODate } from '../../utils/dateRange'
import { useToast } from '../../context/ToastContext'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import { renewableRecord, isReturnedPass } from '../../utils/cardHolder'
import { fieldInputValue } from '../../utils/textCase'
import {
  DOCUMENT_LABELS,
  PLATE_OPTIONAL_TYPES,
  PRIVACY_CONSENT_TEXT,
  REGISTRATION_VALIDITY_MONTHS,
  getRequiredDocs,
  getVehicleFee,
} from '../../constants/fees'

// Visitors get a temporary pass from the Dashboard instead - they don't pay this fee.
const PAYMENT_ROLES = ['Student', 'Faculty', 'Staff']
const SEARCH_TYPES = ['Plate No.', 'RFID-ID', 'Name']

const includesText = (value, query) => (value || '').toString().toLowerCase().includes(query)

export default function RegistrationModal({ initialType = 'Registration', onClose, onSubmit }){
  const { user, profile } = useAuth()
  const staffName = profile?.fullName || profile?.displayName || user?.email || ''
  const users = useRfidUsers()
  const { showError, showInfo } = useToast()
  const { scanning, startScan, stopScan } = useRfidScanner()

  const [form, setForm] = useState({
    paymentType: initialType,
    rfid: '',
    name: '',
    department: 'BSIT',
    plate: '',
    vehicle: 'Car',
    color: '',
    brand: { choice: '', custom: '' },
    role: 'Student',
    email: '',
    phone: '',
    tendered: String(getVehicleFee('Car')),
    tenderedTouched: false,
    docs: {},
    licenseExpiry: '',
    consent: false,
  })
  const [searchType, setSearchType] = useState(SEARCH_TYPES[0])
  const [searchQuery, setSearchQuery] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(timer)
  }, [])

  const fee = getVehicleFee(form.vehicle)
  const tendered = Number(form.tendered) || 0
  const requiredDocs = getRequiredDocs(form.vehicle)
  const plateOptional = PLATE_OPTIONAL_TYPES.includes(form.vehicle)

  const validUntil = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + REGISTRATION_VALIDITY_MONTHS)
    return d.getTime()
  }, [])

  const update = (field) => (e) => {
    const value = fieldInputValue(field, e) // name/plate/department/color in ALL CAPS
    setForm((f) => {
      const next = { ...f, [field]: value }
      if (field === 'vehicle') {
        // A different vehicle type means a different fee and a different document checklist.
        next.docs = {}
        if (!f.tenderedTouched) next.tendered = String(getVehicleFee(value))
      }
      return next
    })
  }

  const setTendered = (e) => setForm((f) => ({ ...f, tendered: e.target.value, tenderedTouched: true }))

  const toggleDoc = (doc) => setForm((f) => ({ ...f, docs: { ...f.docs, [doc]: !f.docs[doc] } }))

  // Loading an existing registrant turns this into a renewal and pre-fills everything we know.
  const applyExisting = (existing) => {
    setForm((f) => {
      const vehicle = existing.vehicleType || f.vehicle
      return {
        ...f,
        paymentType: 'Renewal',
        rfid: existing.rfidId || f.rfid,
        name: existing.name || '',
        department: existing.department || f.department,
        plate: existing.plateNumber || '',
        vehicle,
        color: existing.vehicleColor || '',
        brand: vehicleBrandFormValue(existing.vehicleBrand),
        role: PAYMENT_ROLES.includes(existing.role) ? existing.role : f.role,
        email: existing.email || '',
        phone: existing.phone || '',
        docs: {},
        tendered: f.tenderedTouched ? f.tendered : String(getVehicleFee(vehicle)),
      }
    })
    showInfo(`Loaded ${existing.name || existing.rfidId} - confirm the details and re-check their documents.`)
  }

  const handleSearch = () => {
    const q = searchQuery.trim().toLowerCase()
    if (!q) return
    // A returned visitor pass is a finished visit, not someone to renew - never load it.
    const match = users.filter((u) => !isReturnedPass(u)).find((u) => {
      if (searchType === 'Plate No.') return includesText(u.plateNumber, q)
      if (searchType === 'RFID-ID') return includesText(u.rfidId, q)
      return includesText(u.name, q)
    })
    if (match) applyExisting(match)
    else showError('No registered vehicle matches that search.')
  }

  const handleScan = () => {
    startScan((rfid) => {
      // The card's current holder (or a lapsed student/staff renewing) - never the first
      // record ever saved for it: on a pooled visitor card that was a past visitor, whose
      // details were loaded into the form (and then written back over their record).
      const match = renewableRecord(users, rfid)
      if (match) applyExisting(match)
      else setForm((f) => ({ ...f, rfid }))
    })
  }

  // Testing convenience - fills a fresh dummy card ID without needing hardware or the
  // scan listener. Not wired into the existing-user lookup, since it's always meant to
  // simulate a brand-new card.
  const handleDummyFill = () => setForm((f) => ({ ...f, rfid: generateDummyRfid() }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.rfid.trim() || !form.name.trim() || (!plateOptional && !form.plate.trim())) {
      showError(plateOptional ? 'RFID and Name are required.' : 'RFID, Name and Plate Number are required.')
      return
    }
    if (!isValidRfid(form.rfid)) {
      showError('RFID looks invalid — expected 3-40 letters, numbers or hyphens.')
      return
    }
    if (form.plate.trim() && !isValidPlate(form.plate)) {
      showError('Plate Number format looks invalid (expected e.g. ABC-1234).')
      return
    }
    if (!isValidEmail(form.email)) {
      showError('Email format looks invalid.')
      return
    }
    if (!isValidPhone(form.phone)) {
      showError('Contact number looks invalid (expected a PH mobile number, e.g. 09171234567).')
      return
    }
    const brand = resolveVehicleBrand(form.brand)
    if (brand.error) {
      showError(brand.error)
      return
    }
    if (requiredDocs.some((doc) => !form.docs[doc])) {
      showError('Check and tick every required document before saving.')
      return
    }
    if (requiredDocs.includes('license')) {
      if (!form.licenseExpiry) {
        showError("Enter the driver's license expiry date.")
        return
      }
      if (form.licenseExpiry < toLocalISODate(new Date())) {
        showError("The driver's license is expired - it can't be used to register.")
        return
      }
    }
    if (tendered < fee) {
      showError(`Amount paid is less than the ₱${fee.toFixed(2)} fee.`)
      return
    }
    if (!form.consent) {
      showError('The privacy consent must be accepted to continue.')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({ ...form, vehicleBrand: brand.value })
    } catch (err) {
      showError(getErrorMessage(err, 'Unable to record the payment right now.'))
    } finally {
      setSubmitting(false)
    }
  }

  const liveReceipt = {
    name: form.name.trim(),
    plate: form.plate.trim().toUpperCase(),
    department: form.department.trim(),
    rfid: form.rfid,
    vehicle: form.vehicle,
    vehicleBrand: resolveVehicleBrand(form.brand).value,
    paymentType: form.paymentType,
    amountDue: fee,
    amountPaid: tendered,
    change: Math.max(0, tendered - fee),
    validUntil,
    receivedBy: staffName,
    paidAt: now.getTime(),
  }

  return (
    <Modal title="User Registration & RFID Payment" onClose={onClose} className="modal-wide">
      <form className="registration-form registration-layout" onSubmit={handleSubmit}>
        <div className="registration-main">
          <div className="registration-search">
            <select value={searchType} onChange={(e) => setSearchType(e.target.value)} aria-label="Search by">
              {SEARCH_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleSearch() } }}
              placeholder="Find an existing registration to renew"
            />
            <button type="button" className="btn-primary" onClick={handleSearch}>Search</button>
          </div>

          <h4 className="registration-section">Registration Information</h4>
          <div className="registration-fields">
            <label>
              Transaction Type
              <select value={form.paymentType} onChange={update('paymentType')}>
                <option value="Registration">New Registration</option>
                <option value="Renewal">Renewal</option>
              </select>
            </label>
            <label>
              RFID-ID
              <div className="rfid-scan-row">
                <input value={form.rfid} readOnly placeholder="Tap Scan RFID and present the card" />
                <button
                  type="button"
                  className={`scan-btn ${scanning ? 'scanning' : ''}`}
                  onClick={scanning ? stopScan : handleScan}
                >
                  {scanning ? 'Waiting for card…' : 'Scan RFID'}
                </button>
                <DummyFillButton onClick={handleDummyFill} />
              </div>
            </label>
            <label className="span-2">
              Full Name
              <input value={form.name} onChange={update('name')} placeholder="Juan Dela Cruz" />
            </label>
            <label>
              Email (optional)
              <input type="email" value={form.email} onChange={update('email')} placeholder="name@example.com" />
            </label>
            <label>
              Contact Number (optional - enables SMS gate alerts)
              <input
                type="tel"
                inputMode="numeric"
                maxLength={13}
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: formatPhoneInput(e.target.value) }))}
                placeholder="09171234567"
              />
            </label>
            <label>
              Role / Classification
              <select value={form.role} onChange={update('role')}>
                {PAYMENT_ROLES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </label>
            <label>
              Department
              <input value={form.department} onChange={update('department')} placeholder="BSIT" />
            </label>
          </div>

          <h4 className="registration-section">Vehicle Information</h4>
          <div className="registration-fields">
            <label>
              Vehicle Type
              <select value={form.vehicle} onChange={update('vehicle')}>
                {VEHICLE_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
            <VehicleBrandField value={form.brand} onChange={(brand) => setForm((f) => ({ ...f, brand }))} />
            <label>
              Vehicle Color
              <input value={form.color} onChange={update('color')} placeholder="White" />
            </label>
            <label className="span-2">
              Plate Number{plateOptional ? ' (optional for this vehicle type)' : ''}
              <input value={form.plate} onChange={update('plate')} placeholder="ABC-1234" />
            </label>
          </div>

          <h4 className="registration-section">Document Verification</h4>
          <p className="registration-note">Check the originals in person. Nothing is scanned or stored - only that you verified them.</p>
          <div className="registration-checks">
            {requiredDocs.map((doc) => (
              <label key={doc} className="check-row">
                <input type="checkbox" checked={Boolean(form.docs[doc])} onChange={() => toggleDoc(doc)} />
                {DOCUMENT_LABELS[doc]} checked against the original
              </label>
            ))}
          </div>
          {requiredDocs.includes('license') && (
            <div className="registration-fields">
              <label>
                Driver's License Expiry Date
                <input
                  type="date"
                  value={form.licenseExpiry}
                  onChange={update('licenseExpiry')}
                  min={toLocalISODate(new Date())}
                />
              </label>
            </div>
          )}

          <h4 className="registration-section">Payment Details</h4>
          <div className="registration-fields">
            <label>
              Amount Due (₱)
              <input value={fee.toFixed(2)} readOnly />
            </label>
            <label>
              Amount Paid (₱)
              <input type="number" min="0" step="1" value={form.tendered} onChange={setTendered} />
            </label>
            <label>
              Change (₱)
              <input value={Math.max(0, tendered - fee).toFixed(2)} readOnly />
            </label>
            <label>
              Payment Received By
              <input value={staffName} readOnly />
            </label>
            <label>
              Official Receipt No.
              <input value="Assigned when saved" readOnly />
            </label>
            <label>
              Date and Time Paid
              <input value={now.toLocaleString([], { month: 'long', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true })} readOnly />
            </label>
          </div>

          <label className="check-row consent-row">
            <input type="checkbox" checked={form.consent} onChange={(e) => setForm((f) => ({ ...f, consent: e.target.checked }))} />
            <span>{PRIVACY_CONSENT_TEXT}</span>
          </label>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save & Record Payment'}
            </button>
          </div>
        </div>

        <aside className="registration-side">
          <div className="receipt-panel">
            <div className="receipt-panel-header">Payment Summary</div>
            <ReceiptSummary receipt={liveReceipt} />
          </div>
        </aside>
      </form>
    </Modal>
  )
}
