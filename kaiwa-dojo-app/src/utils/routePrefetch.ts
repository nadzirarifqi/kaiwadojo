/**
 * Route Prefetch Utility
 * 
 * Preloads dynamic page chunks in the background (via hover, touch, or idle time)
 * so that route transitions feel instantaneous to the user.
 */

const routeLoaders: Record<string, () => Promise<unknown>> = {
  '/dashboard': () => Promise.all([
    import('../pages/Dashboard'),
    import('../pages/InstructorDashboard'),
    import('../pages/AdminDashboard'),
  ]),
  '/my-courses': () => import('../pages/MyCourses'),
  '/learning-plan': () => import('../pages/LearningPlan'),
  '/kotoba': () => import('../pages/SetoranKotoba'),
  '/reservasi-kelas': () => import('../pages/ClassReservation'),
  '/kelola-jadwal': () => import('../pages/InstructorScheduleManager'),
  '/kelola-kursus': () => import('../pages/CourseEditor'),
  '/kelola-pemateri': () => import('../pages/InstructorManager'),
  '/kelola-pelajar': () => import('../pages/StudentManager'),
  '/kelola-grup': () => import('../pages/GroupManager'),
  '/referral-peserta': () => import('../pages/ReferralManager'),
  '/kelola-pengumuman': () => import('../pages/AnnouncementManager'),
  '/kelola-masukan': () => import('../pages/FeedbackManager'),
  '/tracker-kotoba': () => import('../pages/KotobaTracker'),
  '/profile': () => import('../pages/Profile'),
  '/settings': () => import('../pages/Settings'),
  '/login': () => import('../pages/auth/LoginPage'),
  '/register': () => import('../pages/auth/RegisterPage'),
  '/admin': () => import('../pages/auth/AdminLoginPage'),
}

const prefetchedRoutes = new Set<string>()

/**
 * Prefetches the JS chunk for a specific route path.
 * Safe to call multiple times; only executes the dynamic import once.
 */
export function prefetchRoute(rawPath: string): void {
  // Normalize path by stripping query params and hashes
  const path = rawPath.split('?')[0].split('#')[0]
  if (prefetchedRoutes.has(path)) return

  const loader = routeLoaders[path]
  if (loader) {
    prefetchedRoutes.add(path)
    loader().catch(err => {
      // In case of transient network failure, allow retry later
      prefetchedRoutes.delete(path)
      console.debug(`[Prefetch] Failed for ${path}:`, err)
    })
  }
}

/**
 * Prefetches high-frequency routes during browser idle time
 * so navigation is pre-warmed before the user even hovers.
 */
export function prefetchCommonRoutes(): void {
  const commonRoutes = [
    '/learning-plan',
    '/reservasi-kelas',
    '/my-courses',
    '/kotoba',
    '/profile',
  ]

  const executePrefetch = () => {
    commonRoutes.forEach(route => {
      prefetchRoute(route)
    })
  }

  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => executePrefetch(), { timeout: 3000 })
    } else {
      setTimeout(executePrefetch, 1500)
    }
  }
}
