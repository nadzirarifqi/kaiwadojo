<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { apiCall } from '../services/api'
import Swal from 'sweetalert2'

const router = useRouter()
const menus = ref<any[]>([])
const searchQuery = ref('')
const isLoading = ref(true)

const isModalOpen = ref(false);
const selectedMenuForModal = ref<any>(null);
const targetGroup = ref('');
const quantity = ref(0);

// Ambil tanggal yang sedang dikerjakan agar user tahu mereka memilih menu untuk kapan
const activeDate = sessionStorage.getItem('plannerSavedDate') || ''

onMounted(async () => {
  isLoading.value = true;
  
  try {
    // 1. Ambil data dari kedua sheet secara bersamaan
    const [menuData, ingredientData, userData] = await Promise.all([
      apiCall<any[]>('readAll', 'Menu Databases'),
      apiCall<any[]>('readAll', 'Menu Ingredients'),
      apiCall<any[]>('readAll', 'Users')
    ]);

    if (menuData && ingredientData) {
      // 2. Proses Join & Ekstraksi Nutrisi
      menus.value = menuData
        .filter((m: any) => m.Status === 'Approved')
        .map((menu: any) => {
          // --- LOGIKA MENCARI NAMA DEVELOPER ---
          const currentMenuUserID = String(menu.UserID || menu.userID || "").trim();

          const developer = userData?.find((u: any) => {
            const currentUserID = String(u.userID || u.UserID || "").trim();
            return currentUserID !== "" && currentUserID === currentMenuUserID;
          });

          // --- LOGIKA EKSTRAKSI NUTRISI ---
          const rawNutri = menu.Total_Nutrition || "";
          // Fungsi helper untuk mengambil angka saja dari teks menggunakan Regex
          const getNum = (pattern: RegExp) => {
            const match = rawNutri.match(pattern);
            return match ? match[1] : "0"; // Default "0" jika tidak ditemukan
          };

          // Cari baris bahan baku yang sesuai
          const match = ingredientData.find((ing: any) => ing.MenuID === menu.MenuID);
          
          return {
            ...menu,
            userID: currentMenuUserID, // Simpan dengan nama yang seragam
            developerName: developer ? developer.owner_name : `Developer (ID: ${currentMenuUserID || '?'})`,
            // Ekstrak angka nutrisi ke properti terpisah untuk desain card
            Calories: getNum(/(\d+)\s*kcal/i),
            Protein: getNum(/(\d+)g\s*Protein/i),
            Fat: getNum(/(\d+)g\s*Lemak/i),
            Carbs: getNum(/(\d+)g\s*Karbo/i),
            
            // Masukkan data bahan baku
            Ingredients_JSON: match ? match.Ingredients_JSON : "[]"
          };
        });
    }
  } catch (error) {
    console.error("Gagal sinkronisasi database menu:", error);
    Swal.fire('Error', 'Gagal memuat database menu atau bahan baku', 'error');
  } finally {
    isLoading.value = false;
  }
});

const formatProcedures = (text: string) => {
  if (!text) return [];
  
  // Jika data berupa string array '["Langkah 1", "Langkah 2"]'
  if (text.startsWith('[') && text.endsWith(']')) {
    try {
      return JSON.parse(text);
    } catch (e) {
      console.error("Gagal parse prosedur array:", e);
    }
  }

  // Jika data berupa teks panjang, pecah berdasarkan baris baru atau titik
  return text
    .split(/\n|\. /) 
    .map(step => step.trim())
    .filter(step => step.length > 0);
};

// Fungsi Pencarian
const filteredMenus = computed(() => {
  return menus.value.filter(m => 
    m.Menu_Name.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
    m.targetAKG.toLowerCase().includes(searchQuery.value.toLowerCase())
  )
})

// Ambil data sasaran dari draft lokal agar user bisa memilih kelompok yang ada
const currentDraft = computed(() => {
  const master = JSON.parse(localStorage.getItem('planner_report_draft') || '{}');
  return master[activeDate] || { peserta: [], nonPeserta: [] };
});

const selectMenu = (menu: any) => {
  selectedMenuForModal.value = menu;
  isModalOpen.value = true;
};

const getAssetUrl = (name: string) => {
  return new URL(`../assets/images/${name}`, import.meta.url).href;
};

