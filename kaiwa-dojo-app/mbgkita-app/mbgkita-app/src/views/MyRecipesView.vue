<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiCall } from '../services/api'
import Swal from 'sweetalert2'

const router = useRouter()
const myRecipes = ref<any[]>([])
const searchQuery = ref('')
const isLoading = ref(true)
const SHEETS = {
  MENU: "Menu Databases",
  ING: "Menu Ingredients",
};

const currentUserID = sessionStorage.getItem('userID')

// State untuk Modal Detail
const isModalOpen = ref(false)
const selectedRecipe = ref<any>(null)
const allIngredientsData = ref<any[]>([]) // Menampung raw data dari sheet Ingredients
const activeTab = ref('normal'); // 'normal' atau '1000'

onMounted(async () => {
  if (!currentUserID) {
    router.push('/login')
    return
  }
  await fetchMyRecipes()
})

// Computed untuk memproses JSON bahan sesuai Tab yang dipilih
const ingredientsForSelected = computed(() => {
  if (!selectedRecipe.value) return [];
  
  const rawRow = allIngredientsData.value.find(ing => String(ing.MenuID) === String(selectedRecipe.value.MenuID));
  
  if (rawRow) {
    // Pilih kolom JSON berdasarkan tab aktif
    const jsonField = activeTab.value === 'normal' ? rawRow.Ingredients_JSON : rawRow.Ingredients_1000_JSON;
    
    if (jsonField) {
      try {
        const parsed = JSON.parse(jsonField);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) {
        console.error("Gagal parse JSON bahan:", e);
        return [];
      }
    }
  }
  return [];
});

const fetchMyRecipes = async () => {
  isLoading.value = true;
  try {
    const [menuData, ingredientData] = await Promise.all([
      apiCall<any[]>('readAll', 'Menu Databases'),
      apiCall<any[]>('readAll', 'Menu Ingredients')
    ]);

    // Pastikan data yang masuk adalah Array, jika tidak jadikan array kosong
    const menus = Array.isArray(menuData) ? menuData : [];
    const ingredients = Array.isArray(ingredientData) ? ingredientData : [];
    
    allIngredientsData.value = ingredients;

    if (menus.length > 0) {
      myRecipes.value = menus
        .filter((m: any) => String(m.userID || m.UserID).trim() === String(currentUserID).trim())
        .map((menu: any) => {
          // Cari baris di sheet ingredients yang MenuID-nya cocok
          const recipeIngRow = ingredients.find((ing: any) => String(ing.MenuID) === String(menu.MenuID));
          
          let count = 0;
          if (recipeIngRow && recipeIngRow.Ingredients_JSON) {
            try {
              const parsed = JSON.parse(recipeIngRow.Ingredients_JSON);
              count = Array.isArray(parsed) ? parsed.length : 0;
            } catch (e) {
              console.error("Gagal parse count:", e);
            }
          }

          return {
            ...menu,
            ingredientCount: count
          };
        });
    } else {
      myRecipes.value = [];
    }
  } catch (error) {
    console.error("Fetch Error:", error);
  } finally {
    isLoading.value = false;
  }
};

// Fungsi ini mengubah data (JSON atau String) menjadi Array langkah-langkah
const formatProcedures = (data: any) => {
  if (!data) return [];
  
  try {
    // 1. Jika data adalah string JSON array (misal: '["Potong ayam", "Rebus air"]')
    if (typeof data === 'string' && data.startsWith('[')) {
      const parsed = JSON.parse(data);
      return Array.isArray(parsed) ? parsed : [data];
    }
    
    // 2. Jika data sudah berupa Array objek dari Apps Script
    if (Array.isArray(data)) return data;
    
    // 3. Jika data adalah string biasa dengan enter (\n), pecah menjadi array
    if (typeof data === 'string') {
      return data.split('\n').filter(step => step.trim() !== '');
    }
    
    return [data.toString()];
  } catch (e) {
    return [data.toString()];
  }
};

