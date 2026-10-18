import React from 'react'
import Modal from '../modals/Modal'
import useRegistrationImport from '../../hooks/useRegistrationImport'
import { IMPORTABLE_FIELDS, isSensitiveHeader } from '../../utils/registrationImport'

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`

// Account Management -> Import: add the people who answered the iGate Google Form.
// Choose the downloaded file -> see what will happen in plain words -> Add. The column-matching
// table only appears when the file's headers aren't recognized. Nothing is saved before "Add";
// added people are NOT paid, active or given a card - they're checked one by one afterwards.
export default function ImportRegistrationsModal({ onClose }){
  const imp = useRegistrationImport()
  const closeIfIdle = imp.step === 'importing' ? () => {} : onClose
  const counts = imp.counts
  const toAdd = imp.toImport.length
  const attention = imp.preview.filter((r) => r.status !== 'valid')

  return (
    <Modal title="Add people from Google Forms" onClose={closeIfIdle} className="modal-wide">
      {imp.error && <div className="form-error import-error" role="alert">{imp.error}</div>}

      {imp.step === 'pick' && (
        <div className="import-step">
          <ol className="import-howto">
            <li>Open the iGate Google Form, go to <strong>Responses</strong> and click <strong>View in Sheets</strong>.</li>
            <li>In Google Sheets click <strong>File → Download → Microsoft Excel (.xlsx)</strong> (or <strong>.csv</strong>).</li>
            <li>Choose that downloaded file here.</li>
          </ol>
          <label className="import-file">
            <span className="btn-primary">{imp.busy ? 'Reading the file…' : 'Choose file'}</span>
            <input type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" disabled={imp.busy} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) imp.chooseFile(f) }} />
          </label>
          <p className="form-hint-plain">Nobody is marked as paid or given an RFID card. You check each person afterwards in the <strong>Imported</strong> tab.</p>
        </div>
      )}

      {imp.step === 'map' && (
        <div className="import-step">
          <p className="import-lead">We couldn&apos;t recognize all the columns in <strong>{imp.file?.name}</strong>. Tell us what each column contains:</p>
          <div className="import-table-wrap">
            <table className="activity-table import-map-table">
              <thead><tr><th>Column in the file</th><th>Example</th><th>Contains</th></tr></thead>
              <tbody>
                {imp.sheet.headers.map((header, i) => {
                  const sensitive = isSensitiveHeader(header)
                  const sample = imp.sheet.rows.find((r) => (r[i] || '').trim())?.[i] || ''
                  return (
                    <tr key={`${header}-${i}`}>
                      <td>{header}</td>
                      <td className="import-sample">{sensitive ? '••••••' : sample || '—'}</td>
                      <td>
                        {sensitive ? (
                          <span className="status-badge badge-negative">Never imported</span>
                        ) : (
                          <select value={imp.mapping[i]} onChange={(e) => imp.setColumnField(i, e.target.value)} aria-label={`What "${header}" contains`}>
                            <option value="">Skip this column</option>
                            {IMPORTABLE_FIELDS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {imp.problems.map((p) => <div key={p} className="form-error">{p}</div>)}
          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={imp.problems.length > 0} onClick={() => imp.setStep('review')}>Continue</button>
          </div>
        </div>
      )}

      {imp.step === 'review' && (
        <div className="import-step">
          <p className="import-lead">From <strong>{imp.file?.name}</strong> ({plural(imp.preview.length, 'response', 'responses')}):</p>
          <ul className="import-summary">
            <li className="good">
              <strong>{plural(toAdd, 'person', 'people')} will be added</strong>
              {counts.incomplete > 0 && <span>{plural(counts.incomplete, 'of them is', 'of them are')} missing some details - you can fill those in later.</span>}
            </li>
            {counts.duplicate > 0 && <li className="skip"><strong>{plural(counts.duplicate, 'is', 'are')} already in iGate</strong><span>Skipped, so nobody is added twice.</span></li>}
            {counts.invalid > 0 && <li className="bad"><strong>{plural(counts.invalid, 'response has', 'responses have')} a problem</strong><span>Skipped - see the list below. Fix it in the sheet and add the file again.</span></li>}
          </ul>

          {attention.length > 0 && (
            <div className="import-table-wrap">
              <table className="activity-table">
                <thead><tr><th>Row</th><th>Name</th><th>Note</th></tr></thead>
                <tbody>
                  {attention.map((r) => (
                    <tr key={r.rowNumber} className={`import-row-${r.status}`}>
                      <td>{r.rowNumber}</td>
                      <td>{r.values.fullName || '(no name)'}</td>
                      <td className="import-reason">{r.status === 'incomplete' ? `Added - ${r.reason.toLowerCase()}` : `Skipped - ${r.reason}`}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="link-btn import-columns-link" onClick={() => imp.setStep('map')}>Columns wrong? Match them yourself</button>
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="button" className="btn-primary" disabled={!toAdd || imp.busy} onClick={imp.confirmImport}>
              {toAdd ? `Add ${plural(toAdd, 'person', 'people')}` : 'Nobody new to add'}
            </button>
          </div>
        </div>
      )}

      {imp.step === 'importing' && (
        <div className="import-step import-progress" role="status">
          <span className="import-spinner" aria-hidden /> Adding {plural(toAdd, 'person', 'people')}…
        </div>
      )}

      {imp.step === 'done' && imp.result && (
        <div className="import-step" role="status">
          <ul className="import-summary">
            <li className="good">
              <strong>{plural(imp.result.imported, 'person', 'people')} added</strong>
              <span>Find them in the <strong>Imported</strong> tab. Open each one with <strong>Process</strong> to check the details, assign an RFID card and record the payment.</span>
            </li>
            {imp.result.skipped.length > 0 && <li className="skip"><strong>{plural(imp.result.skipped.length, 'response', 'responses')} skipped</strong><span>Already in iGate, or had a problem.</span></li>}
            {imp.result.failed.length > 0 && <li className="bad"><strong>{plural(imp.result.failed.length, 'response', 'responses')} could not be saved</strong><span>See below - try adding the file again.</span></li>}
          </ul>
          {imp.result.failed.length > 0 && (
            <div className="import-table-wrap">
              <table className="activity-table">
                <thead><tr><th>Row</th><th>Reason</th></tr></thead>
                <tbody>{imp.result.failed.map((f) => <tr key={f.rowNumber}><td>{f.rowNumber}</td><td className="import-reason">{f.error}</td></tr>)}</tbody>
              </table>
            </div>
          )}
          <div className="modal-actions"><button type="button" className="btn-primary" onClick={onClose}>Done</button></div>
        </div>
      )}
    </Modal>
  )
}
