import React, { useId, useMemo, useState } from 'react'

// A select you can type into: focus (or tap) to see every option, type to filter, pick with a
// click/tap or the arrow keys + Enter; Escape closes. `value` is one of `options` or ''.
// Options are chosen on mousedown/click with the blur suppressed, so a tap on a phone works.
export default function SearchableSelect({ value, options, onChange, placeholder = 'Select…', ariaLabel, emptyText = 'No match', allowClear = false }){
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const listId = useId()

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? options.filter((o) => o.toLowerCase().includes(q)) : options
  }, [options, query])

  const close = () => { setOpen(false); setQuery('') }
  const choose = (option) => { onChange(option); close() }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!open) { setOpen(true); setActive(0); return }
      setActive((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActive((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      if (open && filtered[active]) { e.preventDefault(); choose(filtered[active]) }
    } else if (e.key === 'Escape') {
      if (open) { e.preventDefault(); close() }
    }
  }

  return (
    <div className="searchable-select">
      <input
        role="combobox"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && filtered[active] ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={open ? query : value}
        placeholder={open && value ? value : placeholder}
        onFocus={() => { setOpen(true); setActive(0) }}
        onBlur={close}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0) }}
        onKeyDown={handleKeyDown}
      />
      {allowClear && value && !open && (
        <button type="button" className="searchable-select-clear" aria-label={`Clear ${ariaLabel || 'selection'}`} onMouseDown={(e) => e.preventDefault()} onClick={() => onChange('')}>×</button>
      )}
      {open && (
        <ul id={listId} role="listbox" className="searchable-select-list">
          {filtered.length === 0 ? (
            <li className="searchable-select-empty">{emptyText}</li>
          ) : filtered.map((option, i) => (
            <li
              id={`${listId}-${i}`}
              key={option}
              role="option"
              aria-selected={option === value}
              className={`searchable-select-option ${i === active ? 'active' : ''} ${option === value ? 'selected' : ''}`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(option)}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
