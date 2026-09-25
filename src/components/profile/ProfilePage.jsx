import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ChangePasswordModal from '../modals/ChangePasswordModal'
import bsuLogo from '../../assets/bsu_logo-removebg-preview.png'
import { useAuth } from '../../context/AuthContext'
import { listenToAdminProfile, saveAdminProfile } from '../../services/firebase'

const STORAGE_KEY = 'igate_admin_profile'

const defaultProfile = {
  fullName: 'John Romel Mangubat',
  displayName: 'Romel',
  email: 'mangubat@gmail.com',
  phone: '09224466231',
  address: 'Libis, San Rafael, Bulacan',
  role: 'Administrator',
  status: 'Active',
  joinedDate: '2026-03-17',
  avatar: null,
}

// Signed-in users get their profile from RTDB (adminProfiles/{uid}), keyed to their
// real Firebase account. The hardcoded login bypass has no uid, so it falls back to
// this localStorage copy instead of writing to a shared/unowned database record.
function buildDefaultProfile(user){
  return {
    ...defaultProfile,
    email: user?.email || defaultProfile.email,
    joinedDate: user?.metadata?.creationTime
      ? new Date(user.metadata.creationTime).toISOString().slice(0, 10)
      : defaultProfile.joinedDate,
  }
}

function loadLocalProfile(){
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? { ...defaultProfile, ...JSON.parse(raw) } : defaultProfile
    if (!/^\d{4}-\d{2}-\d{2}$/.test(parsed.joinedDate)) parsed.joinedDate = defaultProfile.joinedDate
    return parsed
  } catch {
    return defaultProfile
  }
}

function formatJoinedDate(iso){
  const d = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString([], { month: 'long', day: 'numeric', year: 'numeric' })
}

const CameraIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 011 1v9a1 1 0 01-1 1H4a1 1 0 01-1-1V9a1 1 0 011-1z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" /><circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.6" /></svg>
)

const BackIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
)

function ProfileField({ label, value, displayValue, editing, onChange, type = 'text', options }){
  return (
    <div className="profile-field-row">
      <label>{label}</label>
      {editing && onChange ? (
        options ? (
          <select value={value} onChange={onChange}>
            {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
          </select>
        ) : (
          <input type={type} value={value} onChange={onChange} />
        )
      ) : (
        <div className="profile-field-display">{displayValue ?? value}</div>
      )}
    </div>
  )
}

export default function ProfilePage(){
  const navigate = useNavigate()
  const { user } = useAuth()
  const [now, setNow] = useState(new Date())
  const [profile, setProfile] = useState(() => buildDefaultProfile(user))
  const [draft, setDraft] = useState(profile)
  const [editing, setEditing] = useState(false)
  const [showPasswordModal, setShowPasswordModal] = useState(false)

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    if (user?.uid) {
      const unsub = listenToAdminProfile(user.uid, (stored) => {
        const next = stored ? { ...buildDefaultProfile(user), ...stored } : buildDefaultProfile(user)
        setProfile(next)
        setDraft(next)
      })
      return () => unsub && unsub()
    }

    const local = loadLocalProfile()
    setProfile(local)
    setDraft(local)
  }, [user?.uid])

  const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
  const dateString = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })

  const persist = (next) => {
    setProfile(next)
    if (user?.uid) {
      saveAdminProfile(user.uid, next)
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    }
  }

  const handleAvatarChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      persist({ ...profile, avatar: reader.result })
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  // Go back to wherever the user came from (Settings, Dashboard, ...); if the page was
  // opened directly with no history, fall back to the Dashboard every role can reach.
  const handleBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate('/dashboard'))

  const startEdit = () => { setDraft(profile); setEditing(true) }
  const cancelEdit = () => { setDraft(profile); setEditing(false) }
  const saveEdit = (e) => {
    e.preventDefault()
    persist(draft)
    setEditing(false)
  }

  const updateDraft = (field) => (e) => setDraft((d) => ({ ...d, [field]: e.target.value }))

  const initial = (profile.displayName || profile.fullName || 'A').charAt(0).toUpperCase()

  return (
    <div className="dashboard-main">
      <section className="dashboard-header">
        <div>
          <div className="dashboard-branding">
            <img src={bsuLogo} alt="Bulacan State University Seal" className="dashboard-logo" />
            <div>
              <h1>Bulacan State University</h1>
              <p>Intelligent Gate Access & Tracking - BulSU Bustos Campus</p>
            </div>
          </div>
        </div>
        <div className="dashboard-clock">
          <div>{timeString}</div>
          <div>{dateString}</div>
        </div>
      </section>

      <div className="profile-panel">
        <div className="profile-page-heading">
          <button type="button" className="profile-back-btn" title="Back" aria-label="Go back" onClick={handleBack}>
            <BackIcon />
          </button>
          <h2>Admin Profile</h2>
        </div>

        <form className="profile-card" onSubmit={saveEdit}>
          <div className="profile-photo-col">
            <div className="profile-avatar-upload">
              {profile.avatar ? (
                <img src={profile.avatar} alt="Profile" className="profile-avatar-img" />
              ) : (
                <div className="profile-avatar-placeholder">{initial}</div>
              )}
              <label className="avatar-upload-btn" title="Upload photo">
                <CameraIcon />
                <input type="file" accept="image/*" onChange={handleAvatarChange} />
              </label>
            </div>
            <div className="profile-name">
              <strong>{profile.displayName}</strong>
              <span>{profile.role}</span>
            </div>
            <div className="profile-tag-box">Role, {profile.role}</div>
            {/* Read-only: status is now controlled by admin approval (database.rules.json rejects self-changes) */}
            <div className={`profile-tag-box profile-status-toggle ${profile.status === 'Active' ? 'is-active' : 'is-inactive'}`}>
              Status, {profile.status}
            </div>
          </div>

          <div className="profile-fields-col">
            <ProfileField label="Full Name:" value={editing ? draft.fullName : profile.fullName} editing={editing} onChange={updateDraft('fullName')} />
            <ProfileField label="Email:" value={editing ? draft.email : profile.email} editing={editing && !user} onChange={updateDraft('email')} type="email" />
            <ProfileField label="Phone:" value={editing ? draft.phone : profile.phone} editing={editing} onChange={updateDraft('phone')} />
            <ProfileField label="Address:" value={editing ? draft.address : profile.address} editing={editing} onChange={updateDraft('address')} />
            {/* Role is intentionally always read-only here, even in edit mode - self-service
                role editing was a privilege-escalation bug (any user, including a Security
                Guard, could grant themselves Super Admin). Role changes belong in Account
                Management, gated to Super Admin only. */}
            <ProfileField label="Role:" value={profile.role} editing={false} />
            <ProfileField
              label="Joined Date:"
              value={editing ? draft.joinedDate : profile.joinedDate}
              displayValue={formatJoinedDate(profile.joinedDate)}
              editing={editing}
              onChange={updateDraft('joinedDate')}
              type="date"
            />

            <div className="profile-actions-row">
              {editing ? (
                <>
                  <button type="button" className="btn-secondary" onClick={cancelEdit}>Cancel</button>
                  <button type="submit" className="profile-btn-edit">Save Profile</button>
                </>
              ) : (
                <button type="button" className="profile-btn-edit" onClick={startEdit}>Edit Profile</button>
              )}
              <button type="button" className="profile-btn-changepw" onClick={() => setShowPasswordModal(true)}>Change Password</button>
            </div>
          </div>
        </form>
      </div>

      {showPasswordModal && <ChangePasswordModal onClose={() => setShowPasswordModal(false)} />}
    </div>
  )
}
