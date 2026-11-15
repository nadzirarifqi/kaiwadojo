import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../hooks/useAuth'
import {
  type InstructorAccount,
  fetchInstructors,
  createInstructorAccount,
  updateInstructorAccount,
  deleteInstructorAccount,
  generateInstructorPassword,
} from '../lib/instructorService'
import { calculateUserPresence } from '../lib/presenceUtils'
import { useConfirm } from '../contexts/ConfirmContext'
import { useToast } from '../contexts/ToastContext'
import ModalPortal from '../components/ModalPortal'
import { AdminPage, PageHeader, StatGrid, Panel, EmptyState, AccessDenied, BTN_PRIMARY } from '../components/admin/AdminUI'

type FormMode = { kind: 'create' } | { kind: 'edit'; inst: InstructorAccount }

interface CreatedCredentials {
  full_name: string
  username: string
  email: string
  phone_number?: string
  password: string
  isReset: boolean
}

const EMPTY_FORM = {
  fullName: '',
  username: '',
  email: '',
  phone: '',
  password: '',
  bio: '',
  expertise: 'Kaiwa, Bunpou',
}

const inputCls =
  'w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold bg-slate-50 dark:bg-slate-800 dark:text-white outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition'
const labelCls = 'text-xs font-bold text-slate-700 dark:text-slate-200 block mb-1'

function suggestUsername(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '')
    .slice(0, 24)
}

