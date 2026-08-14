<template>
  <div v-if="isAuthPage" class="auth-container">
    <RouterView />
  </div>

  <div v-else class="app-shell">
    <Sidebar />

    <div class="main-wrapper">
      <header class="top-bar">
        <div class="breadcrumb">
          <span>{{ currentRouteTitle }}</span>
        </div>
        
        <div class="user-profile">
          <div class="user-info">
            <span class="user-name">{{ userStore.name || 'Guest' }}</span>
            <span class="user-role">{{ userStore.role || 'Visitor'}}</span>
          </div>
          <div class="user-avatar">{{ initials }}</div>
        </div>
      </header>

      <main class="content-area">
        <RouterView />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useUserStore } from './stores/user';
import { getInitials } from './utils/helpers';
import Sidebar from './components/Sidebar.vue';

const route = useRoute();
const router = useRouter();
const userStore = useUserStore();

// Pantau perubahan sessionStorage untuk deteksi logout instan
watch(() => sessionStorage.getItem('isLoggedIn'), (newVal) => {
  if (newVal !== 'true' && !isAuthPage.value) {
    router.push('/login');
  }
});

onMounted(() => {
  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
  // Jika tidak login tapi ada di halaman internal, tendang ke login
  if (!isLoggedIn && !isAuthPage.value) {
    router.push('/login');
    return;
  }
  
  // Re-hidrasi data user
  userStore.name = sessionStorage.getItem('userName') || '';
  userStore.role = sessionStorage.getItem('userRole') || '';
});

// Logika pemisahan layout
const isAuthPage = computed(() => 
  ['login', 'register', 'terms'].includes(route.name as string)
);

// Mengambil inisial nama (Misal: Nadzira Rifqi -> NR)
const initials = computed(() => getInitials(userStore.name || 'User'));

// Mengambil judul halaman dari meta router
const currentRouteTitle = computed(() => route.meta.title || 'MBGKita');
</script>

<style scoped>
/* --- LAYOUT UTAMA --- */
.app-shell {
  display: flex;
  width: 100vw; /* Kunci lebar sesuai layar */
  height: 100vh;
  overflow: hidden; /* Mencegah scroll global */
  background-color: var(--bg-light);
}

.main-wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 260px; /* Lebar sidebar */
  max-width: calc(100vw - 260px); /* Pastikan lebar tidak melebihi sisa ruang */
  overflow-y: auto; /* Scroll hanya boleh ke bawah */
  overflow-x: hidden; /* Kunci scroll samping */
  transition: margin 0.3s ease;
}

.content-area {
  padding: 30px;
  width: 100%;
  box-sizing: border-box; /* Padding tidak menambah lebar elemen */
}
/* --- TOP BAR / HEADER --- */
.top-bar {
  height: 70px;
  background: var(--white);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 30px;
  border-bottom: 1px solid #eef2f6;
  position: sticky;
  top: 0;
  z-index: 100;
}

.breadcrumb {
  font-weight: 600;
  color: var(--primary);
}

.user-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-info {
  display: flex;
  flex-direction: column;
  text-align: right;
}

.user-name {
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--text-main);
}

.user-role {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.user-avatar {
  width: 40px;
  height: 40px;
  background: var(--primary-gradient);
  color: white;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.85rem;
}


/* --- RESPONSIVE --- */
@media (max-width: 768px) {
  .main-wrapper {
    margin-left: 0;
  }
  .top-bar {
    padding: 0 15px;
  }
}

.auth-container {
  min-height: 100vh;
}
</style>

