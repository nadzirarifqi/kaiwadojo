<script setup lang="ts">
import { ref, onMounted, computed, nextTick, onUnmounted } from 'vue'
import { apiCall } from '../services/api'
import { useRouter } from 'vue-router'
import { useUserStore } from '../stores/user'
import Chart from 'chart.js/auto'

const router = useRouter()
const userStore = useUserStore()
const isLoading = ref(true)

const myRecipes = ref<any[]>([])
const activities = ref<any[]>([])
const usageChart = ref<HTMLCanvasElement | null>(null)
let chartInstance: Chart | null = null

const currentUserID = sessionStorage.getItem('userID')
const approvedCount = computed(() => myRecipes.value.filter(r => r.Status === 'Approved').length)

// Data olahan untuk grafik
const chartData = ref<{ name: string; total: number }[]>([])

onMounted(async () => {
  if (!currentUserID) {
    router.push('/login')
    return
  }
  await loadDashboardData()
})

// Bersihkan chart saat komponen dihancurkan untuk mencegah kebocoran memori
onUnmounted(() => {
  if (chartInstance) chartInstance.destroy()
})

const loadDashboardData = async () => {
  isLoading.value = true
  try {
    const [logData, menuData, scheduleData] = await Promise.all([
      apiCall<any[]>('readAll', 'ActivityLog'),
      apiCall<any[]>('readAll', 'Menu Databases'),
      apiCall<any[]>('readAll', 'Menu Schedule')
    ])

    if (logData && menuData && scheduleData) {
      // 1. Log Aktivitas
      activities.value = logData
        .filter((log: any) => String(log.userID) === String(currentUserID))
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5)

      // 2. Resep Saya
      myRecipes.value = menuData.filter((m: any) => 
        String(m.userID || m.UserID).trim() === String(currentUserID).trim()
      )

      // 3. Olah Data Grafik: Cari jangkauan resep ini di Menu Schedule
      chartData.value = myRecipes.value.map(recipe => {
      // Filter jadwal yang mengandung MenuID resep ini di dalam array JSON-nya
      const usage = scheduleData.filter(s => {
        try {
          // Parse string JSON dari sheet (misal: '["M001", "M002"]') menjadi array asli
          const menuIDsInSchedule = JSON.parse(s.MenuID || "[]");
          
          // Cek apakah ID resep milik user ada di dalam array tersebut
          return Array.isArray(menuIDsInSchedule) && 
                menuIDsInSchedule.includes(String(recipe.MenuID));
        } catch (e) {
          // Fallback jika datanya ternyata bukan JSON (hanya string biasa)
          return String(s.MenuID) === String(recipe.MenuID);
        }
      });

  // Hitung total jangkauan dari semua jadwal yang ditemukan
  const totalReach = usage.reduce((sum, s) => {
    return sum + (Number(s.male_count || 0) + Number(s.female_count || 0));
  }, 0);

  return { name: recipe.Menu_Name, total: totalReach };
}).filter(item => item.total > 0);

      // Render Chart jika ada data
      if (chartData.value.length > 0) {
        nextTick(() => initChart())
      }
    }
  } catch (error) {
    console.error("Gagal load dashboard:", error)
  } finally {
    isLoading.value = false
  }
}

const initChart = () => {
  if (!usageChart.value) return;
  if (chartInstance) chartInstance.destroy();

  const ctx = usageChart.value.getContext('2d');
  let gradient = null;
  
  if (ctx) {
    // Membuat gradient biru khas MBGKita
    gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, '#1c4d8d'); // Biru Navy Utama
    gradient.addColorStop(1, '#60a5fa'); // Biru Terang
  }

  chartInstance = new Chart(usageChart.value, {
    type: 'bar',
    data: {
      labels: chartData.value.map(d => d.name),
      datasets: [{
        label: 'Total Porsi',
        data: chartData.value.map(d => d.total),
        backgroundColor: gradient || '#1c4d8d',
        borderRadius: 10,
        borderSkipped: false,
        barThickness: 35, // Membuat batang lebih elegan
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#ffffff',
          titleColor: '#1e293b',
          bodyColor: '#64748b',
          borderColor: '#e2e8f0',
          borderWidth: 1,
          padding: 12,
          displayColors: false,
          callbacks: {
            label: (context) => ` Total: ${context.parsed.y} Porsi`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9', drawTicks: false },
          border: { display: false },
          ticks: { color: '#94a3b8', font: { size: 11, weight: 600 } }
        },
        x: {
          grid: { display: false },
          border: { display: false },
          ticks: { color: '#475569', font: { size: 11, weight: 700 } }
        }
      }
    }
  });
};