const filteredRecipes = computed(() => {
  return myRecipes.value.filter(r => 
    r.Menu_Name.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Fungsi Aksi
const viewDetails = (recipe: any) => {
  selectedRecipe.value = recipe;
  activeTab.value = 'normal'; 
  isModalOpen.value = true;
};

const closeModal = () => {
  isModalOpen.value = false
  selectedRecipe.value = null
}

const editRecipe = (id: string) => {
  router.push({ path: '/recipe-editor', query: { edit: id } })
}

const removeRecipe = async (id: string, name: string) => {
  const result = await Swal.fire({
    title: 'Hapus Resep?',
    text: `Menghapus "${name}" akan menghapus seluruh data bahan baku di server secara permanen.`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonColor: '#d33',
    confirmButtonText: 'Ya, Hapus!',
    cancelButtonText: 'Batal'
  });

  if (result.isConfirmed) {
    try {
      // Memanggil action 'deleteMenu' sesuai router GAS kamu
      // GAS kamu menggunakan parameter 'id' (bukan MenuID)
      const response = await apiCall('deleteMenu', 'Menu Databases', { 
        id: id, 
        userId: currentUserID 
      });

      if (response) {
        // Hapus dari tampilan lokal agar UI update seketika
        myRecipes.value = myRecipes.value.filter(r => r.MenuID !== id);
        
        Swal.fire({
          title: 'Terhapus!',
          text: 'Data menu dan bahan baku berhasil dibersihkan.',
          icon: 'success',
          timer: 1500,
          showConfirmButton: false
        });
      }
    } catch (error) {
      console.error("Gagal menghapus:", error);
      Swal.fire('Gagal!', 'Terjadi gangguan koneksi ke database.', 'error');
    }
  }
};

const isSlotFilled = (index: number) => {
  if (!selectedRecipe.value || !selectedRecipe.value.targetAKG) return false;

  try {
    // Mengubah string '["1","4"]' menjadi array asli
    const activeSlots = JSON.parse(selectedRecipe.value.targetAKG);
    return Array.isArray(activeSlots) && activeSlots.includes(index.toString());
  } catch (e) {
    // Fallback jika formatnya bukan JSON (misal teks "1, 2")
    return selectedRecipe.value.targetAKG.includes(index.toString());
  }
};

</script>

<template>
  <div class="my-recipes-page">
    <header class="page-header">
      <div class="header-content">
        <h1>🍳 Koleksi Resep Saya</h1>
        <p>Kelola dan pantau status publikasi resep Anda.</p>
      </div>
      <button class="btn-primary" @click="router.push('/recipe')">
        <span>+</span> Tambah Resep
      </button>
    </header>

    <div class="search-section">
      <div class="search-box">
        <span class="search-icon">🔍</span>
        <input v-model="searchQuery" type="text" placeholder="Cari resep..." />
      </div>
    </div>

    <div v-if="isLoading" class="loader-container">
      <div class="loader"></div>
      <p>Memuat resep...</p>
    </div>

    <div v-else-if="filteredRecipes.length > 0" class="recipe-grid">
      <article v-for="recipe in filteredRecipes" :key="recipe.MenuID" class="recipe-card">
        <div class="status-overlay">
          <span class="status-badge" :class="recipe.Status?.toLowerCase()">{{ recipe.Status }}</span>
        </div>
        
        <img :src="recipe.Menu_Image || '/img/placeholder-food.png'" class="card-img" />
        
        <div class="card-content">
          <h3>{{ recipe.Menu_Name }}</h3>
          
          <div class="meta-info">
            <div class="meta-item">
                <span class="meta-icon">🥕</span>
                <span class="meta-text">{{ recipe.ingredientCount }} Bahan</span>
            </div>
            <div class="meta-divider"></div>
            <div class="meta-item">
                <span class="meta-icon">🔥</span>
                <span class="meta-text">{{ recipe.Total_Nutrition }}</span>
            </div>
            </div>

          <div class="card-actions-row">
            <button class="btn-action view" @click="viewDetails(recipe)" title="Lihat Detail">👁️</button>
            <button class="btn-action edit" @click="editRecipe(recipe.MenuID)" title="Edit">✏️</button>
            <button class="btn-action delete" @click="removeRecipe(recipe.MenuID, recipe.Menu_Name)" title="Hapus">🗑️</button>
          </div>
        </div>
      </article>
    </div>

    <Transition name="fade">
      <div v-if="isModalOpen && selectedRecipe" class="modal-overlay" @click.self="closeModal">
        <div class="modal-container">
          <button class="modal-close" @click="closeModal">&times;</button>
          
          <div class="modal-scroll-area">
            <div class="modal-top-section">
              <img :src="selectedRecipe.Menu_Image || '/img/placeholder-food.png'" class="modal-img-full" />
              <div class="info-content">
                <div class="badge-row">
                  <span class="status-tag" :class="selectedRecipe.Status?.toLowerCase()">{{ selectedRecipe.Status }}</span>
                  <span class="id-tag">ID: {{ selectedRecipe.MenuID }}</span>
                </div>
                <h2>{{ selectedRecipe.Menu_Name }}</h2>
                <p class="desc">{{ selectedRecipe.Menu_Description || 'Tidak ada deskripsi.' }}</p>
                <div class="nutrition-card">
                  <strong>🔥 Total Nutrisi:</strong> {{ selectedRecipe.Total_Nutrition }}
                </div>
              </div>
            </div>

            <div class="view-tray-visualization">
              <h3 class="section-title">📍 Tata Letak Nampan:</h3>
              <div class="food-tray-container">
                <div class="tray-layout">
                  <div v-for="i in [1, 2, 3, 4, 5]" :key="i" 
                      class="tray-slot" 
                      :class="{ 'filled': isSlotFilled(i) }" 
                      :data-slot="i">
                    <span class="slot-label">Slot {{ i }}</span>
                    <span class="food-name">
                      {{ isSlotFilled(i) ? selectedRecipe.Menu_Name : 'Kosong' }}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div class="ingredients-section">
            <div class="section-header-inline">
                <h3 class="section-title">🥗 Daftar Bahan Baku</h3>
                
                <div class="tab-container">
                <button 
                    :class="['tab-btn', { active: activeTab === 'normal' }]" 
                    @click="activeTab = 'normal'"
                >
                    Porsi Normal
                </button>
                <button 
                    :class="['tab-btn', { active: activeTab === '1000' }]" 
                    @click="activeTab = '1000'"
                >
                    Porsi 1000
                </button>
                </div>
            </div>

            <div class="ingredients-card">
                <div v-if="ingredientsForSelected.length > 0" class="ing-grid">
                <div v-for="(ing, idx) in ingredientsForSelected" :key="idx" class="ing-row">
                    <div class="ing-info">
                    <span class="ing-bullet">•</span>
                    <span class="ing-name">{{ ing.name }}</span>
                    </div>
                    <div class="ing-amount">
                    <span class="qty">{{ ing.qty }}</span>
                    <span class="unit">{{ ing.unit }}</span>
                    </div>
                </div>
                </div>
                <div v-else class="empty-state">
                <p>Data bahan untuk porsi ini belum tersedia.</p>
                </div>
            </div>
            </div>
            <div class="procedure-section">
            <h3 class="section-title">📝 Prosedur Memasak:</h3>
            
            <ol class="procedure-list">
                <template v-if="selectedRecipe.Menu_Procedure">
                <li v-for="(step, index) in formatProcedures(selectedRecipe.Menu_Procedure)" :key="index">
                    {{ step }}
                </li>
                </template>
                <p v-else class="no-data">Tidak ada instruksi memasak.</p>
            </ol>
            </div>

            <div v-if="selectedRecipe.Menu_Video" class="video-footer">
              <a :href="selectedRecipe.Menu_Video" target="_blank" class="video-btn">
                ▶ Tonton Video Tutorial
              </a>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style scoped>
/* --- 1. Layout & Page Header --- */
.my-recipes-page { 
  max-width: 100%; 
  overflow-x: hidden; 
  padding: 20px; 
  background: #f8fafc; /* Latar belakang lembut agar card lebih menonjol */
}

.page-header { 
  display: flex; 
  justify-content: space-between; 
  align-items: center; 
  margin-bottom: 25px; 
}

.header-content h1 {
  font-size: 1.8rem;
  color: #1c4d8d;
  font-weight: 800;
  margin: 0;
}

.btn-primary { 
  background: #1c4d8d; 
  color: white; 
  border: none; 
  padding: 12px 24px; 
  border-radius: 12px; 
  cursor: pointer; 
  font-weight: 700; 
  transition: all 0.3s ease;
}

.btn-primary:hover {
  background: #153a6b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(28, 77, 141, 0.2);
}

/* --- 2. Search Section --- */
.search-box { 
  background: white; 
  padding: 12px 18px; 
  border-radius: 12px; 
  display: flex; 
  align-items: center; 
  box-shadow: 0 2px 8px rgba(0,0,0,0.05); 
  margin-bottom: 25px; 
  border: 1px solid #e2e8f0;
}

.search-box input { 
  border: none; 
  outline: none; 
  width: 100%; 
  margin-left: 10px; 
  font-size: 0.95rem;
}

/* --- 3. Recipe Grid & Cards --- */
.recipe-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); 
  gap: 25px; 
}

.recipe-card { 
  background: white; 
  border-radius: 20px; 
  overflow: hidden; 
  box-shadow: 0 4px 15px rgba(0,0,0,0.06); 
  position: relative; 
  transition: transform 0.3s ease;
  border: 1px solid #f1f5f9;
}

.recipe-card:hover {
  transform: translateY(-8px);
}

.card-img { 
  width: 100%; 
  height: 180px; 
  object-fit: cover; 
}

.card-content { 
  padding: 20px; 
}

.card-content h3 {
  margin: 0 0 8px 0;
  font-size: 1.1rem;
  color: #1e293b;
}

/* Desain Minimalis & Menyatu */
.meta-info {
  display: flex;
  align-items: center;
  gap: 15px; /* Jarak antar info */
  margin: 12px 0 20px 0;
  padding: 0; /* Hapus padding agar tidak membentuk kotak */
}

.meta-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.meta-icon {
  font-size: 1.1rem;
  filter: drop-shadow(0 2px 4px rgba(0,0,0,0.1));
}

.meta-text {
  font-size: 0.85rem;
  font-weight: 600;
  color: #64748b; /* Abu-abu Slate agar tidak sepekat judul */
}

/* Garis pembatas vertikal tipis */
.meta-divider {
  width: 1.5px;
  height: 14px;
  background: #e2e8f0;
  border-radius: 2px;
}

/* Berikan warna biru lembut khusus untuk angka nutrisi agar menonjol tapi tetap rapi */
.meta-item:last-child .meta-text {
  color: #1c4d8d;
}

/* Card Actions */
.card-actions-row { 
  display: grid; 
  grid-template-columns: repeat(3, 1fr); 
  gap: 8px; 
}

.btn-action { 
  border: none; 
  padding: 10px; 
  border-radius: 10px; 
  cursor: pointer; 
  font-size: 1.1rem; 
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
}

.btn-action.view { background: #f1f5f9; color: #1c4d8d; }
.btn-action.edit { background: #f0fdf4; color: #166534; }
.btn-action.delete { background: #fef2f2; color: #991b1b; }

.btn-action:hover { 
  transform: scale(1.05); 
  filter: brightness(0.95);
}

/* --- MODAL SYSTEM (VERTIKAL & SCROLLABLE) --- */
.modal-overlay { 
  position: fixed; top: 0; left: 0; width: 100%; height: 100%; 
  background: rgba(0,0,0,0.7); backdrop-filter: blur(5px);
  display: flex; justify-content: center; align-items: center; z-index: 9999; 
}

.modal-container { 
  background: white; 
  width: 90%; 
  max-width: 650px; /* Dipersempit agar layout vertikal enak dibaca */
  height: 90vh; 
  border-radius: 24px; 
  position: relative; 
  overflow: hidden; 
  display: flex;
  flex-direction: column;
}

.modal-scroll-area {
  padding: 35px;
  overflow-y: auto; 
  flex: 1;
}

.modal-close { 
  position: absolute; top: 15px; right: 15px; 
  background: #f1f5f9; border: none; font-size: 1.5rem; 
  width: 40px; height: 40px; border-radius: 50%; cursor: pointer; 
  z-index: 10; display: flex; align-items: center; justify-content: center;
}

/* Header Sections */
.modal-img-full { width: 100%; height: 300px; border-radius: 18px; object-fit: cover; margin-bottom: 25px; }
.badge-row { display: flex; gap: 10px; margin-bottom: 12px; }
.status-tag { background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; font-weight: 800; text-transform: uppercase;}
.status-tag.approved { background: #dcfce7; color: #166534; }
.id-tag { background: #f1f5f9; color: #64748b; padding: 4px 10px; border-radius: 6px; font-size: 0.75rem; }

.info-content h2 { color: #1c4d8d; font-weight: 800; margin-bottom: 10px; font-size: 1.6rem; }
.desc { line-height: 1.6; color: #64748b; margin-bottom: 20px; font-size: 0.95rem; }
.nutrition-card { background: #f0f7ff; padding: 15px 20px; border-radius: 12px; color: #1c4d8d; font-weight: 700; margin-bottom: 10px; border-left: 5px solid #1c4d8d; }

.section-title { font-size: 1.1rem; color: #1c4d8d; font-weight: 800; margin: 30px 0 15px; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; }

/* Tray Visualization (Nampan) */
.food-tray-container { background: #f1f5f9; padding: 20px; border-radius: 20px; border: 4px solid #fff; box-shadow: 0 4px 10px rgba(0,0,0,0.05); margin-bottom: 10px; }
.tray-layout { display: grid; grid-template-areas: "s1 s2 s2 s3" "s4 s4 s4 s5"; gap: 10px; height: 180px; }
.tray-slot { background: #e2e8f0; border-radius: 12px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 5px; text-align: center; color: #94a3b8; border: 2px dashed #cbd5e1; transition: 0.3s; }
.tray-slot.filled { background: #1c4d8d; color: white; border: 2px solid #0f2a4d; }
.tray-slot[data-slot="1"] { grid-area: s1; }
.tray-slot[data-slot="2"] { grid-area: s2; }
.tray-slot[data-slot="3"] { grid-area: s3; }
.tray-slot[data-slot="4"] { grid-area: s4; }
.tray-slot[data-slot="5"] { grid-area: s5; border-radius: 50%; }
.slot-label { font-size: 0.55rem; font-weight: 800; opacity: 0.7; margin-bottom: 4px; }
.food-name { font-size: 0.65rem; font-weight: 700; line-height: 1.2; overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; line-clamp: 2; -webkit-box-orient: vertical; }

/* Header & Tab Layout */
.section-header-inline {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 30px 0 15px;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 10px;
}

.section-title {
  font-size: 1.1rem;
  color: #1c4d8d;
  font-weight: 800;
  margin: 0;
  border: none; /* Hapus border bawaan sebelumnya */
}

.tab-container {
  display: flex;
  background: #f1f5f9;
  padding: 4px;
  border-radius: 10px;
  gap: 4px;
}

.tab-btn {
  border: none;
  padding: 6px 14px;
  border-radius: 8px;
  font-size: 0.8rem;
  font-weight: 700;
  cursor: pointer;
  transition: 0.3s;
  color: #64748b;
  background: transparent;
}

.tab-btn.active {
  background: white;
  color: #1c4d8d;
  box-shadow: 0 2px 6px rgba(0,0,0,0.05);
}

/* Ingredients List Styling */
.ingredients-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 16px;
  overflow: hidden;
}

.ing-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.2s;
}

.ing-row:hover {
  background: #fcfdfe;
}

.ing-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ing-bullet {
  color: #1c4d8d;
  font-weight: bold;
}

.ing-name {
  font-weight: 600;
  color: #334155;
  font-size: 0.95rem;
}

.ing-amount {
  display: flex;
  gap: 5px;
  align-items: baseline;
}

.qty {
  color: #1c4d8d;
  font-weight: 800;
  font-size: 1rem;
}

.unit {
  color: #94a3b8;
  font-size: 0.8rem;
  font-weight: 600;
}

.empty-state {
  padding: 30px;
  text-align: center;
  color: #94a3b8;
  font-style: italic;
}

/* Procedure & Video */
.procedure-box { background: #f8fafc; padding: 20px; border-radius: 16px; border: 1px solid #e2e8f0; line-height: 1.8; color: #334155; font-size: 0.95rem; }
/* --- Styling Prosedur (Gaya ListMenuView) --- */
.procedure-list {
  padding-left: 20px;
  margin: 0;
  color: #334155;
}

.procedure-list li {
  margin-bottom: 12px;
  line-height: 1.6;
  padding-left: 10px;
  font-size: 0.95rem;
}

/* Styling nomor agar lebih tebal dan berwarna biru */
.procedure-list li::marker {
  color: #1c4d8d;
  font-weight: 800;
}

.no-data {
  color: #94a3b8;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.section-title {
  font-size: 1.1rem;
  color: #1c4d8d;
  font-weight: 800;
  margin: 30px 0 15px;
  border-bottom: 2px solid #f1f5f9;
  padding-bottom: 8px;
}
.video-footer { margin-top: 30px; padding-bottom: 10px; }
.video-btn { display: block; background: #ef4444; color: white; text-align: center; padding: 16px; border-radius: 12px; text-decoration: none; font-weight: 800; transition: 0.3s; }
.video-btn:hover { background: #dc2626; transform: translateY(-2px); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); }

/* --- 6. Status Badges --- */
.status-badge { 
  position: absolute; 
  top: 12px; left: 12px; 
  padding: 6px 12px; 
  border-radius: 8px; 
  font-size: 0.75rem; 
  font-weight: 800; 
  color: white; 
  background: #94a3b8; 
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  text-transform: uppercase;
}

.status-badge.approved { background: #10b981; }
.status-badge.pending { background: #f59e0b; }
.status-badge.rejected { background: #ef4444; }

/* --- 7. Animations --- */
.fade-enter-active, .fade-leave-active { transition: opacity 0.3s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>