<template>
  <aside class="sidebar" role="navigation">
    <header class="sidebar-brand">
      <img src="@/assets/images/mbgkita.png" alt="Logo MBGKita">
      <h1>MBG Kita</h1>
    </header>

    <nav class="sidebar-nav">
      <ul>
        <template v-if="userStore.role === 'Menu Planner'">
          <li class="nav-group-label">Planner Tools</li>
          <li>
            <RouterLink to="/planner-dashboard" class="nav-link">
              <span class="icon">📊</span> Dashboard
            </RouterLink>
          </li>
          <li>
            <RouterLink to="/planner" class="nav-link">
              <span class="icon">📅</span> Menu Planner
            </RouterLink>
          </li>
           <li>
            <RouterLink to="/list-menu" class="nav-link">
              <span class="icon">📋</span> Katalog Menu
            </RouterLink>
          </li>
        </template>

        <template v-if="userStore.role === 'Recipe Developer'">
          <li class="nav-group-label">Developer Tools</li>
          <li>
            <RouterLink to="/recipe-dashboard" class="nav-link">
              <span class="icon">📈</span> My Stats
            </RouterLink>
          </li>
          <li>
            <RouterLink to="/recipe" class="nav-link">
              <span class="icon">🍳</span> Add Recipe
            </RouterLink>
          </li>
          <li>
            <RouterLink to="/my-recipes" class="nav-link">
              <span class="icon">📋</span> My Recipes
            </RouterLink>
          </li>
        </template>
      </ul>
    </nav>

    <footer class="sidebar-footer">
      <hr class="divider">
      <RouterLink to="/profile" class="nav-link">
        <span class="icon">👤</span> Profil Saya
      </RouterLink>
      <button @click="handleLogout" class="nav-link logout-btn" aria-label="Logout">
        <span class="icon">🚪</span> Logout
      </button>
    </footer>
  </aside>  
</template>

<script setup lang="ts">
import { useUserStore } from '../stores/user';
import Swal from 'sweetalert2';

const userStore = useUserStore();


const handleLogout = () => {
  Swal.fire({
    title: 'Logout?',
    text: 'Sesi Anda akan berakhir.',
    icon: 'question',
    showCancelButton: true,
    confirmButtonColor: '#1c4d8d',
    cancelButtonColor: '#f1f5f9',
    confirmButtonText: 'Ya, Keluar',
    cancelButtonText: 'Batal'
  }).then((result) => {
    if (result.isConfirmed) {
        // 1. Hapus storage
      sessionStorage.clear();
      
      // 2. Panggil fungsi yang baru kita buat (BUKAN $reset)
      userStore.clearUser(); 

      // 3. Notifikasi & pindah halaman
      Swal.fire({
        title: 'Berhasil Keluar!',
        icon: 'success',
        timer: 1000,
        showConfirmButton: false
      }).then(() => {
        window.location.replace('/login');
      });
    }   
  });
};

</script>

<style scoped>
.sidebar {
  width: 260px;
  height: 100vh;
  background: #002868;
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed;
  left: 0;
  top: 0;
  z-index: 1000;
  box-shadow: 4px 0 10px rgba(0, 0, 0, 0.1);
}

.sidebar-brand {
  padding: 30px 20px;
  display: flex;
  align-items: center;
  gap: 12px;
}

.sidebar-brand img {
  width: 40px;
  background-color: white;
  border-radius: 50%;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));
}

.sidebar-brand h1 {
  font-size: 1.2rem;
  font-weight: 800;
  letter-spacing: 1px;
}

.sidebar-nav {
  flex: 1; /* Mengisi ruang sisa agar footer terdorong ke bawah */
  padding: 0 15px;
  overflow-y: auto;
}

.sidebar-nav ul {
  list-style: none;
}

.nav-group-label {
  font-size: 0.7rem;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.5);
  margin: 20px 0 10px 10px;
  font-weight: 700;
  letter-spacing: 1px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 15px;
  color: rgba(255, 255, 255, 0.8);
  text-decoration: none;
  border-radius: 10px;
  font-size: 0.9rem;
  font-weight: 500;
  transition: all 0.3s ease;
  margin-bottom: 5px;
}

.nav-link:hover, .router-link-active {
  background: rgba(255, 255, 255, 0.1);
  color: white;
}

.router-link-active {
  background: var(--primary-light);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
}

.sidebar-footer {
  padding: 20px 15px;
}

.divider {
  border: 0;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 15px;
}

.logout-btn {
  width: 100%;
  border: none;
  background: none;
  cursor: pointer;
  color: #fb7185; /* Soft Red */
}

.logout-btn:hover {
  background: rgba(244, 63, 94, 0.1);
  color: #f43f5e;
}

.icon {
  font-size: 1.1rem;
}
</style>