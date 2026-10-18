import { useMemo, useState } from 'react'
import { approvalProblems, checkRegistration, deriveRegistrationStatus, REGISTRATION_FIELDS, uploadedFileLinks } from '../models/registration'
import { resolveVehicleBrand, vehicleBrandFormValue } from '../constants/vehicleBrands'
import { assignRegistrationCard, setRegistrationStatus, unassignRegistrationCard, updateRegistration } from '../services/firebase'
import { getErrorMessage } from '../utils/errors'
import { useToast } from '../context/ToastContext'

const formFrom = (r) => ({
  ...Object.fromEntries(REGISTRATION_FIELDS.map(({ key }) => [key, r[key] || ''])),
  brand: vehicleBrandFormValue(r.vehicleBrand),
})

function parseOriginal(json) {
  try { const o = JSON.parse(json || '{}'); return { columns: o.columns || {}, fields: o.fields || {} } } catch { return { columns: {}, fields: {} } }
}

// State + actions for ProcessRegistrationModal (one imported registration).
export default function useRegistrationProcessing(registration, users, payments) {
  const { showError, showInfo } = useToast()
  const [form, setForm] = useState(() => formFrom(registration))
  const [saving, setSaving] = useState(false)
  const [errors, setErrors] = useState({})

  const original = useMemo(() => parseOriginal(registration.originalJson), [registration.originalJson])
  const uploadedFiles = useMemo(() => uploadedFileLinks(original.columns), [original])
  const derived = deriveRegistrationStatus(registration, users, payments)
  const editable = registration.status !== 'Active' && registration.status !== 'Rejected'
  const dirty = JSON.stringify(formFrom(registration)) !== JSON.stringify(form)

  const setField = (key, value) => setForm((f) => ({ ...f, [key]: value }))

  // Validated values ready to save, or null (errors shown on the form).
  const validated = () => {
    const brand = resolveVehicleBrand(form.brand)
    const check = checkRegistration({ ...form, vehicleBrand: brand.value })
    const fieldErrors = { ...check.errors, ...(brand.error ? { vehicleBrand: brand.error } : {}) }
    setErrors(fieldErrors)
    if (Object.keys(fieldErrors).length) {
      showError('Fix the highlighted fields before saving.')
      return null
    }
    return check
  }

  const run = async (action, success) => {
    setSaving(true)
    try {
      await action()
      if (success) showInfo(success)
      return true
    } catch (err) {
      showError(getErrorMessage(err, 'That could not be saved. Please try again.'))
      return false
    } finally {
      setSaving(false)
    }
  }

  // Save the corrections. `status` overrides the automatic Pending Review -> Under Processing step
  // (e.g. "Save as Pending" keeps it Pending Review; "Approve" requires every required field).
  const save = async (status) => {
    const check = validated()
    if (!check) return false
    const next = status || (registration.status === 'Pending Review' ? 'Under Processing' : registration.status)
    if (next === 'Approved') {
      const problems = approvalProblems({ errors: {}, missing: check.missing })
      if (problems.length) { showError(`Can't approve yet: ${problems.join('; ')}.`); return false }
    }
    return run(() => updateRegistration(registration, check.values, { status: next }),
      next === 'Approved' ? 'Registration approved.' : next === 'Pending Review' ? 'Saved - still Pending Review.' : 'Changes saved.')
  }

  const changeStatus = (status, message) => run(() => setRegistrationStatus(registration, status), message)

  const assignCard = (rfidId, { replace = false } = {}) => {
    if (dirty) { showError('Save your changes first - the card is issued with the saved details.'); return Promise.resolve(false) }
    return run(() => assignRegistrationCard(registration, rfidId, users, { replace }), replace ? `Card replaced with ${rfidId}.` : `Card ${rfidId} assigned (inactive until payment).`)
  }

  const removeCard = () => run(() => unassignRegistrationCard(registration, users), 'Card removed - registration is unassigned again.')

  const missingNow = useMemo(() => {
    const brand = resolveVehicleBrand(form.brand)
    return approvalProblems(checkRegistration({ ...form, vehicleBrand: brand.value || '' }))
  }, [form])

  return { form, setField, errors, saving, dirty, editable, derived, original, uploadedFiles, missingNow, save, changeStatus, assignCard, removeCard }
}
