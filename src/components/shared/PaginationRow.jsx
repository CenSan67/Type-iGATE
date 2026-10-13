import React from 'react'
import { buildPageList } from '../../utils/pagination'

// "Showing X to Y of Z entries" + page buttons, in the existing .pagination-row style.
// Pure presentation: the caller owns `page` and slices its own rows.
export default function PaginationRow({ page, pageSize, total, onPageChange, className = '' }){
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1
  const last = Math.min(page * pageSize, total)

  return (
    <div className={`pagination-row ${className}`.trim()}>
      <span>Showing {first} to {last} of {total} entries</span>
      <div className="pagination-controls">
        <button type="button" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>‹</button>
        {buildPageList(page, totalPages).map((n, i) => (
          n === '…'
            ? <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
            : <button key={n} type="button" className={page === n ? 'active' : ''} onClick={() => onPageChange(n)}>{n}</button>
        ))}
        <button type="button" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>›</button>
      </div>
    </div>
  )
}