export default function InstructorManager() {
  const confirm = useConfirm()
  const { profile } = useAuth()
  const { toast } = useToast()

  const [instructors, setInstructors] = useState<InstructorAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [formMode, setFormMode] = useState<FormMode | null>(null)
  const [form, setForm] = useState(EMPTY_FORM)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const [resetPassword, setResetPassword] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [credentials, setCredentials] = useState<CreatedCredentials | null>(null)
  const [copied, setCopied] = useState(false)

  async function loadData(showSpinner = true) {
    if (showSpinner) setLoading(true)
    const data = await fetchInstructors()
    setInstructors(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
    // Perbarui status online setiap 30 detik
    const refreshInterval = setInterval(() => loadData(false), 30000)
    return () => clearInterval(refreshInterval)
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return instructors
    return instructors.filter(i =>
      [i.full_name, i.username, i.email, i.phone_number || '', ...i.expertise]
        .some(v => v.toLowerCase().includes(q))
    )
  }, [instructors, search])

  const onlineCount = instructors.filter(i => calculateUserPresence(i.last_active_at).isOnline).length

  function setField<K extends keyof typeof EMPTY_FORM>(key: K, value: string) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function openCreate() {
    setForm({ ...EMPTY_FORM, password: generateInstructorPassword() })
    setUsernameTouched(false)
    setResetPassword(true)
    setShowPassword(true)
    setFormError(null)
    setFormMode({ kind: 'create' })
  }

  function openEdit(inst: InstructorAccount) {
    setForm({
      fullName: inst.full_name,
      username: inst.username,
      email: inst.email,
      phone: inst.phone_number || '',
      password: '',
      bio: inst.bio || '',
      expertise: inst.expertise.join(', '),
    })
    setUsernameTouched(true)
    setResetPassword(false)
    setShowPassword(false)
    setFormError(null)
    setFormMode({ kind: 'edit', inst })
  }

  function closeForm() {
    if (saving) return
    setFormMode(null)
  }

  function validate(): string | null {
    if (!form.fullName.trim()) return 'Nama lengkap wajib diisi.'
    if (!/^[a-z0-9._]{3,30}$/.test(form.username.trim().toLowerCase()))
      return 'Username 3–30 karakter: huruf kecil, angka, titik, atau garis bawah.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Format email tidak valid.'
    if (resetPassword && form.password.length < 8) return 'Password minimal 8 karakter.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!formMode) return
    const err = validate()
    if (err) {
      setFormError(err)
      return
    }

    setSaving(true)
    setFormError(null)
    const expArr = form.expertise.split(',').map(s => s.trim()).filter(Boolean)
    const payload = {
      full_name: form.fullName.trim(),
      username: form.username.trim().toLowerCase(),
      email: form.email.trim().toLowerCase(),
      phone_number: form.phone.trim(),
      bio: form.bio.trim(),
      expertise: expArr,
      password: resetPassword ? form.password : '',
    }

    try {
      if (formMode.kind === 'create') {
        const created = await createInstructorAccount(payload)
        toast.success(`Akun pengajar ${created.full_name} berhasil dibuat.`)
        setCredentials({ ...payload, password: form.password, isReset: false })
      } else {
        await updateInstructorAccount(formMode.inst.id, payload)
        toast.success(`Data pengajar ${payload.full_name} diperbarui.`)
        if (resetPassword) {
          setCredentials({ ...payload, password: form.password, isReset: true })
        }
      }
      setFormMode(null)
      setCopied(false)
      await loadData(false)
    } catch (e: any) {
      setFormError(e?.message || 'Terjadi kesalahan. Coba lagi.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(inst: InstructorAccount) {
    const ok = await confirm({
      title: 'Hapus akun pengajar?',
      message: `Akun "${inst.full_name}" (@${inst.username}) beserta data login-nya akan dihapus permanen.`,
      confirmLabel: 'Ya, hapus akun',
      icon: 'trash',
    })
    if (!ok) return
    try {
      await deleteInstructorAccount(inst.id)
      toast.success(`Akun pengajar "${inst.full_name}" dihapus.`)
      await loadData(false)
    } catch (e: any) {
      toast.error(e?.message || 'Gagal menghapus akun.')
    }
  }

  function credentialText(c: CreatedCredentials) {
    const loginUrl = `${window.location.origin}/login`
    return [
      `Halo ${c.full_name}, berikut akun pengajar Kaiwa Dojo Anda:`,
      ``,
      `Login: ${loginUrl}`,
      `Username: ${c.username}`,
      `Email: ${c.email}`,
      `Password: ${c.password}`,
      ``,
      `Silakan ganti password setelah login pertama melalui menu Pengaturan.`,
    ].join('\n')
  }

  async function copyCredentials() {
    if (!credentials) return
    try {
      await navigator.clipboard.writeText(credentialText(credentials))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error('Gagal menyalin. Salin manual dari kotak di atas.')
    }
  }

  if (profile?.role !== 'admin') {
    return <AccessDenied message="Halaman ini khusus Admin untuk mengelola akun pengajar." />
  }

  const isEdit = formMode?.kind === 'edit'

  return (
    <AdminPage>
      <PageHeader
        eyebrow="Admin · Pengguna"
        title="Akun Pengajar"
        description="Buat, ubah, reset password, dan hapus akun pengajar. Pengajar tidak bisa mendaftar sendiri — akun hanya dibuat oleh admin."
        actions={
          <button type="button" onClick={openCreate} className={BTN_PRIMARY}>
            <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Buat akun pengajar
          </button>
        }
      />

      <StatGrid
        label="Ringkasan pengajar"
        columns={3}
        items={[
          { label: 'Total pengajar', value: instructors.length },
          { label: 'Sedang online', value: onlineCount, tone: 'success' },
          { label: 'Belum ada no. WA', value: instructors.filter(i => !i.phone_number).length, tone: 'warning', hint: 'Lengkapi lewat Edit' },
        ]}
      />

      <Panel
        title="Daftar pengajar"
        description={search ? `${filtered.length} dari ${instructors.length} pengajar` : undefined}
        actions={
          <div className="relative w-full sm:w-72">
            <svg className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M11 18a7 7 0 100-14 7 7 0 000 14z" />
            </svg>
            <input
              type="search"
              aria-label="Cari pengajar"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari nama, username, email…"
              className={`${inputCls} pl-9`}
            />
          </div>
        }
      >
        {loading ? (
          <div className="py-12 flex justify-center items-center">
            <div className="size-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={instructors.length === 0 ? 'Belum ada akun pengajar' : 'Tidak ada pengajar yang cocok'}
            description={instructors.length === 0 ? 'Buat akun pertama, lalu kirim kredensialnya ke pengajar.' : `Tidak ada hasil untuk "${search}".`}
            action={instructors.length === 0 && (
              <button type="button" onClick={openCreate} className={BTN_PRIMARY}>Buat akun pengajar</button>
            )}
          />
        ) : (
          <div className="overflow-x-auto -mx-1">
            <table className="w-full text-left border-collapse min-w-[760px]">
              <caption className="sr-only">Daftar akun pengajar</caption>
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 text-[0.7rem] font-black uppercase text-slate-400 tracking-wider">
                  <th scope="col" className="pb-3 px-2">Pengajar</th>
                  <th scope="col" className="pb-3 px-2">Status</th>
                  <th scope="col" className="pb-3 px-2">Login</th>
                  <th scope="col" className="pb-3 px-2">WhatsApp</th>
                  <th scope="col" className="pb-3 px-2">Keahlian</th>
                  <th scope="col" className="pb-3 px-2 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs font-semibold">
                {filtered.map(inst => {
                  const presence = calculateUserPresence(inst.last_active_at)
                  return (
                    <tr key={inst.id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-2">
                        <div className="flex items-center gap-3">
                          <div className="relative shrink-0">
                            <img
                              src={inst.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${inst.username}`}
                              alt=""
                              className="size-10 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 object-cover"
                            />
                            <span
                              className={`absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-white dark:border-slate-900 ${
                                presence.isOnline ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'
                              }`}
                            />
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold text-slate-800 dark:text-white">{inst.full_name}</div>
                            <div className="text-[0.68rem] text-slate-500 dark:text-slate-400 line-clamp-1 max-w-[220px]">
                              {inst.bio || '—'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-2">
                        {presence.isOnline ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 text-[0.68rem] font-black">
                            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            Online
                          </span>
                        ) : (
                          <div className="flex flex-col gap-0.5">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[0.65rem] font-bold w-fit">
                              <span className="size-1.5 rounded-full bg-slate-400" />
                              Offline
                            </span>
                            <span className="text-[0.62rem] text-slate-400 whitespace-nowrap">{presence.relativeTime}</span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="font-bold text-slate-700 dark:text-slate-200">@{inst.username}</div>
                        <div className="text-[0.68rem] text-slate-400">{inst.email}</div>
                      </td>
                      <td className="py-3 px-2">
                        {inst.phone_number ? (
                          <a
                            href={`https://wa.me/${inst.phone_number.replace(/\D/g, '').replace(/^0/, '62')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-emerald-700 dark:text-emerald-300 font-bold hover:underline"
                          >
                            {inst.phone_number}
                          </a>
                        ) : (
                          <span className="text-[0.65rem] text-slate-400">—</span>
                        )}
                      </td>
                      <td className="py-3 px-2">
                        <div className="flex flex-wrap gap-1">
                          {inst.expertise.length === 0 && <span className="text-[0.65rem] text-slate-400">—</span>}
                          {inst.expertise.map((exp, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 text-[0.65rem] font-bold">
                              {exp}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-2 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => openEdit(inst)}
                            className="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer transition-colors"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(inst)}
                            className="px-2.5 py-1.5 rounded-xl bg-red-50 dark:bg-red-950/60 hover:bg-red-100 dark:hover:bg-red-900 text-red-600 dark:text-red-300 text-xs font-bold border-none cursor-pointer transition-colors"
                          >
                            Hapus
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {/* Create / Edit Modal */}
      {formMode && (
        <ModalPortal>
          <div
            className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in"
            onMouseDown={e => { if (e.target === e.currentTarget) closeForm() }}
          >
            <div className="bg-white dark:bg-slate-900 w-full max-w-lg max-h-[92vh] flex flex-col rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
              <div className={`px-6 py-4 text-white flex items-center justify-between shrink-0 ${isEdit ? 'bg-gradient-to-r from-slate-900 to-slate-800' : 'bg-gradient-to-r from-primary to-primary-light'}`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-white/80">Admin</span>
                  <h3 className="text-lg font-extrabold">{isEdit ? 'Edit Akun Pengajar' : 'Buat Akun Pengajar'}</h3>
                </div>
                <button type="button" onClick={closeForm} aria-label="Tutup" className="size-8 rounded-full bg-white/20 text-white hover:bg-white/30 border-none cursor-pointer text-lg flex items-center justify-center">×</button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4 overflow-y-auto">
                {formError && (
                  <div className="px-3.5 py-2.5 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-xs font-bold">
                    {formError}
                  </div>
                )}

                <div>
                  <label className={labelCls}>Nama Lengkap *</label>
                  <input
                    type="text"
                    autoFocus
                    placeholder="contoh: Sato Hiroshi"
                    value={form.fullName}
                    onChange={e => {
                      const v = e.target.value
                      setForm(f => ({ ...f, fullName: v, username: usernameTouched ? f.username : suggestUsername(v) }))
                    }}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>Username Login *</label>
                    <input
                      type="text"
                      autoComplete="off"
                      placeholder="satosensei"
                      value={form.username}
                      onChange={e => { setUsernameTouched(true); setField('username', e.target.value.toLowerCase().replace(/\s/g, '')) }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email *</label>
                    <input
                      type="email"
                      autoComplete="off"
                      placeholder="sato@kaiwadojo.com"
                      value={form.email}
                      onChange={e => setField('email', e.target.value)}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>No. WhatsApp</label>
                  <input
                    type="tel"
                    placeholder="08xxxxxxxxxx"
                    value={form.phone}
                    onChange={e => setField('phone', e.target.value)}
                    className={inputCls}
                  />
                </div>

                {/* Password */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 p-3.5 flex flex-col gap-2">
                  {isEdit ? (
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 dark:text-slate-200 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resetPassword}
                        onChange={e => {
                          setResetPassword(e.target.checked)
                          if (e.target.checked && !form.password) {
                            setField('password', generateInstructorPassword())
                            setShowPassword(true)
                          }
                        }}
                        className="accent-primary"
                      />
                      Reset password pengajar
                    </label>
                  ) : (
                    <span className={labelCls + ' mb-0'}>Password Awal * <span className="font-medium text-slate-400">(min. 8 karakter)</span></span>
                  )}

                  {resetPassword && (
                    <>
                      <div className="flex gap-2">
                        <div className="relative flex-1">
                          <input
                            type={showPassword ? 'text' : 'password'}
                            autoComplete="new-password"
                            value={form.password}
                            onChange={e => setField('password', e.target.value)}
                            className={`${inputCls} font-mono pr-16`}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(s => !s)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 px-2 py-1 text-[0.65rem] font-bold text-slate-500 hover:text-slate-800 dark:hover:text-white bg-transparent border-none cursor-pointer"
                          >
                            {showPassword ? 'Sembunyi' : 'Lihat'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={() => { setField('password', generateInstructorPassword()); setShowPassword(true) }}
                          className="px-3 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 text-xs font-bold border-none cursor-pointer whitespace-nowrap"
                        >
                          Buat acak
                        </button>
                      </div>
                      <p className="text-[0.68rem] text-slate-500 dark:text-slate-400">
                        {isEdit
                          ? 'Pengajar akan otomatis keluar dari semua perangkat dan harus login dengan password baru.'
                          : 'Kredensial akan ditampilkan setelah akun dibuat agar bisa dikirim ke pengajar.'}
                      </p>
                    </>
                  )}
                </div>

                <div>
                  <label className={labelCls}>Bio Singkat</label>
                  <input
                    type="text"
                    placeholder="Spesialis Bunpou & Percakapan N3"
                    value={form.bio}
                    onChange={e => setField('bio', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>Bidang Keahlian <span className="font-medium text-slate-400">(pisahkan dengan koma)</span></label>
                  <input
                    type="text"
                    placeholder="Bunpou, Kaiwa, JLPT N3"
                    value={form.expertise}
                    onChange={e => setField('expertise', e.target.value)}
                    className={inputCls}
                  />
                </div>

                <div className="pt-1 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold rounded-xl border-none cursor-pointer text-xs"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex-1 py-2.5 bg-primary hover:bg-primary-dark disabled:opacity-60 text-white font-extrabold rounded-xl border-none cursor-pointer text-xs shadow-md"
                  >
                    {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Akun'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </ModalPortal>
      )}

      {/* Credentials Modal */}
      {credentials && (
        <ModalPortal>
          <div className="modal-overlay fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[500] flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-scale-up border border-slate-200 dark:border-slate-800">
              <div className="p-6 flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="size-11 rounded-2xl bg-emerald-100 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-300 flex items-center justify-center shrink-0">
                    <svg className="size-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-slate-800 dark:text-white">
                      {credentials.isReset ? 'Password berhasil direset' : 'Akun pengajar dibuat'}
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Kirim kredensial ini ke {credentials.full_name}. Password tidak akan ditampilkan lagi.
                    </p>
                  </div>
                </div>

                <dl className="rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-xs">
                  <dt className="text-slate-500 font-bold">Username</dt>
                  <dd className="font-mono font-bold text-slate-800 dark:text-white break-all">{credentials.username}</dd>
                  <dt className="text-slate-500 font-bold">Email</dt>
                  <dd className="font-mono font-bold text-slate-800 dark:text-white break-all">{credentials.email}</dd>
                  <dt className="text-slate-500 font-bold">Password</dt>
                  <dd className="font-mono font-bold text-slate-800 dark:text-white break-all">{credentials.password}</dd>
                </dl>

                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={copyCredentials}
                    className="flex-1 py-2.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-extrabold rounded-xl border-none cursor-pointer text-xs"
                  >
                    {copied ? 'Tersalin ✓' : 'Salin pesan kredensial'}
                  </button>
                  {credentials.phone_number && (
                    <a
                      href={`https://wa.me/${credentials.phone_number.replace(/\D/g, '').replace(/^0/, '62')}?text=${encodeURIComponent(credentialText(credentials))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-xl text-xs text-center no-underline"
                    >
                      Kirim via WhatsApp
                    </a>
                  )}
                </div>
                <button
                  onClick={() => setCredentials(null)}
                  className="py-2 bg-transparent text-slate-500 hover:text-slate-800 dark:hover:text-white font-bold border-none cursor-pointer text-xs"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </AdminPage>
  )
}
