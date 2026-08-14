// src/router/index.ts
import { createRouter, createWebHistory } from 'vue-router'
import PlannerView from '../views/PlannerView.vue'
import RecipeView from '../views/RecipeView.vue'
import Swal from 'sweetalert2'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      redirect: '/login' 
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../views/LoginView.vue'),
      meta: { title: 'Login - MBGKita' }
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../views/RegisterView.vue'),
      meta: { title: 'Register - MBGKita' }
    },
    {
      path: '/terms',
      name: 'terms',
      component: () => import('../views/TermsView.vue'),
      meta: { title: 'T&C - MBGKita', requiresAuth: true }
    },
    // DASHBOARD MENU PLANNER
    {
      path: '/planner-dashboard',
      name: 'planner-dashboard',
      component: () => import('../views/PlannerDashboard.vue'), // Migrasi dari planner_dashboard.html
      meta: { title: 'Dashboard Planner - MBGKita', requiresAuth: true, role: 'Menu Planner' }
    },
    {
      path: '/planner',
      name: 'planner',
      component: PlannerView, // Migrasi dari menu_planner.html
      meta: { title: 'Menu Planner - MBGKita', requiresAuth: true, role: 'Menu Planner' }
    },
    // DASHBOARD & TOOLS RECIPE DEVELOPER
    {
      path: '/recipe-dashboard',
      name: 'recipe-dashboard',
      component: () => import('../views/DeveloperDashboard.vue'), 
      meta: { title: 'Dashboard Developer - MBGKita', requiresAuth: true, role: 'Recipe Developer' }
    },
    {
      path: '/my-recipes',
      name: 'my-recipes',
      component: () => import('../views/MyRecipesView.vue'), // Migrasi dari my_recipes.html
      meta: { title: 'Resep Saya - MBGKita', requiresAuth: true, role: 'Recipe Developer' }
    },
    {
      path: '/recipe-editor',
      name: 'recipe-editor',
      component: () => import('../views/RecipeEditorView.vue'), 
      meta: { title: 'Recipe Editor - MBGKita', requiresAuth: true, role: 'Recipe Developer' }
    },
    {
      path: '/recipe',
      name: 'recipe',
      component: RecipeView,
      meta: { title: 'Add Recipe - MBGKita', requiresAuth: true, role: 'Recipe Developer' }
    },
    {
      path: '/list-menu',
      name: 'list-menu',
      component: () => import('../views/ListMenuView.vue'), // Migrasi dari list_menu.html
      meta: { title: 'Daftar Menu - MBGKita', requiresAuth: true }
    },
    {
      path: '/profile',
      name: 'profile',
      component: () => import('../views/ProfileView.vue'),
      meta: { title: 'Profil - MBGKita', requiresAuth: true }
    }
  ]
})

router.beforeEach((to, from, next) => {
  document.title = (to.meta.title as string) || 'MBGKita App'

  const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true'
  const userRole = sessionStorage.getItem('userRole')?.trim()

  // 1. CEK AUTH: Jika halaman butuh login tapi user TIDAK login
  if (to.meta.requiresAuth && !isLoggedIn) {
    return next({ name: 'login' })
  }

  // 2. REDIRECT LOGIN/REGISTER: Jika user SUDAH login tapi mau ke halaman login
  if (isLoggedIn && (to.name === 'login' || to.name === 'register')) {
    // Gunakan fallback jika userRole tiba-tiba hilang/null saat proses login
    const dashboard = userRole === 'Recipe Developer' ? '/recipe-dashboard' : '/planner-dashboard'
    return next(dashboard)
  }

  // 3. PROTEKSI ROLE: Hanya jika halaman punya aturan role spesifik
  if (to.meta.role && isLoggedIn) {
    if (userRole !== to.meta.role) {
      Swal.fire({
        icon: 'warning',
        title: 'Akses Terbatas',
        text: `Halaman ini khusus untuk ${to.meta.role}`,
        confirmButtonColor: '#1c4d8d'
      });
      return next('/profile');
    }
  }

  // 4. LOLOS SEMUA FILTER
  next()
})

export default router