const isSlotFilled = (index: number) => {
  if (!selectedMenuForModal.value || !selectedMenuForModal.value.targetAKG) return false;

  try {
    // Mengubah string '["1","4"]' menjadi array asli
    const activeSlots = JSON.parse(selectedMenuForModal.value.targetAKG);
    
    // Cek apakah angka index (sebagai string) ada di dalam array
    return activeSlots.includes(index.toString());
  } catch (e) {
    // Jika bukan format JSON (misal teks biasa), lakukan pengecekan teks sederhana
    return selectedMenuForModal.value.targetAKG.includes(index.toString());
  }
};

  
const confirmSelection = () => {
  // 1. Validasi Input Dasar
  if (!targetGroup.value) {
    Swal.fire('Peringatan', 'Silakan pilih kelompok sasaran terlebih dahulu!', 'warning');
    return;
  }

  // 2. Ambil Data dari LocalStorage dengan Safety Fallback
  const master = JSON.parse(localStorage.getItem('planner_report_draft') || '{}');
  const dayData = master[activeDate];

  
  if (!dayData) {
    Swal.fire('Error', 'Sesi perencanaan tidak ditemukan. Silakan pilih tanggal kembali.', 'error');
    return;
  }

  // Pastikan struktur array minimal tersedia
  if (!dayData.ingredients) dayData.ingredients = [];
  if (!dayData.peserta) dayData.peserta = [];
  if (!dayData.nonPeserta) dayData.nonPeserta = [];

  // 3. Cari Baris Target (Sekolah/Instansi)
  const targetRow = dayData.peserta.find((p: any) => p.school === targetGroup.value) || 
                    dayData.nonPeserta.find((p: any) => p.school === targetGroup.value);

  if (!targetRow) {
    Swal.fire('Error', 'Kelompok sasaran tidak ditemukan dalam draft.', 'error');
    return;
  }

  // 4. Update Porsi di Baris Terkait (Jika user input quantity di modal)
  if (quantity.value > 0) {
    // Membagi porsi ke Laki-laki dan Perempuan secara proporsional sederhana
    targetRow.male = Math.floor(quantity.value / 2);
    targetRow.female = Math.ceil(quantity.value / 2);
  }

  // Hitung Total Porsi Final untuk kalkulasi bahan baku
  const porsiFinal = Number(targetRow.male || 0) + Number(targetRow.female || 0);

  if (porsiFinal <= 0) {
    Swal.fire('Peringatan', 'Jumlah porsi tidak boleh 0. Silakan isi porsi di modal atau di tabel.', 'warning');
    return;
  }

  // 5. Update Menu Terpasang di Baris Tersebut
  if (!targetRow.menuIDs.includes(selectedMenuForModal.value.MenuID)) {
    targetRow.menuIDs.push(selectedMenuForModal.value.MenuID);
    targetRow.menuNames.push(selectedMenuForModal.value.Menu_Name);
  }

  // 6. LOGIKA BAHAN BAKU (INGRIDIENTS)
  try {
    const recipeStr = selectedMenuForModal.value.Ingredients_JSON || "[]";
    const recipe = JSON.parse(recipeStr);

    recipe.forEach((item: any) => {
      // Validasi angka: porsi * takaran (qty di JSON)
      const amountPerPortion = Number(item.qty || 0);
      const totalNeeded = porsiFinal * amountPerPortion;

      if (totalNeeded > 0) {
        const existingIndex = dayData.ingredients.findIndex((ing: any) => 
          ing.name.trim().toLowerCase() === item.name.trim().toLowerCase()
        );

        if (existingIndex !== -1) {
          // Akumulasi: Pastikan penjumlahan angka murni (bukan string)
          const currentQty = Number(dayData.ingredients[existingIndex].qty || 0);
          dayData.ingredients[existingIndex].qty = currentQty + totalNeeded;
        } else {
          // Tambah bahan baru ke daftar belanja harian
          dayData.ingredients.push({
            name: item.name,
            qty: totalNeeded,
            unit: item.unit || 'unit',
            price: 0 // Harga akan diisi manual di PlannerView
          });
        }
      }
    });
  } catch (err) {
    console.error("Critical Error pada parsing resep:", err);
    Swal.fire('Error', 'Format data resep di database tidak valid.', 'error');
    return;
  }

  // 7. Simpan Kembali ke LocalStorage & Redireksi
  try {
    localStorage.setItem('planner_report_draft', JSON.stringify(master));
    
    Swal.fire({
      title: 'Berhasil!',
      text: `Menu & Bahan Baku berhasil ditambahkan untuk ${porsiFinal} porsi.`,
      icon: 'success',
      timer: 1500,
      showConfirmButton: false
    }).then(() => {
      router.push('/planner');
    });
  } catch (saveErr) {
    console.error("Gagal menyimpan ke LocalStorage:", saveErr);
    Swal.fire('Error', 'Memori browser penuh atau tidak tersedia.', 'error');
  }
};
</script>

