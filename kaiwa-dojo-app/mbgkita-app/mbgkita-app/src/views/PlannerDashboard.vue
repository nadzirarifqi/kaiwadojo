<template>
  <section class="dashboard-container">
    <header class="dashboard-header">
      <div class="welcome-text">
        <h1>Ringkasan Planner</h1>
        <p>Pantauan pemenuhan gizi dan jadwal harian SPPG.</p>
      </div>
      <div class="date-display">
        <span class="calendar-icon">📅</span>
        {{ currentFullDate }}
      </div>
    </header>

    <div class="stats-grid">
      <article class="stat-card primary">
        <div class="stat-info">
          <h3>Resep Terverifikasi</h3>
          <p class="stat-value">24</p>
          <small>Siap dijadwalkan</small>
        </div>
        <div class="stat-icon">✅</div>
      </article>

      <article class="stat-card accent">
        <div class="stat-info">
          <h3>Jadwal Minggu Ini</h3>
          <p class="stat-value">05</p>
          <small>Hari Aktif</small>
        </div>
        <div class="stat-icon">📅</div>
      </article>

      <article class="stat-card warning">
        <div class="stat-info">
          <h3>Rata-rata Kalori</h3>
          <p class="stat-value">812</p>
          <small>kcal / porsi</small>
        </div>
        <div class="stat-icon">🔥</div>
      </article>
    </div>

    <div class="dashboard-grid">
      <div class="chart-card card">
        <header class="card-header">
          <h3>Tren Target Kalori Seminggu</h3>
          <p class="card-subtitle">Berdasarkan jadwal menu yang telah disusun</p>
        </header>
        <div class="canvas-wrapper">
          <canvas id="plannerChart"></canvas>
        </div>
      </div>

      <div class="activity-card card">
        <header class="card-header">
          <h3>Aktivitas Terbaru</h3>
        </header>
        <ul class="activity-list">
          <li class="activity-item">
            <span class="dot"></span>
            <div class="item-text">
              <p>Menu <b>Ayam Kecap</b> dijadwalkan</p>
              <small>2 jam yang lalu</small>
            </div>
          </li>
          <li class="activity-item">
            <span class="dot green"></span>
            <div class="item-text">
              <p>Laporan 12 April di-export</p>
              <small>Kemarin</small>
            </div>
          </li>
        </ul>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import Chart from 'chart.js/auto'

const userStore = useUserStore()
const router = useRouter()

// Proteksi Tambahan: Pastikan hanya Menu Planner yang bisa melihat ini
onMounted(() => {
  if (userStore.role !== 'Menu Planner') {
    router.push('/login')
    return
  }

  initChart()
})

const currentFullDate = computed(() => {
  return new Intl.DateTimeFormat('id-ID', { 
    dateStyle: 'full' 
  }).format(new Date())
})

const initChart = () => {
  const ctx = document.getElementById('plannerChart') as HTMLCanvasElement
  if (!ctx) return

  new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'],
      datasets: [{
        label: 'Kalori (kcal)',
        data: [750, 820, 780, 850, 800, 790, 810],
        borderColor: '#1c4d8d',
        backgroundColor: 'rgba(28, 77, 141, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 4,
        pointBackgroundColor: '#1c4d8d'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: false, grid: { color: '#f1f5f9' } },
        x: { grid: { display: false } }
      }
    }
  })
}
</script>

<style scoped>
.dashboard-container {
  animation: fadeIn 0.5s ease-out;
}

.dashboard-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 30px;
}

.dashboard-header h1 {
  font-size: 1.8rem;
  font-weight: 800;
  color: var(--primary);
  margin-bottom: 5px;
}

.date-display {
  background: white;
  padding: 8px 16px;
  border-radius: 10px;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--text-muted);
  box-shadow: var(--shadow-sm);
}

/* Stats Cards */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
  margin-bottom: 30px;
}

.stat-card {
  background: white;
  padding: 24px;
  border-radius: 16px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-sm);
  border-bottom: 4px solid transparent;
}

.stat-card.primary { border-color: var(--primary); }
.stat-card.accent { border-color: var(--accent); }
.stat-card.warning { border-color: #f59e0b; }

.stat-value {
  font-size: 2.2rem;
  font-weight: 800;
  color: var(--text-main);
  margin: 5px 0;
}

.stat-icon {
  font-size: 2.5rem;
  opacity: 0.2;
}

/* Grid Dashboard */
.dashboard-grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 25px;
}

.card {
  background: white;
  padding: 24px;
  border-radius: 16px;
  box-shadow: var(--shadow-sm);
}

.card-header { margin-bottom: 20px; }

.canvas-wrapper {
  height: 300px;
  width: 100%;
}

/* Activity List */
.activity-list { list-style: none; }
.activity-item {
  display: flex;
  gap: 15px;
  padding: 12px 0;
  border-bottom: 1px solid #f1f5f9;
}

.dot {
  width: 10px;
  height: 10px;
  background: var(--primary);
  border-radius: 50%;
  margin-top: 6px;
}

.dot.green { background: var(--accent); }

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 1024px) {
  .dashboard-grid { grid-template-columns: 1fr; }
}
</style>