import React, { useState } from 'react'
import { useRemarks } from '../../hooks/useRemarks'
import RemarkModal from '../modals/RemarkModal'
import { RemarkAddButton, RemarkTick } from '../shared/RemarkBadge'

const sampleLogs = [
  { time: '10:45 AM', rfid: 'RFID-Y9AX103K', plate: 'ABC-3983', name: 'Allan Escorpizo', vehicle: 'Car', department: 'BSIT', role: 'Student', direction: 'IN' },
  { time: '09:50 AM', rfid: 'RFID-XZNXH03Q', plate: 'ABC-3570', name: 'Jims Rid', vehicle: 'Motorcycle', department: 'BSIT', role: 'Faculty', direction: 'IN' },
  { time: '09:13 AM', rfid: 'RFID-1HDKKPOQ', plate: 'ABC-4021', name: 'Rey Declaro', vehicle: 'Car', department: 'BSIT', role: 'Student', direction: 'IN' },
  { time: '08:30 AM', rfid: 'RFID-D47YKD4H', plate: 'ABC-8238', name: 'Cener Santos', vehicle: 'Motorcycle', department: 'BSIT', role: 'Visitor', direction: 'OUT' },
  { time: '06:29 AM', rfid: 'RFID-NF41YLYY', plate: 'ABC-4736', name: 'MJ Escoreal', vehicle: 'E-Bike', department: 'BSIT', role: 'Faculty', direction: 'OUT' },
]

export default function RecentActivityTable(){
  const { remarks, saveRemark } = useRemarks()
  const [activeRow, setActiveRow] = useState(null)

  return (
    <div className="activity-panel">
      <div className="activity-header">
        <h3>Recent Vehicle Activity</h3>
        <p>Real-time entry and exit logs</p>
      </div>
      <table className="activity-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>RFID-ID</th>
            <th>Plate Number</th>
            <th>Name</th>
            <th>Vehicle</th>
            <th>Department</th>
            <th>Role</th>
            <th>Dir</th>
          </tr>
        </thead>
        <tbody>
          {sampleLogs.map((row) => (
            <tr key={row.rfid} className="activity-row">
              <td>{row.time}</td>
              <td>{row.rfid}</td>
              <td>{row.plate}</td>
              <td>
                <span className="name-with-remark">
                  {row.name}
                  <RemarkAddButton onClick={() => setActiveRow(row)} />
                  {remarks[row.rfid] && <RemarkTick onClick={() => setActiveRow(row)} />}
                </span>
              </td>
              <td>{row.vehicle}</td>
              <td>{row.department}</td>
              <td>{row.role}</td>
              <td>{row.direction === 'IN' ? <span className="direction-in">+ IN</span> : <span className="direction-out">- OUT</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {activeRow && (
        <RemarkModal
          name={activeRow.name}
          rfid={activeRow.rfid}
          initialRemark={remarks[activeRow.rfid]}
          onClose={() => setActiveRow(null)}
          onSave={(text) => saveRemark(activeRow.rfid, text)}
        />
      )}
    </div>
  )
}
