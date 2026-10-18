import { useMemo, useState } from 'react'
import useRfidUsers from './useRfidUsers'
import { useAuth } from '../context/AuthContext'
import { getRegistrationKeys, importRegistrations } from '../services/firebase'
import { autoMapHeaders, buildImportPreview, mappingProblems, readSpreadsheet } from '../utils/registrationImport'
import { getErrorMessage } from '../utils/errors'

// Google Forms import: 'pick' -> ('map' only when the headers aren't recognized) -> 'review' ->
// 'importing' -> 'done'. People with missing details are always added (marked Missing info);
// duplicates and rows with errors are always skipped.
// Nothing is written before confirmImport(); cancelling at any earlier step leaves the database as it was.
export default function useRegistrationImport() {
  const owners = useRfidUsers()
  const { user, profile } = useAuth()
  const [step, setStep] = useState('pick')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [file, setFile] = useState(null)
  const [sheet, setSheet] = useState(null) // { headers, rows }
  const [mapping, setMapping] = useState([])
  const [existingKeys, setExistingKeys] = useState({})
  const [result, setResult] = useState(null)

  const chooseFile = async (picked) => {
    setError('')
    setBusy(true)
    try {
      const parsed = await readSpreadsheet(picked)
      const keys = await getRegistrationKeys()
      setFile(picked)
      setSheet(parsed)
      const auto = autoMapHeaders(parsed.headers)
      setMapping(auto)
      setExistingKeys(keys)
      setStep(mappingProblems(auto).length ? 'map' : 'review')
    } catch (err) {
      setError(getErrorMessage(err, 'That file could not be read.'))
    } finally {
      setBusy(false)
    }
  }

  const setColumnField = (index, field) => setMapping((m) => m.map((f, i) => (i === index ? field : f)))
  const problems = useMemo(() => mappingProblems(mapping), [mapping])

  const preview = useMemo(
    () => (sheet && step !== 'pick' ? buildImportPreview(sheet, mapping, { existingKeys, owners }) : []),
    [sheet, mapping, existingKeys, owners, step],
  )
  const counts = useMemo(() => preview.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }), {}), [preview])
  const toImport = preview.filter((r) => r.status === 'valid' || r.status === 'incomplete')

  const confirmImport = async () => {
    if (busy || !toImport.length) return
    setBusy(true)
    setError('')
    setStep('importing')
    try {
      const outcome = await importRegistrations(toImport, { fileName: file?.name, actorName: profile?.fullName || user?.email })
      setResult({
        imported: outcome.imported.length,
        failed: outcome.failed,
        missingInfo: counts.incomplete || 0,
        skipped: preview.filter((r) => r.status === 'duplicate' || r.status === 'invalid'),
      })
      setStep('done')
    } catch (err) {
      setError(getErrorMessage(err, 'The import could not be completed.'))
      setStep('review')
    } finally {
      setBusy(false)
    }
  }

  return {
    step, setStep, busy, error, file, sheet, mapping, setColumnField, problems,
    preview, counts, toImport, chooseFile, confirmImport, result,
  }
}
