<template>
  <div class="auth-page">
    <div class="logo-section">
      <img src="@/assets/images/mbgkita.png" alt="Logo MBGKita" class="main-logo">
    </div>

    <div class="register-container">
      <header class="auth-header">
        <h2 id="register-title" class="auth-title">Daftar Akun</h2>
        <p class="auth-subtitle">Lengkapi data untuk bergabung dalam ekosistem</p>
      </header>

      <form @submit.prevent="handleRegister" aria-labelledby="register-title">
        <div class="form-group">
          <label for="reg-owner">Nama Lengkap / Instansi</label>
          <input 
            id="reg-owner"
            v-model="form.owner" 
            type="text" 
            placeholder="Masukkan nama lengkap" 
            required
            class="auth-input"
          >
        </div>

        <div class="form-row">
          <div class="form-group">
            <label for="reg-user">Username</label>
            <input 
              id="reg-user"
              v-model="form.username" 
              type="text" 
              placeholder="Username" 
              required
              class="auth-input"
            >
          </div>
          <div class="form-group">
            <label for="reg-phone">Nomor Telepon</label>
            <input 
              id="reg-phone"
              v-model="form.phone" 
              type="tel" 
              placeholder="0812..." 
              required
              class="auth-input"
            >
          </div>
        </div>

        <div class="form-group">
          <label for="reg-email">Alamat Email</label>
          <input 
            id="reg-email"
            v-model="form.email" 
            type="email" 
            placeholder="email@contoh.com" 
            required
            class="auth-input"
          >
        </div>

        <div class="form-group">
          <label for="reg-pass">Password</label>
          <input 
            id="reg-pass"
            v-model="form.password" 
            type="password" 
            placeholder="••••••••" 
            required
            class="auth-input"
          >
        </div>

        <div class="form-group">
          <label for="reg-role">Akses Role</label>
          <select id="reg-role" v-model="form.role" class="auth-input" required>
            <option value="" disabled>Pilih Role Anda</option>
            <option value="Recipe Developer">Recipe Developer</option>
            <option value="Menu Planner">Menu Planner</option>
            <option value="Supplier">Supplier</option>
          </select>
        </div>

        <button type="submit" class="auth-submit-btn" :disabled="isLoading">
          <span v-if="!isLoading">Buat Akun Sekarang</span>
          <span v-else>Mendaftarkan...</span>
        </button>
      </form>

      <footer class="auth-footer">
        <p>Sudah memiliki akun? <RouterLink to="/login" class="link">Login di sini</RouterLink></p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { apiCall } from '../services/api'
import router from '../router'
import Swal from 'sweetalert2'

// Interface data disesuaikan dengan header database USR-111
const form = ref({
  owner: '',    // Akan masuk ke owner_name di Sheets
  username: '',
  email: '',
  phone: '',
  password: '',
  role: ''
})

const isLoading = ref(false)

const handleRegister = async () => {
  isLoading.value = true
  try {
    const res = await apiCall<any>('register', 'Users', `&data=${encodeURIComponent(JSON.stringify(form.value))}`)
    
    if (res && res.status === "Successful") {
      Swal.fire({
        title: 'Berhasil!',
        text: 'Akun Anda telah dibuat. Silakan login.',
        icon: 'success',
        confirmButtonColor: '#1c4d8d'
      }).then(() => router.push('/login'))
    } else {
      Swal.fire('Gagal', res?.message || 'Terjadi kesalahan saat mendaftar', 'error')
    }
  } catch (error) {
    Swal.fire('Error', 'Koneksi ke server gagal', 'error')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Gunakan variabel dari main.css agar desain terstruktur */
.auth-page {
  background: var(--primary-gradient);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
}

.logo-section { margin-bottom: 25px; }
.main-logo { width: 120px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  background-color: white;
  border-radius: 50%;

  /* Tambahan agar logo di dalamnya berada di tengah */
  display: flex;
  justify-content: center;
  align-items: center;}

.register-container {
  background: white;
  padding: 40px;
  border-radius: 20px;
  width: 100%;
  max-width: 500px; /* Sedikit lebih lebar dari login untuk form row */
  box-shadow: var(--shadow-md);
}

.auth-header { text-align: center; margin-bottom: 30px; }
.auth-title { color: var(--primary); font-size: 1.6rem; font-weight: 800; margin-bottom: 5px; }
.auth-subtitle { color: var(--text-muted); font-size: 0.9rem; }

.form-group { margin-bottom: 18px; }
.form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

label {
  display: block;
  font-size: 0.75rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 6px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.auth-input {
  width: 100%;
  padding: 12px 15px;
  border: 1.5px solid #e2e8f0;
  border-radius: 10px;
  font-size: 0.95rem;
  transition: 0.3s;
}

.auth-input:focus {
  border-color: var(--primary);
  outline: none;
  box-shadow: 0 0 0 4px rgba(28, 77, 141, 0.1);
}

.auth-submit-btn {
  width: 100%;
  padding: 14px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  margin-top: 10px;
  transition: 0.3s;
}

.auth-submit-btn:hover:not(:disabled) {
  background: var(--primary-light);
  transform: translateY(-2px);
}

.auth-submit-btn:disabled { background: #cbd5e1; cursor: not-allowed; }

.auth-footer { margin-top: 25px; text-align: center; font-size: 0.9rem; color: var(--text-muted); }
.link { color: var(--primary); font-weight: 700; text-decoration: none; }
.link:hover { text-decoration: underline; }

@media (max-width: 480px) {
  .form-row { grid-template-columns: 1fr; gap: 0; }
  .register-container { padding: 30px 20px; }
}
</style>