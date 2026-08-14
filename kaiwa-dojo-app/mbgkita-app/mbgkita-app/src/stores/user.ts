import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiCall, scriptURL } from '../services/api'
import router from '../router'
import Swal from 'sweetalert2'

export const useUserStore = defineStore('user', () => {
  // --- STATE ---
  const id = ref(sessionStorage.getItem('userID') || '')
  const name = ref(sessionStorage.getItem('userName') || '')
  const role = ref(sessionStorage.getItem('userRole') || '')

  // --- ACTIONS ---
  
  /**
   * Fungsi Login
   */
  async function login(user: string, pass: string) {
    const loginURL = `&username=${user}&password=${pass}`
    const data = await apiCall<any>('login', 'Users', loginURL)

    if (data && data.status === "Authenticated") {
      // 1. Update State Pinia
      id.value = data.userId
      name.value = data.owner
      role.value = data.role

      // 2. Simpan ke Session Storage
      sessionStorage.setItem('userID', data.userId)
      sessionStorage.setItem('userName', data.owner)
      sessionStorage.setItem('userRole', data.role)
      sessionStorage.setItem('isLoggedIn', 'true')

      // 3. Kirim Log Login ke Apps Script
      const details = encodeURIComponent(`Login sukses via Vue Dashboard`)
      fetch(`${scriptURL}?action=logOnly&userId=${data.userId}&name=${data.owner}&event=Login&details=${details}`)

      // 4. Notifikasi & Redirect
      Swal.fire({ 
        title: `Welcome, ${data.owner}!`, 
        icon: 'success', 
        timer: 1500, 
        showConfirmButton: false 
      }).then(() => {
        router.push('/terms') 
      })
    } else {
      Swal.fire('Gagal', 'Username atau Password salah.', 'error')
    }
  }

  /**
   * Fungsi Reset State (Pengganti $reset)
   * Digunakan saat logout untuk membersihkan sisa data di memori
   */
  function clearUser() {
    id.value = ''
    name.value = ''
    role.value = ''
    // Jika ada state lain di masa depan, tambahkan di sini
  }

  // Jangan lupa return clearUser agar bisa dipanggil dari Sidebar.vue
  return { 
    id, 
    name, 
    role, 
    login, 
    clearUser 
  }
})