<template>
  <div class="katalog-container animate-fade-in">
    <header class="content-header">
      <div class="header-titles">
        <button class="btn-back" @click="router.push('/planner')">←</button>
        <div>
          <h1>Katalog Menu Berdasarkan AKG</h1>
          <p v-if="activeDate" class="active-date-info">
            Memilih menu untuk laporan: <strong>{{ activeDate }}</strong>
          </p>
        </div>
      </div>
      
      <div class="search-wrapper">
        <div class="search-bar">
          <span class="search-icon">🔍</span>
          <input type="text" v-model="searchQuery" placeholder="Cari menu..." class="input-field">
        </div>
      </div>
    </header>

    <div v-if="isLoading" class="loader-box">
      <div class="spinner"></div>
      <p>Menghubungkan ke Database Menu...</p>
    </div>
    
    <div v-else-if="filteredMenus.length === 0" class="empty-state">
      <p>Menu tidak ditemukan.</p>
    </div>

    <div v-else class="menu-grid">
      <div v-for="menu in filteredMenus" :key="menu.MenuID" class="menu-card">
        <div class="recipe-badge">APPROVED</div>
        <div class="recipe-thumb-container">
          <img 
            :src="(menu.Menu_Image ? menu.Menu_Image.replace('http://', 'https://') : '') || getAssetUrl('mbgkita.png')" 
            class="recipe-thumb" 
            @error="(e) => { (e.target as HTMLImageElement).src = getAssetUrl('mbgkita.png') }"
          >
        </div>
        <div class="recipe-thumb-content">
          <div class="content-top">
            <span class="category-tag">👨‍🍳 {{ menu.developerName }}</span>
            <span class="calories-pill">🔥 {{ menu.Calories || 0 }} kCal</span>
          </div>
          <h4 class="menu-title">{{ menu.Menu_Name }}</h4>
          <p class="menu-description">{{ menu.Menu_Description || 'Tidak ada deskripsi.' }}</p>
          
          <div class="nutrition-stats">
            <div class="stat-box">
              <span class="stat-label">PROTEIN</span>
              <span class="stat-value">{{ menu.Protein || 0 }}g</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">KARBO</span>
              <span class="stat-value">{{ menu.Carbs || 0 }}g</span>
            </div>
            <div class="stat-box">
              <span class="stat-label">LEMAK</span>
              <span class="stat-value">{{ menu.Fat || 0 }}g</span>
            </div>
          </div>    
          <div class="recipe-actions">
            <button class="action-btn view-btn" @click="selectMenu(menu)">👁️ Detail & Pilih</button>
          </div>
        </div>
      </div>
    </div>

    <div v-if="isModalOpen && selectedMenuForModal" class="modal-overlay">
      <div class="modal-card animate-slide-up">
        <div class="modal-header">
          <h3>Konfirmasi & Tata Letak</h3>
          <button @click="isModalOpen = false" class="btn-close">&times;</button>
        </div>
        
        <div class="modal-body">
          <div class="view-tray-visualization">
            <h3 class="tray-title">📍 Tata Letak Nampan:</h3>
            <div class="food-tray-container">
              <div class="tray-layout">
                <div v-for="i in [1, 2, 3, 4, 5]" :key="i" 
                    class="tray-slot" 
                    :class="{ 'filled': isSlotFilled(i) }" 
                    :data-slot="i">
                  <span class="slot-label">Slot {{ i }}</span>
                  
                  <span class="food-name">
                    {{ selectedMenuForModal['Slot' + i] || (isSlotFilled(i) ? 'Terisi' : 'Kosong') }}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div class="menu-preview mt-15">
            <h4>{{ selectedMenuForModal.Menu_Name }}</h4>
            <p class="description">{{ selectedMenuForModal.Menu_Description || 'Tidak ada deskripsi.' }}</p>
          </div>

          <div class="menu-preview mt-15">
            <h4>Bahan-bahan:</h4>
            <ul class="ingredient-list">
              <template v-if="selectedMenuForModal.Ingredients_JSON">
                <li v-for="(ing, index) in JSON.parse(selectedMenuForModal.Ingredients_JSON)" :key="index">
                  <span class="ing-bullet">•</span> 
                  <span class="ing-name">{{ ing.name }}</span>: 
                  <span class="ing-qty">{{ ing.qty }} {{ ing.unit }}</span>
                </li>
              </template>
              <li v-else class="no-data">Tidak ada data bahan baku.</li>
            </ul>

            <h4 class="mt-15">Prosedur Memasak:</h4>
            <ol class="procedure-list">
              <template v-if="selectedMenuForModal.Menu_Procedure">
                <li v-for="(step, index) in formatProcedures(selectedMenuForModal.Menu_Procedure)" :key="index">
                  {{ step }}
                </li>
              </template>
              <p v-else class="no-data">Tidak ada instruksi memasak.</p>
            </ol>
          </div>
          <div v-if="selectedMenuForModal.Menu_Video" class="video-action-box mt-15">
            <a :href="selectedMenuForModal.Menu_Video" target="_blank" class="btn-video">
              <span class="video-icon">🎬</span> Tonton Video Tutorial Masak
            </a>
          </div>
          <div class="form-group">
            <label>Pilih Kelompok Sasaran:</label>
            <select v-model="targetGroup" class="modal-select">
              <option value="" disabled>-- Pilih Sekolah/Instansi --</option>
              <optgroup label="Peserta Didik">
                <option v-for="p in currentDraft.peserta" :key="p.school" :value="p.school">
                  {{ p.school }} ({{ p.group }})
                </option>
              </optgroup>
              <optgroup label="Lainnya">
                <option v-for="n in currentDraft.nonPeserta" :key="n.school" :value="n.school">
                  {{ n.school }}
                </option>
              </optgroup>
            </select>
          </div>

          <div class="form-group mt-15">
            <label>Jumlah Porsi (Opsional):</label>
            <div class="input-with-unit">
              <input type="number" v-model.number="quantity" class="modal-input" min="0">
              <span class="unit">Porsi</span>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn-cancel" @click="isModalOpen = false">Batal</button>
          <button class="btn-confirm" @click="confirmSelection">Tambahkan ke Laporan</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.katalog-container { padding: 30px; max-width: 1200px; margin: 0 auto; }

