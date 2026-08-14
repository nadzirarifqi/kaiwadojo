<template>
  <div class="auth-page">
    <header class="logo-section">
      <img src="@/assets/images/mbgkita.png" alt="Logo MBGKita" class="main-logo">
    </header>

    <h2 class="notice-title-top">
      Keputusan Kepala Badan Gizi Nasional <br> 
      No. 401.1 Tahun 2025
    </h2>

    <article class="terms-card">
      <header class="terms-card-header">
        <h3 class="terms-header">Ketentuan Perencanaan Menu</h3>
      </header>
      
      <section class="terms-body">
        <ul class="terms-list">
          <li>Memenuhi kebutuhan gizi satu kali makan MBG sesuai kelompok usia.</li>
          <li>Menyesuaikan dengan dana yang disediakan.</li>
          <li>Memberikan kenyamanan dengan sajian makanan yang sudah dikenal dan berasal dari sumber pangan lokal.</li>
          <li>Membantu membentuk kebiasaan makanan sehat (mengenalkan aneka ragam sumber makanan secara dini).</li>
          <li>Menggunakan sumber pangan yang aman dan lingkungan produksi makanan dengan sanitasi dan <i>hygiene</i> yang baik.</li>
          <li>Mengidentifikasi sasaran yang memiliki alergi, intoleransi, atau fobia terhadap makanan tertentu dan menyediakan alternatif makanan lain.</li>
          <li>Mempertimbangkan kesukaan dan ketidaksukaan anak terhadap makanan dan menu yang diberikan.</li>
          <li>Memperhatikan kesesuaian pemorsian makanan yang dihidangkan dengan perencanaan menu yang telah dibuat.</li>
          <li>Menggunakan bahan pangan wajib terfortifikasi seperti tepung terigu, minyak kelapa sawit kemasan, garam beryodium, dan jika tersedia beras terfortifikasi.</li>
          <li>Perencanaan menu disusun dalam sebuah Perencanaan Menu Bulanan yang disusun paling lambat 2 minggu sebelumnya.</li>
          <li>Penentuan bahan pangan dan menu yang akan diterapkan setiap SPPG per siklus menu disusun perlu dikoordinasikan antar tenaga gizi SPPG dalam waktu satu wilayah untuk mencegah kelangkaan bahan pangan.</li>
        </ul>
      </section>

      <footer class="terms-footer">
        <button 
          v-if="canContinue" 
          @click="handleNavigation" 
          class="continue-btn"
          aria-label="Lanjutkan ke Dashboard"
        >
          Lanjutkan ke Dashboard &raquo;
        </button>
        <div v-else class="timer-wrapper">
          <span class="timer-text">
            Sila baca dalam <b>{{ timeLeft }}</b> detik...
          </span>
        </div>
      </footer>
    </article>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()
const timeLeft = ref(5)
const canContinue = ref(false)
let timerInterval: number | null = null

onMounted(() => {
  // Pastikan user sudah login, jika tidak, tendang ke login
  if (!sessionStorage.getItem('isLoggedIn')) {
    router.push('/login')
    return
  }

  timerInterval = window.setInterval(() => {
    if (timeLeft.value > 0) {
      timeLeft.value--
    } else {
      canContinue.value = true
      if (timerInterval) clearInterval(timerInterval)
    }
  }, 1000)
})

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval)
})

const handleNavigation = () => {
  const role = userStore.role || sessionStorage.getItem('userRole')

  if (role === 'Recipe Developer') {
    router.push('/recipe-dashboard')
  } else if (role === 'Menu Planner') {
    router.push('/planner-dashboard')
  } else {
    router.push('/profile')
  }
}
</script>

<style scoped>
.auth-page {
  background: var(--primary-gradient);
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
}

.main-logo {
  width: 90px;
  margin-bottom: 20px;
  filter: drop-shadow(0 4px 6px rgba(0,0,0,0.1));
  background-color: white;
  border-radius: 50%;
}

.notice-title-top {
  color: white;
  text-align: center;
  font-weight: 700;
  margin-bottom: 25px;
  font-size: 0.85rem;
  line-height: 1.5;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.terms-card {
  background: white;
  padding: 40px;
  border-radius: 20px;
  max-width: 550px;
  width: 100%;
  box-shadow: var(--shadow-md);
  animation: fadeIn 0.5s ease;
}

.terms-header {
  text-align: center;
  color: var(--primary);
  margin-bottom: 25px;
  font-size: 1.3rem;
  font-weight: 800;
}

.terms-list {
  font-size: 0.9rem;
  line-height: 1.7;
  color: var(--text-main);
  padding-left: 20px;
  margin-bottom: 30px;
}

.terms-list li {
  margin-bottom: 12px;
  position: relative;
}

.terms-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 20px;
  border-top: 1px solid #f1f5f9;
}

.continue-btn {
  background: var(--primary);
  color: white;
  border: none;
  padding: 12px 25px;
  border-radius: 10px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.3s;
}

.continue-btn:hover {
  background: var(--primary-light);
  transform: translateX(5px);
}

.timer-text {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-style: italic;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>