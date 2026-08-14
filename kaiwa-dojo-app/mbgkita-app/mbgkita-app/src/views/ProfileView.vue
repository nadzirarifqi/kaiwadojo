<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiCall } from '../services/api'

const router = useRouter()
const isLoading = ref(true)
const userData = ref<any>(null)

onMounted(async () => {
  const loggedInID = sessionStorage.getItem('userID')
  
  if (!loggedInID) {
    router.push('/login')
    return
  }

  try {
    const users = await apiCall<any[]>('readAll', 'Users')
    // Mencocokkan ID user agar data muncul
    userData.value = users?.find(u => String(u.userID) === String(loggedInID)) || null
  } catch (error) {
    console.error("Gagal memuat profil:", error)
  } finally {
    isLoading.value = false;
  }
})

const isPlanner = computed(() => userData.value?.role === 'Menu Planner')
const isRecipeDev = computed(() => userData.value?.role === 'Recipe Developer')
</script>

<template>
  <div class="profile-page">
    <div v-if="isLoading" class="loader-container">
      <div class="spinner"></div>
      <p>Memvalidasi Identitas...</p>
    </div>
    
    <div v-else-if="userData" class="profile-layout animate-fade-in">
      <header class="profile-header">
        <div class="header-content">
          <h1>Profil Saya</h1>
          <p>Kelola informasi akun dan akses fitur MBGKita</p>
        </div>
      </header>

      <div class="profile-grid">
        <div class="profile-card-main">
          <div class="user-avatar">
            {{ userData.owner_name?.charAt(0) }}
          </div>
          <h2 class="user-name">{{ userData.owner_name }}</h2>
          <span class="role-badge" :class="isPlanner ? 'planner' : 'developer'">
            {{ userData.role }}
          </span>
          <p class="user-tag">ID Member: #{{ userData.userID }}</p>
          
          <div class="quick-stats">
            <div class="q-stat">
              <strong>ID</strong>
              <span>{{ userData.username }}</span>
            </div>
            <div class="q-stat">
              <strong>Status</strong>
              <span class="status-active">Aktif</span>
            </div>
          </div>
        </div>

        <div class="profile-details-column">
          <div class="detail-card">
            <h3>📇 Informasi Kontak</h3>
            <div class="info-list">
              <div class="info-item">
                <label>Alamat Email</label>
                <p>{{ userData.email }}</p>
              </div>
              <div class="info-item">
                <label>Nomor Telepon</label>
                <p>{{ userData.phone || 'Belum diatur' }}</p>
              </div>
            </div>
          </div>

          <div class="detail-card mt-20">
            <h3>🚀 Akses Cepat</h3>
            <div class="actions-grid">
              <button v-if="isPlanner" @click="router.push('/planner-dashboard')" class="action-btn planner">
                📊 Dashboard Planner
              </button>
              <button v-if="isRecipeDev" @click="router.push('/recipe-dashboard')" class="action-btn developer">
                🍳 Dashboard Developer
              </button>
              <button @click="router.push('/terms')" class="action-btn secondary">
                📜 Syarat & Ketentuan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-else class="error-state">
      <p>Data profil tidak ditemukan.</p>
      <button @click="router.push('/login')" class="btn-primary">Kembali ke Login</button>
    </div>
  </div>
</template>

<style scoped>
.profile-page {
  margin-left: 50px; /* Memberi ruang untuk Sidebar */
  padding: 40px;
  background: #f8fafc;
  min-height: 100vh;
}

.profile-header {
  margin-bottom: 30px;
}

.profile-header h1 {
  font-size: 1.8rem;
  font-weight: 800;
  color: #1c4d8d;
}

.profile-header p {
  color: #64748b;
  font-size: 0.95rem;
}

.profile-grid {
  display: grid;
  grid-template-columns: 350px 1fr;
  gap: 30px;
}

/* User Card Main */
.profile-card-main {
  background: white;
  border-radius: 24px;
  padding: 40px 30px;
  text-align: center;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
  height: fit-content;
}

.user-avatar {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #1c4d8d 0%, #002868 100%);
  color: white;
  font-size: 2.5rem;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 30px;
  margin: 0 auto 20px;
  box-shadow: 0 10px 15px rgba(28, 77, 141, 0.2);
}

.user-name {
  font-size: 1.4rem;
  font-weight: 800;
  color: #1e293b;
  margin-bottom: 8px;
}

.role-badge {
  display: inline-block;
  padding: 6px 16px;
  border-radius: 50px;
  font-size: 0.75rem;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 15px;
}

.role-badge.planner { background: #e0f2fe; color: #0369a1; }
.role-badge.developer { background: #fef3c7; color: #b45309; }

.user-tag {
  color: #94a3b8;
  font-size: 0.85rem;
  margin-bottom: 25px;
}

.quick-stats {
  display: grid;
  grid-template-columns: 1fr 1fr;
  border-top: 1px solid #f1f5f9;
  padding-top: 25px;
  gap: 15px;
}

.q-stat strong {
  display: block;
  font-size: 0.65rem;
  text-transform: uppercase;
  color: #94a3b8;
  margin-bottom: 4px;
}

.q-stat span {
  font-weight: 700;
  color: #334155;
}

.status-active { color: #10b981 !important; }

/* Detail Cards */
.detail-card {
  background: white;
  border-radius: 24px;
  padding: 30px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.05);
}

.detail-card h3 {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1c4d8d;
  margin-bottom: 20px;
}

.info-item {
  margin-bottom: 20px;
}

.info-item label {
  font-size: 0.75rem;
  font-weight: 700;
  color: #94a3b8;
  text-transform: uppercase;
  display: block;
  margin-bottom: 6px;
}

.info-item p {
  font-size: 1rem;
  color: #1e293b;
  font-weight: 600;
}

.actions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
}

.action-btn {
  padding: 14px;
  border: none;
  border-radius: 12px;
  font-weight: 700;
  cursor: pointer;
  transition: 0.3s;
}

.action-btn.planner { background: #1c4d8d; color: white; }
.action-btn.developer { background: #b45309; color: white; }
.action-btn.secondary { background: #f1f5f9; color: #475569; }

.action-btn:hover {
  transform: translateY(-3px);
  filter: brightness(1.1);
}

.mt-20 { margin-top: 20px; }

/* Loader */
.loader-container {
  height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 4px solid #f3f3f3;
  border-top: 4px solid #1c4d8d;
  border-radius: 50%;
  animation: spin 1s linear infinite;
  margin-bottom: 15px;
}

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
.animate-fade-in { animation: fadeIn 0.5s ease-out; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
</style>