.content-header { 
  display: flex; justify-content: space-between; align-items: center; 
  margin-bottom: 30px; gap: 20px;
}

.header-titles { display: flex; align-items: center; gap: 15px; }
.header-titles h1 { font-size: 1.5rem; font-weight: 800; color: #1c4d8d; }
.active-date-info { font-size: 0.85rem; color: #64748b; margin-top: 5px; }

.search-wrapper { flex: 1; max-width: 400px; }
.search-bar { 
  position: relative; display: flex; align-items: center; 
  background: white; border-radius: 12px; border: 1px solid #e2e8f0; padding: 0 15px;
}
.search-icon { margin-right: 10px; opacity: 0.5; }
.input-field { border: none; padding: 12px 0; width: 100%; outline: none; font-weight: 600; }

/* GRID & CARDS */
.menu-grid { 
  display: grid; 
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); 
  gap: 25px; 
}

.menu-card { 
  background: white; border-radius: 20px; border: 1px solid #e2e8f0; 
  display: flex; flex-direction: column; overflow: hidden;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.menu-card:hover { 
  transform: translateY(-8px); 
  box-shadow: 0 15px 30px rgba(0,0,0,0.08); 
  border-color: #1c4d8d;
}

.card-header { padding: 20px 20px 10px; display: flex; justify-content: space-between; align-items: center; }
.category-badge { 
  font-size: 0.7rem; font-weight: 800; text-transform: uppercase;
  background: #e0f2fe; color: #0369a1; padding: 5px 12px; border-radius: 20px; 
}
.menu-id { font-size: 0.7rem; color: #94a3b8; }

.menu-info { padding: 0 20px 20px; flex: 1; }
.menu-info h3 { font-size: 1.2rem; font-weight: 800; color: #1e293b; margin-bottom: 8px; }
.description { font-size: 0.85rem; color: #64748b; line-height: 1.5; }

.menu-description {margin: 10px 0; color: var(--text-muted); font-size: 0.85rem; line-height: 1.5;
display: -webkit-box; -webkit-line-clamp: 3; line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;}

.ingredient-list {
  list-style: none;
  padding: 0;
  margin: 10px 0;
  background: #f8fafc; /* Abu-abu sangat muda */
  border-radius: 12px;
  padding: 15px;
  border-left: 4px solid #1c4d8d; /* Aksen Biru Navy */
}

.ingredient-list li {
  font-size: 0.85rem;
  color: #334155;
  margin-bottom: 6px;
  display: flex;
  gap: 8px;
}

.ing-bullet {
  color: #1c4d8d;
  font-weight: bold;
}

.ing-name {
  font-weight: 600;
}

.ing-qty {
  color: #64748b;
}

.procedure-list  {
  font-size: 0.85rem;
  line-height: 1.6;
  color: #475569;
  white-space: pre-line; /* KRUSIAL: Agar prosedur yang ditulis per baris di database tidak nyambung kesamping */
  padding: 12px;
  padding-top: 0px;
}

.mt-15 { margin-top: 15px; }

.card-footer { padding: 15px 20px 20px; }
.select-btn { 
  width: 100%; background: #1c4d8d; color: white; border: none; 
  padding: 12px; border-radius: 12px; font-weight: 700; cursor: pointer;
  transition: 0.2s;
}
.select-btn:hover { background: #153a6a; }

/* --- Visualisasi Nampan (Tray) --- */
.food-tray-container { 
  background: #ededed; 
  padding: 15px; 
  border-radius: 20px; 
  border: 4px solid #fefefe; 
  max-width: 400px; 
  margin: 10px auto; 
  box-shadow: inset 0 4px 10px rgba(0,0,0,0.05); 
}

.tray-layout { 
  display: grid; 
  grid-template-areas: 
    "s1 s2 s2 s3" 
    "s4 s4 s4 s5"; 
  gap: 10px; 
  height: 200px; 
}

.tray-slot { 
  background: #e3e3e3; 
  border: 2px dashed #cbd5e1; 
  border-radius: 12px; 
  display: flex; 
  flex-direction: column; 
  align-items: center; 
  justify-content: center; 
  padding: 5px;
  text-align: center;
}

.tray-slot.filled {
  background: #1c4d8d;
  border-style: solid;
  color: white;
}

.tray-slot[data-slot="1"] { grid-area: s1; }
.tray-slot[data-slot="2"] { grid-area: s2; }
.tray-slot[data-slot="3"] { grid-area: s3; }
.tray-slot[data-slot="4"] { grid-area: s4; }
.tray-slot[data-slot="5"] { grid-area: s5; border-radius: 100%; }

.slot-label { font-size: 0.5rem; opacity: 0.7; font-weight: 800; }
.food-name { font-size: 0.7rem; font-weight: 700; line-height: 1.1; }

.tray-title { font-size: 0.9rem; margin-bottom: 5px; color: #1c4d8d; font-weight: 800; }

/* --- Menu Card Enhancements --- */
.recipe-thumb-container { width: 100%; height: 160px; overflow: hidden; background: #f1f5f9; }
.recipe-thumb-content {
  padding: 16px;
  background: white;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.recipe-thumb { width: 100%; height: 100%; object-fit: cover; }

/* Kategori & Kalori */
.content-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.category-tag {
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: #1c4d8d;
  background: #eff6ff;
  padding: 4px 10px;
  border-radius: 6px;
  letter-spacing: 0.5px;
}

.calories-pill {
  font-size: 0.75rem;
  font-weight: 700;
  color: #f59e0b;
}

/* Judul Menu */
.menu-title {
  font-size: 1.1rem;
  font-weight: 800;
  color: #1e293b;
  margin: 0;
  line-height: 1.3;
  /* Limit 2 baris agar card tingginya sama */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;

}

/* Grid Nutrisi */
.nutrition-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  padding: 10px;
  background: #f8fafc;
  border-radius: 12px;
  border: 1px solid #f1f5f9;
}

.stat-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.stat-label {
  font-size: 0.55rem;
  font-weight: 700;
  color: #94a3b8;
  margin-bottom: 2px;
}

.stat-value {
  font-size: 0.85rem;
  font-weight: 800;
  color: #334155;
}

.recipe-badge {
  position: absolute; top: 10px; right: 10px; 
  background: #22c55e; color: white; padding: 4px 12px;
  border-radius: 20px; font-size: 0.6rem; font-weight: 800; z-index: 2;
}

/* LOADER */
.loader-box { text-align: center; padding: 100px 0; color: #1c4d8d; font-weight: 700; }
.spinner { 
  width: 40px; height: 40px; border: 4px solid #f3f3f3; border-top: 4px solid #1c4d8d; 
  border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 15px;
}

.mt-15 { margin-top: 15px; }

.form-group label {
  display: block;
  font-size: 0.85rem;
  font-weight: 700;
  color: #475569;
  margin-bottom: 5px;
}

.input-with-unit {
  position: relative;
  display: flex;
  align-items: center;
}

.modal-input {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  font-weight: 700;
  outline: none;
}

.modal-input:focus {
  border-color: #1c4d8d;
}

.unit {
  position: absolute;
  right: 15px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #94a3b8;
}

.hint {
  font-size: 0.7rem;
  color: #94a3b8;
  font-style: italic;
}

/* Container utama modal */
.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex; 
  align-items: center; /* Posisi di tengah layar */
  justify-content: center;
  z-index: 2000;
  backdrop-filter: blur(4px);
  padding: 20px; /* Jarak aman untuk layar kecil */
}

/* Card modal dengan ukuran tetap */
.modal-card {
  background: white;
  width: 100%;
  max-width: 550px; /* Lebar konsisten */
  max-height: 90vh; /* Tinggi maksimal 90% dari tinggi layar */
  border-radius: 24px;
  display: flex;
  flex-direction: column; /* Memisahkan header, body, dan footer */
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
  overflow: hidden; /* Mencegah konten keluar dari rounded corner */
}

/* Header modal (Tetap/Sticky) */
.modal-header {
  padding: 20px 25px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: white;
}

/* Body modal (Bisa di-scroll) */
.modal-body {
  padding: 25px;
  overflow-y: auto; /* Munculkan scrollbar jika konten kepanjangan */
  flex: 1; /* Mengambil sisa ruang yang tersedia */
  scrollbar-width: thin; /* Untuk Firefox */
  scrollbar-color: #cbd5e1 transparent;
}

/* Kustomisasi scrollbar untuk Chrome/Edge/Safari */
.modal-body::-webkit-scrollbar {
  width: 6px;
}
.modal-body::-webkit-scrollbar-thumb {
  background-color: #cbd5e1;
  border-radius: 10px;
}

.modal-select {
  width: 100%;
  padding: 12px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  margin-top: 10px;
  font-weight: 600;
}

/* Footer modal (Tetap/Sticky) */
.modal-footer {
  padding: 20px 25px;
  border-top: 1px solid #f1f5f9;
  display: flex;
  gap: 12px;
  background: #f8fafc;
}

.menu-preview {
  background: #f0f9ff;
  padding: 15px;
  border-radius: 12px;
  margin-bottom: 20px;
  border: 1px solid #bae6fd;
}

/* Style untuk Tombol Video di Modal */
.video-action-box {
  display: flex;
  justify-content: center;
  padding-top: 10px;
  border-top: 1px dashed #bae6fd;
}

.btn-video {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f43f5e; /* Warna merah agar kontras dengan tema biru */
  color: white;
  text-decoration: none;
  padding: 10px 20px;
  border-radius: 12px;
  font-weight: 700;
  font-size: 0.85rem;
  transition: all 0.3s ease;
  box-shadow: 0 4px 10px rgba(244, 63, 94, 0.2);
}

.btn-video:hover {
  background: #e11d48;
  transform: translateY(-2px);
  box-shadow: 0 6px 15px rgba(244, 63, 94, 0.3);
}

.video-icon {
  font-size: 1.2rem;
}

/* Memastikan spasi antar elemen di modal tetap rapi */
.mt-15 {
  margin-top: 15px;
}

.view-btn {
  width: 100%;
  padding: 12px;
  background: #1c4d8d;
  color: white;
  border: none;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s ease;
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 8px;
}

.view-btn:hover {
  background: #153a6b;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(28, 77, 141, 0.2);
}

.btn-icon {
  font-size: 1.1rem;
}

.btn-close {
  background: transparent;
  border: none;
  font-size: 1.5rem;
  color: #94a3b8;
  cursor: pointer;
  transition: color 0.2s;
}

.btn-confirm {
  flex: 1; background: #1c4d8d; color: white;
  border: none; padding: 12px; border-radius: 10px; font-weight: 700; cursor: pointer;
}

.btn-cancel {
  padding: 12px 20px; border-radius: 10px; border: 1px solid #e2e8f0; cursor: pointer;
}

.btn-back {
  background: #f1f5f9; border: none; width: 35px; height: 35px;
  border-radius: 8px; cursor: pointer; font-weight: 800; transition: 0.2s;
}
.btn-back:hover { background: #e2e8f0; }

@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
.animate-fade-in { animation: fadeIn 0.5s ease; }
</style>