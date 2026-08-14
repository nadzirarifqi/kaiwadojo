<template>
  <div class="auth-page">
    <div class="logo-section">
      <img src="@/assets/images/mbgkita.png" alt="Logo MBGKita" class="main-logo">
    </div>

    <div class="login-container">
      <header class="login-header">
        <h2 id="login-title" class="login-title">Selamat Datang</h2>
        <p class="login-subtitle">Silakan masuk ke akun MBGKita Anda</p>
      </header>

      <form @submit.prevent="onLogin" aria-labelledby="login-title">
        <div class="form-group">
          <label for="username">Username</label>
          <input 
            id="username"
            v-model="username" 
            type="text" 
            placeholder="Masukkan username" 
            required
            aria-required="true"
            :disabled="isLoading"
            class="auth-input"
          >
        </div>

        <div class="form-group">
          <label for="password">Password</label>
          <input 
            id="password"
            v-model="password" 
            type="password" 
            placeholder="••••••••" 
            required
            :disabled="isLoading"
            class="auth-input"
          >
        </div>

        <article class="legal-notice">
          <h3 class="notice-title">KEPUTUSAN KEPALA BGN NO. 401.1 TAHUN 2025</h3>
          <div class="notice-box">
            <p>"Program Makan Bergizi Gratis menjadi solusi dengan harapan tingkat konsumsi pangan, kesehatan, serta pendidikan membaik, sehingga dapat meningkatkan produktivitas dan daya saing pekerja, meningkatkan kesempatan kerja, mengurangi ketimpangan, kemiskinan, dan pengangguran yang pada akhirnya dapat menurunkan tingkat kemiskinan di Indonesia."</p>
          </div>
          <p class="notice-footer">Aplikasi ini adalah ekosistem mandiri yang mendukung program Pemerintah RI.</p>
        </article>

        <button type="submit" class="auth-submit-btn" :disabled="isLoading">
          <span v-if="!isLoading">Login Sekarang</span>
          <span v-else class="loader-text">Memproses Verifikasi...</span>
        </button>
      </form>

      <footer class="auth-footer">
        <p>Belum memiliki akun? <RouterLink to="/register" class="link">Daftar di sini</RouterLink></p>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useUserStore } from '../stores/user';

const userStore = useUserStore();
const username = ref('');
const password = ref('');
const isLoading = ref(false);

const onLogin = async () => {
  isLoading.value = true;
  try {
    await userStore.login(username.value, password.value); // Memanggil logic di Pinia
  } finally {
    isLoading.value = false;
  }
};
</script>

<style scoped>
.auth-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--primary-gradient);
  padding: 20px;
}

.logo-section {
  margin-bottom: 30px;
  animation: fadeInDown 0.8s ease;
}

.main-logo {
  width: 120px;
  filter: drop-shadow(0 4px 8px rgba(0,0,0,0.2));
  background-color: white;
  border-radius: 50%;

  /* Tambahan agar logo di dalamnya berada di tengah */
  display: flex;
  justify-content: center;
  align-items: center;

}

.login-container {
  background: var(--white);
  width: 100%;
  max-width: 450px;
  padding: 40px;
  border-radius: 20px;
  box-shadow: var(--shadow-md);
  animation: slideUp 0.6s ease;
}

.login-header {
  text-align: center;
  margin-bottom: 30px;
}

.login-title {
  color: var(--primary);
  font-size: 1.8rem;
  font-weight: 800;
  margin-bottom: 8px;
}

.login-subtitle {
  color: var(--text-muted);
  font-size: 0.95rem;
}

.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: var(--text-main);
  margin-bottom: 8px;
  text-transform: uppercase;
}

.auth-input {
  width: 100%;
  padding: 12px 16px;
  border: 2px solid #edf2f7;
  border-radius: 12px;
  font-size: 1rem;
  transition: all 0.3s ease;
}

.auth-input:focus {
  border-color: var(--primary);
  outline: none;
  box-shadow: 0 0 0 4px rgba(28, 77, 141, 0.1);
}

.legal-notice {
  background: #f8fafc;
  padding: 15px;
  border-radius: 12px;
  border-left: 4px solid var(--primary);
  margin-bottom: 25px;
}

.notice-title {
  font-size: 0.7rem;
  font-weight: 800;
  color: var(--primary);
  margin-bottom: 8px;
}

.notice-box {
  font-size: 0.75rem;
  color: var(--text-muted);
  line-height: 1.5;
  font-style: italic;
  margin-bottom: 8px;
}

.notice-footer {
  font-size: 0.65rem;
  color: #94a3b8;
  font-weight: 600;
}

.auth-submit-btn {
  width: 100%;
  padding: 14px;
  background: var(--primary);
  color: white;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  font-size: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.auth-submit-btn:hover:not(:disabled) {
  background: var(--primary-light);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(28, 77, 141, 0.2);
}

.auth-submit-btn:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
}

.auth-footer {
  margin-top: 25px;
  text-align: center;
  font-size: 0.9rem;
  color: var(--text-muted);
}

.link {
  color: var(--primary);
  font-weight: 700;
  text-decoration: none;
}

.link:hover {
  text-decoration: underline;
}

@keyframes fadeInDown {
  from { opacity: 0; transform: translateY(-20px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(20px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>