// Hitung berapa kali kita perlu mengulang list agar slider terlihat penuh
const displayRecipes = computed(() => {
  const list = myRecipes.value;
  if (list.length === 0) return [];
  if (list.length < 5) {
    // Jika menu sedikit, ulangi lebih banyak agar track penuh
    return [...list, ...list, ...list, ...list];
  }
  return [...list, ...list]; // Standar pengulangan untuk infinite scroll
});

// Sesuaikan kecepatan durasi berdasarkan jumlah item
const sliderDuration = computed(() => {
  const count = displayRecipes.value.length;
  return count > 0 ? `${count * 3}s` : '0s';
});

const openQuickView = (menu: any) => {
  sessionStorage.setItem('autoOpenMenuID', menu.MenuID)
  router.push('/list-menu')
}
</script>

<template>
  <section class="developer-dashboard">
    <header class="welcome-box">
      <div class="welcome-text">
        <h1>Halo, Developer {{ userStore.name }}! 👨‍🍳</h1>
        <p>Mari ciptakan menu bergizi untuk generasi masa depan Indonesia.</p>
      </div>
      <div class="welcome-stats">
        <div class="mini-stat">
          <span class="label">Total Kontribusi</span>
          <span class="value">{{ myRecipes.length }} Resep</span>
        </div>
      </div>
    </header>

    <div class="action-grid">
      <article class="card clickable" @click="router.push('/recipe')">
        <div class="card-icon">🍳</div>
        <div class="card-body">
          <h3>Tambah Resep Baru</h3>
          <p>Input komposisi bahan baku dan langkah memasak standar MBG.</p>
        </div>
        <div class="card-arrow">→</div>
      </article>

      <article class="card">
        <div class="card-icon">✅</div>
        <div class="card-body">
          <h3>Status Review</h3>
          <p>{{ approvedCount }} Resep Anda telah disetujui Administrator.</p>
        </div>
      </article>
    </div>

    <section class="slider-section" v-if="myRecipes.length > 0">
      <div class="section-header">
        <h3>🚀 Koleksi Resep Anda</h3>
        <button class="btn-manage" @click="router.push('/my-recipes')">Kelola Semua →</button>
      </div>
      
      <div class="slider-container">
        <div class="slider-track" :style="{ animationDuration: sliderDuration }">
          <div 
            v-for="(recipe, index) in displayRecipes" 
            :key="index" 
            class="mini-card"
            @click="openQuickView(recipe)"
          >
            <img :src="recipe.Menu_Image || '/img/placeholder-food.png'" alt="Menu">
            <div class="mini-card-text">
              <h4>{{ recipe.Menu_Name }}</h4>
              <span class="tag">{{ recipe.targetAKG }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="empty-recipe-promo" v-else>
      <div class="promo-card" @click="router.push('/recipe')">
        <span>👨‍🍳 Belum ada resep? Yuk mulai berkreasi sekarang!</span>
      </div>
    </section>

    <div class="dashboard-main-grid">
      <section class="chart-container card">
        <h3>📊 Dampak Penggunaan Menu</h3>
        <p class="chart-sub">Total jangkauan porsi (M+F) berdasarkan data Menu Schedule.</p>
        
        <div class="canvas-wrapper">
          <canvas v-show="chartData.length > 0" ref="usageChart"></canvas>
          
          <div v-if="chartData.length === 0 && !isLoading" class="empty-chart">
            <div class="empty-icon">📊</div>
            <h4>Belum Ada Data Penggunaan</h4>
            <p>Resep Anda belum tercatat di jadwal perencanaan menu manapun.</p>
          </div>
        </div>
      </section>

      <aside class="card log-card">
        <h3>🕒 Aktivitas</h3>
        <div class="log-list">
          <div v-for="log in activities" :key="log.activityID" class="log-item">
            <p>{{ log.activity_log }}</p>
            <small>{{ new Date(log.timestamp).toLocaleDateString() }}</small>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>

<style scoped>
/* --- SLIDER STYLES --- */
.slider-section { margin-bottom: 35px; }
.section-header { 
  display: flex; justify-content: space-between; align-items: center; 
  margin-bottom: 15px; padding: 0 10px;
}
.section-header h3 { color: #1c4d8d; font-weight: 800; }
.btn-manage {
  background: none; border: none; color: #1c4d8d; font-weight: 700; cursor: pointer;
}

slider-container {
  overflow: hidden;
  background: #f8fafc;
  border-radius: 20px;
  padding: 20px 0;
  margin-bottom: 30px;
  position: relative;
  /* Efek mask transparan di kiri & kanan */
  mask-image: linear-gradient(
    to right,
    transparent,
    black 10%,
    black 90%,
    transparent
  );
  -webkit-mask-image: linear-gradient(
    to right,
    transparent,
    black 10%,
    black 90%,
    transparent
  );
}

.slider-track {
  display: flex;
  width: max-content;
  gap: 25px; /* Jarak antar card diperlebar sedikit */
  animation: scroll linear infinite;
}

.slider-track:hover { animation-play-state: paused; }
@keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

.mini-card {
  width: 280px;
  background: white;
  padding: 15px;
  border-radius: 16px;
  display: flex;
  gap: 15px;
  align-items: center;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
  border: 1px solid transparent;
  transition: all 0.3s ease;
}

.mini-card:hover {
  transform: translateY(-5px);
  border-color: #1c4d8d;
  box-shadow: 0 8px 20px rgba(28, 77, 141, 0.15);
}
.mini-card img { width: 50px; height: 50px; border-radius: 8px; object-fit: cover; }
.mini-card h4 { font-size: 0.85rem; margin: 0; color: #1e293b; }

/* --- CHART & GRID --- */
.dashboard-main-grid { display: grid; grid-template-columns: 2fr 1fr; gap: 25px; }
.canvas-wrapper { height: 300px; margin-top: 20px; position: relative; }
.empty-chart {
  height: 100%; display: flex; flex-direction: column; align-items: center; 
  justify-content: center; text-align: center; color: #94a3b8;
  border: 2px dashed #e2e8f0; border-radius: 12px;
}
.empty-icon { font-size: 3rem; margin-bottom: 10px; opacity: 0.3; }

.chart-container {
  background: #ffffff;
  border-radius: 20px;
  padding: 25px;
  border: 1px solid #f1f5f9;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
}

.log-timeline { display: flex; flex-direction: column; gap: 12px; }
.log-item { padding-left: 10px; border-left: 2px solid #1c4d8d; }
.log-item p { font-size: 0.8rem; margin: 0; }
.log-item small { color: #94a3b8; font-size: 0.7rem; }

.developer-dashboard {
  animation: fadeIn 0.5s ease-in-out;
}

/* Grid Utama */
.dashboard-main-grid {
  display: grid;
  grid-template-columns: 1.5fr 1fr;
  gap: 25px;
}

.welcome-box {
  background: var(--primary-gradient);
  color: white;
  padding: 40px;
  border-radius: 20px;
  margin-bottom: 30px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: var(--shadow-md);
}

.welcome-text h1 {
  font-size: 2rem;
  font-weight: 800;
  margin-bottom: 10px;
}

.welcome-stats {
  background: rgba(255, 255, 255, 0.1);
  padding: 15px 25px;
  border-radius: 15px;
  backdrop-filter: blur(5px);
}

.mini-stat .label {
  display: block;
  font-size: 0.75rem;
  text-transform: uppercase;
  opacity: 0.8;
  font-weight: 700;
}

.mini-stat .value {
  font-size: 1.2rem;
  font-weight: 800;
}

/* Action Cards */
.action-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 25px;
  margin-bottom: 30px;
}

.card {
  background: white;
  padding: 30px;
  border-radius: 18px;
  display: flex;
  align-items: flex-start;
  gap: 20px;
  box-shadow: var(--shadow-sm);
  transition: all 0.3s ease;
  border: 1px solid #f1f5f9;
}

.card.clickable {
  cursor: pointer;
  border: 2px dashed var(--primary-light);
}

.card.clickable:hover {
  transform: translateY(-5px);
  background: #f0f7ff;
  border-color: var(--primary);
  box-shadow: var(--shadow-md);
}

.card-icon {
  font-size: 2.5rem;
  background: #f8fafc;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
}

.card-body h3 {
  color: var(--primary);
  margin-bottom: 8px;
  font-weight: 700;
}

.card-body p {
  font-size: 0.9rem;
  color: var(--text-muted);
  line-height: 1.5;
}

.card-arrow {
  margin-left: auto;
  color: var(--primary);
  font-weight: 800;
  font-size: 1.2rem;
}

/* Overview Section */
.overview-section .card {
  display: block;
  min-height: 250px;
}

.card-header {
  margin-bottom: 20px;
}

.placeholder-content {
  border: 2px dashed #e2e8f0;
  border-radius: 12px;
  height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #94a3b8;
  font-style: italic;
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

@media (max-width: 768px) {
  .welcome-box { flex-direction: column; text-align: center; gap: 20px; }
  .welcome-text h1 { font-size: 1.5rem; }
}
</style>