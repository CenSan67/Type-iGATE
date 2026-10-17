import React from 'react'
import { createPortal } from 'react-dom'

// One gear, centred on (0, 0) so it can spin in place (index.css: .role-switch-gear-*).
function Gear({ teeth, radius, className }){
  return (
    <g className={className}>
      {Array.from({ length: teeth }, (_, i) => (
        <rect key={i} x={-4.5} y={-radius - 7} width={9} height={12} rx={2} transform={`rotate(${(i * 360) / teeth})`} />
      ))}
      <circle r={radius} />
      <circle r={radius * 0.4} className="role-switch-gear-hole" />
    </g>
  )
}

// Full-screen "Changing to <role>" overlay shown by useRoleSwitch while a role switch runs.
// Rendered at <body> so it covers the top bar and sidebar too, and blocks clicks meanwhile.
export default function RoleSwitchOverlay({ role }){
  return createPortal(
    <div className="role-switch-overlay" role="status" aria-live="assertive" aria-busy="true">
      <div className="role-switch-card">
        <svg className="role-switch-gears" viewBox="0 0 120 90" width="120" height="90" aria-hidden>
          <g transform="translate(46 50)"><Gear teeth={10} radius={24} className="role-switch-gear-big" /></g>
          <g transform="translate(90 26)"><Gear teeth={8} radius={14} className="role-switch-gear-small" /></g>
        </svg>
        <p className="role-switch-text">Changing to {role}</p>
      </div>
    </div>,
    document.body,
  )
}
