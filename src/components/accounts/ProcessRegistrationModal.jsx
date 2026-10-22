import React, { useState } from 'react'
import Modal from '../modals/Modal'
import ConfirmModal from '../modals/ConfirmModal'
import VehicleBrandField from '../shared/VehicleBrandField'
import DummyFillButton from '../shared/DummyFillButton'
import RegistrationStatusBadges from './RegistrationStatusBadges'
import useRegistrationProcessing from '../../hooks/useRegistrationProcessing'
import useRfidScanner from '../../hooks/useRfidScanner'
import { REGISTRATION_ROLES } from '../../models/registration'
import { PLATE_OPTIONAL_TYPES } from '../../constants/fees'
import { VEHICLE_TYPES } from '../../models/rfidUser'
import { capsInputValue, plateInputValue, PLATE_FIELDS } from '../../utils/textCase'
import { formatPhoneInput, generateDummyRfid } from '../../utils/validators'

// Same sections, order and wording as the Payment "New Registration" form. Student ID / Course /
// Year Level aren't asked by the iGate Google Form, so they aren't shown (any imported value is kept).
const FIELDS = {
  fullName: { label: 'Full Name', caps: true, span: true, placeholder: 'Juan Dela Cruz' },
  email: { label: 'Email', type: 'email', placeholder: 'name@example.com' },
  phone: { label: 'Contact Number (enables SMS gate alerts)', phone: true, placeholder: '09171234567' },
  department: { label: 'Department', caps: true, placeholder: 'BSIT' },
  vehicleColor: { label: 'Vehicle Color', caps: true, placeholder: 'White' },
  plateNumber: { label: 'Plate Number', caps: true, span: true, placeholder: 'ABC1234' },
}

