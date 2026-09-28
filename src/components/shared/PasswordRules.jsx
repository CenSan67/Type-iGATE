import React from 'react'
import { PASSWORD_RULES } from '../../utils/validators'

export default function PasswordRules({ password }){
  return (
    <ul className="password-rules" aria-label="Password requirements">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password || '')
        return (
          <li key={rule.id} className={met ? 'password-rule met' : 'password-rule'}>
            <span aria-hidden>{met ? '✓' : '○'}</span> {rule.label}
          </li>
        )
      })}
    </ul>
  )
}