// Account Management -> Imported -> Process: review / correct / approve one Google Forms registration,
// reserve its RFID card, and hand it to the Payment registration for activation (onActivate).
export default function ProcessRegistrationModal({ registration, users, payments, onClose, onActivate }){
  const p = useRegistrationProcessing(registration, users, payments)
  const { scanning, startScan, stopScan } = useRfidScanner()
  const [pendingCard, setPendingCard] = useState(null) // card waiting for "replace" confirmation
  const [confirmReject, setConfirmReject] = useState(false)
  const [showOriginal, setShowOriginal] = useState(false)
  const status = registration.status
  const owner = p.derived.owner
  const ownerActive = owner && (owner.status || 'Active') === 'Active'

  const receiveCard = (rfidId) => {
    // The scanner also accepts a tap from just before "Scan" was pressed (clock skew), so the card
    // assigned a moment ago can come back - that's not a replacement.
    if (owner && rfidId === owner.rfidId) return
    if (owner) setPendingCard(rfidId)
    else p.assignCard(rfidId)
  }

  const submitted = (key) => {
    const was = p.original.fields[key]
    return was !== undefined && (was || '') !== (p.form[key] || '') ? <span className="registration-submitted">Submitted: {was || '(blank)'}</span> : null
  }

  const textField = (key, labelSuffix = '') => {
    const f = FIELDS[key]
    return (
      <label key={key} className={f.span ? 'span-2' : undefined}>
        {f.label}{labelSuffix}
        <input
          type={f.type || 'text'}
          value={p.form[key]}
          maxLength={80}
          placeholder={f.placeholder}
          aria-invalid={Boolean(p.errors[key])}
          onChange={(e) => p.setField(key, f.phone ? formatPhoneInput(e.target.value) : PLATE_FIELDS.has(key) ? plateInputValue(e) : f.caps ? capsInputValue(e) : e.target.value)}
        />
        {p.errors[key] && <span className="field-error">{p.errors[key]}</span>}
        {submitted(key)}
      </label>
    )
  }

  return (
    <Modal title="Process Registration" onClose={p.saving ? () => {} : onClose} className="modal-wide">
      <div className="process-head">
        <div>
          <strong>{registration.fullName}</strong>
          <span className="cell-sub">Imported {new Date(registration.importedAt).toLocaleString()} by {registration.importedByName || '—'}{registration.sourceFile ? ` · ${registration.sourceFile}, row ${registration.sourceRow}` : ''}</span>
        </div>
        <RegistrationStatusBadges status={p.derived} />
      </div>

      <form className="registration-form" onSubmit={(e) => { e.preventDefault(); p.save() }} noValidate>
        {!p.editable && <p className="form-hint-plain">{p.derived.ownerDeleted ? 'Activated, but the owner record was deleted - reopen it to card and activate this person again.' : status === 'Active' ? 'Activated - edit this person from their owner record (Registered tab).' : 'Rejected - reopen it to make changes.'}</p>}
        <h4 className="registration-section">Registration Information</h4>
        <fieldset className="registration-fields process-fields" disabled={!p.editable || p.saving}>
          {textField('fullName')}
          {textField('email')}
          {textField('phone')}
          <label>
            Role / Classification
            <select value={p.form.role} onChange={(e) => p.setField('role', e.target.value)}>
              <option value="">Choose…</option>
              {REGISTRATION_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            {submitted('role')}
          </label>
          {textField('department')}
        </fieldset>

        <h4 className="registration-section">Vehicle Information</h4>
        <fieldset className="registration-fields process-fields" disabled={!p.editable || p.saving}>
          <label>
            Vehicle Type
            <select value={p.form.vehicleType} onChange={(e) => p.setField('vehicleType', e.target.value)}>
              <option value="">Choose…</option>
              {VEHICLE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            {submitted('vehicleType')}
          </label>
          <VehicleBrandField value={p.form.brand} onChange={(brand) => p.setField('brand', brand)} />
          {p.errors.vehicleBrand && <span className="field-error span-2">{p.errors.vehicleBrand}</span>}
          {textField('vehicleColor')}
          {textField('plateNumber', PLATE_OPTIONAL_TYPES.includes(p.form.vehicleType) ? ' (optional for this vehicle type)' : '')}
        </fieldset>

        {p.editable && p.missingNow.length > 0 && (
          <div className="process-missing">Before approval: {p.missingNow.join('; ')}.</div>
        )}

        <div className="process-files">
          <span>Uploaded files</span>
          {p.uploadedFiles.length === 0 ? (
            <span className="process-files-none">None in the Google Forms answers.</span>
          ) : p.uploadedFiles.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noopener noreferrer" className="btn-secondary">
              View uploaded file{p.uploadedFiles.length > 1 ? ` ${i + 1}` : ''}
            </a>
          ))}
        </div>

        <button type="button" className="link-btn process-original-toggle" onClick={() => setShowOriginal((v) => !v)}>
          {showOriginal ? 'Hide' : 'Show'} original Google Forms answers
        </button>
        {showOriginal && (
          <div className="process-original">
            {Object.entries(p.original.columns).map(([k, v]) => <div key={k}><span>{k}</span><span>{v}</span></div>)}
            {Object.keys(p.original.columns).length === 0 && <div>No original answers stored.</div>}
          </div>
        )}

        {p.editable && (
          <>
            <p className="process-hint">
              {status === 'Approved'
                ? 'Save keeps your edits. The registration stays approved.'
                : 'Save keeps your edits. Approve once the details are checked - the applicant can then pay and get activated.'}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn-secondary" onClick={onClose} disabled={p.saving}>Close</button>
              <button type="submit" className="btn-secondary" disabled={p.saving}>{p.saving ? 'Saving…' : 'Save'}</button>
              {status !== 'Approved' && <button type="button" className="btn-primary" onClick={() => p.save('Approved')} disabled={p.saving}>Approve</button>}
            </div>
          </>
        )}
      </form>

      <h4 className="registration-section">RFID Card</h4>
      <div className="process-card">
        {owner ? (
          <p>Card <strong>{owner.rfidId}</strong> - {ownerActive ? 'active' : 'reserved, opens nothing until payment activates it'}.</p>
        ) : (
          <p>Unassigned. Scan the physical card to reserve it for this person (a card in use by someone else, or reserved for another applicant, is refused). The record can stay unassigned until they get a card.</p>
        )}
        {p.editable && !ownerActive && (
          <div className="rfid-scan-row">
            <button type="button" className={`scan-btn ${scanning ? 'scanning' : ''}`} disabled={p.saving} onClick={scanning ? stopScan : () => startScan(receiveCard)}>
              {scanning ? 'Waiting for card…' : owner ? 'Scan replacement card' : 'Scan card to assign'}
            </button>
            <DummyFillButton onClick={() => receiveCard(generateDummyRfid())} />
            {owner && <button type="button" className="btn-secondary" disabled={p.saving} onClick={p.removeCard}>Remove card</button>}
          </div>
        )}
      </div>

      <h4 className="registration-section">Activation</h4>
      <div className="process-card">
        {p.derived.ownerDeleted ? (
          <p>Was activated{registration.activatedAt ? ` on ${new Date(registration.activatedAt).toLocaleString()}` : ''}, but its owner record has since been deleted, so this person has no card. Reopen moves it back to Approved: assign a card, then Record Payment &amp; Activate as usual.</p>
        ) : status === 'Active' ? (
          <p>Activated{registration.activatedAt ? ` on ${new Date(registration.activatedAt).toLocaleString()}` : ''} - paid, card scanned and documents verified through the Payment registration.</p>
        ) : status === 'Approved' ? (
          <>
            <p>Approved. Activation goes through the regular Payment registration: verify documents, record consent and the fee, and scan the card{owner ? ` (${owner.rfidId} is pre-filled)` : ''}. Payment stays <strong>{p.derived.payment}</strong> until then.</p>
            <div className="modal-actions">
              <button type="button" className="btn-primary" disabled={p.saving || p.dirty} title={p.dirty ? 'Save your changes first' : undefined} onClick={() => onActivate(registration)}>Record Payment &amp; Activate</button>
            </div>
          </>
        ) : (
          <p>Approve the registration first. Approving does not mark it paid or active.</p>
        )}
        <div className="modal-actions process-status-actions">
          {status === 'Rejected' && <button type="button" className="btn-secondary" onClick={() => p.changeStatus('Pending Review', 'Reopened as Pending Review.')}>Reopen</button>}
          {p.derived.ownerDeleted && <button type="button" className="btn-primary" disabled={p.saving} onClick={p.reopen}>Reopen</button>}
          {status === 'Approved' && <button type="button" className="btn-secondary" onClick={() => p.changeStatus('Under Processing', 'Moved back to Under Processing.')}>Undo approval</button>}
          {status !== 'Rejected' && status !== 'Active' && <button type="button" className="btn-danger" onClick={() => setConfirmReject(true)}>Reject</button>}
        </div>
      </div>

      {pendingCard && (
        <ConfirmModal
          title="Replace the assigned card?"
          message={`Card ${owner?.rfidId} is reserved for ${registration.fullName}. Replace it with ${pendingCard}? The old card becomes free.`}
          confirmLabel="Replace Card"
          danger
          onConfirm={async () => { await p.assignCard(pendingCard, { replace: true }); setPendingCard(null) }}
          onClose={() => setPendingCard(null)}
        />
      )}
      {confirmReject && (
        <ConfirmModal
          title="Reject this registration?"
          message={`Reject ${registration.fullName}? The record and their original answers are kept, and it can be reopened later.`}
          confirmLabel="Reject"
          danger
          onConfirm={async () => { await p.changeStatus('Rejected', 'Registration rejected.'); setConfirmReject(false) }}
          onClose={() => setConfirmReject(false)}
        />
      )}
    </Modal>
  )
}
