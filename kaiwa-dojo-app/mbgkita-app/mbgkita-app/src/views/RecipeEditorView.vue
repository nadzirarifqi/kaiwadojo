<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { apiCall } from '../services/api'
import Swal from 'sweetalert2'

const route = useRoute()
const router = useRouter()
const isLoading = ref(false)
const isEditMode = ref(false)
const imagePreview = ref('')
const fileInput = ref<HTMLInputElement | null>(null) // Ref untuk input file
const urtOptions = ref<string[]>([])
const ingredientOptions = ref<string[]>([])


const form = ref({
  menuID: `MENU-${Date.now()}`,
  userID: sessionStorage.getItem('userID') || '',
  menuName: '',
  menuDesc: '',
  menuImage: '',
  menuVideo: '',
  totalNutrition: '',
  targetAKG: [] as string[], 
  procedure: [] as string[]  
})

const ingredientsList = ref([{ name: '', qty: '', unit: '', qty1000: '', unit1000: '' }])

onMounted(async () => {
  const editID = route.query.edit as string | undefined // Handling undefined
  if (editID) {
    isEditMode.value = true
    await loadRecipeData(editID) // Sekarang editID pasti string
  }

  await Promise.all([
    fetchURTOptions(),
    fetchIngredientOptions()
  ])
})


// --- FIX: loadRecipeData must be defined ---
const loadRecipeData = async (id: string) => {
  isLoading.value = true
  try {
    const [menuData, ingData] = await Promise.all([
      apiCall<any[]>('readAll', 'Menu Databases'),
      apiCall<any[]>('readAll', 'Menu Ingredients')
    ])

    const recipe = menuData?.find(m => String(m.MenuID || m.menuID) === String(id))
    if (recipe) {
      form.value = {
        menuID: recipe.MenuID || recipe.menuID,
        userID: recipe.UserID || recipe.userID,
        menuName: recipe.Menu_Name || '',
        menuDesc: recipe.Menu_Description || '',
        menuImage: recipe.Menu_Image || '',
        menuVideo: recipe.Menu_Video || '',
        totalNutrition: recipe.Total_Nutrition || '',
        targetAKG: JSON.parse(recipe.targetAKG || '[]'),
        procedure: JSON.parse(recipe.Menu_Procedure || '[]')
      }
      
      const ingRow = ingData?.find(i => String(i.MenuID) === String(id))
      if (ingRow) {
        const normal = JSON.parse(ingRow.Ingredients_JSON || '[]')
        const masal = JSON.parse(ingRow.Ingredients_1000_JSON || '[]')
        ingredientsList.value = normal.map((item: any, idx: number) => ({
          name: item.name,
          qty: item.qty,
          unit: item.unit,
          qty1000: masal[idx]?.qty || '',
          unit1000: masal[idx]?.unit || item.unit
        }))
      }
    }
  } finally { isLoading.value = false }
}
// Fungsi ambil data Nama Bahan
const fetchIngredientOptions = async () => {
  try {
    const data = await apiCall<any[]>('readAll', 'Ingredients Database')
    if (data && Array.isArray(data)) {
      // Ambil hanya Ingredient_Name dan hilangkan duplikat
      ingredientOptions.value = [...new Set(data.map(item => item.Ingredient_Name))]
    }
  } catch (error) {
    console.error("Gagal mengambil data Ingredients Database:", error)
  }
}

const fetchURTOptions = async () => {
  try {
    const data = await apiCall<any[]>('readAll', 'URT Database')
    if (data && Array.isArray(data)) {
      // Ambil hanya URT_Name dan hilangkan duplikat jika ada
      urtOptions.value = [...new Set(data.map(item => item.URT_Name))]
    }
  } catch (error) {
    console.error("Gagal mengambil data URT:", error)
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  
  imagePreview.value = URL.createObjectURL(file)

  const reader = new FileReader()
  reader.readAsDataURL(file)
  reader.onload = async () => {
    isLoading.value = true
    try {
      const res = await apiCall<string>('uploadImage', '', {
        base64Data: reader.result as string,
        fileName: `IMG_${form.value.menuID}.png`
      })
      if (res && !res.includes('Error')) {
        form.value.menuImage = res
      }
    } finally { isLoading.value = false }
  }
}

// --- FIX: Logic Prosedur & undefined lastLine ---
const procedureInput = ref('')

watch(() => form.value.procedure, (newVal) => {
  if (newVal.length > 0 && procedureInput.value === '') {
    procedureInput.value = newVal.map((step, i) => `${i + 1}. ${step}`).join('\n')
  }
}, { immediate: true })

const onProcedureKeydown = (e: KeyboardEvent) => {
  // Hanya jalankan jika tombol yang ditekan adalah Enter
  if (e.key === 'Enter') {
    // Kita gunakan target dari event untuk mendapatkan posisi kursor
    const target = e.target as HTMLTextAreaElement;
    
    setTimeout(() => {
      const lines = procedureInput.value.split('\n');
      if (lines.length < 2) return;

      // Mencari baris sebelum kursor saat ini
      // Kita ambil baris tepat sebelum baris baru yang baru saja dibuat oleh 'Enter'
      const lastLineIndex = procedureInput.value.substr(0, target.selectionStart).split('\n').length - 2;
      const lastLine = lines[lastLineIndex];

      if (!lastLine) return;

      const match = lastLine.match(/^(\d+)\./);
      if (match && match[1]) {
        const nextNum = parseInt(match[1], 10) + 1;
        const insertText = `${nextNum}. `;
        
        // Ambil posisi kursor saat ini
        const start = target.selectionStart;
        const end = target.selectionEnd;

        // Sisipkan nomor otomatis tepat di posisi kursor
        procedureInput.value = 
          procedureInput.value.substring(0, start) + 
          insertText + 
          procedureInput.value.substring(end);

        // Kembalikan posisi kursor ke setelah nomor yang baru disisipkan
        setTimeout(() => {
          target.selectionStart = target.selectionEnd = start + insertText.length;
        }, 0);
      }
    }, 10);
  }
};

const toggleSlot = (s: string) => {
  if (form.value.targetAKG.includes(s)) {
    form.value.targetAKG = form.value.targetAKG.filter(item => item !== s)
  } else {
    form.value.targetAKG.push(s)
  }
}

const handleSave = async () => {
  // 1. Validasi minimal
  if (!form.value.menuName) {
    return Swal.fire('Error', 'Nama Menu wajib diisi!', 'error');
  }

  // 2. Sinkronisasi Prosedur (Konversi dari String area ke Array)
  const lines = procedureInput.value.split('\n');
  const procedureArray = lines
    .map(line => line.replace(/^\d+\.\s*/, '').trim())
    .filter(s => s !== '');

  isLoading.value = true;
  
  // 3. Tentukan Action (Sesuai Router GAS kamu: "updateMenu" atau "addMenu")
  const action = isEditMode.value ? 'updateMenu' : 'addMenu';
  
  // 4. Konstruksi Payload (HARUS PERSIS dengan ekspektasi GAS data.xxx)
  const payload = {
    action: action, // Pastikan action terkirim di dalam body jika menggunakan POST
    menuID: form.value.menuID,
    userID: form.value.userID,
    menuName: form.value.menuName,
    menuDesc: form.value.menuDesc,
    menuImage: form.value.menuImage,
    menuVideo: form.value.menuVideo,
    totalNutrition: form.value.totalNutrition,
    targetAKG: form.value.targetAKG, // Dikirim sebagai Array, GAS akan men-stringify
    procedure: procedureArray,       // Dikirim sebagai Array, GAS akan men-stringify
    // Bahan baku dikirim dalam format objek yang akan di-stringified di GAS
    ingredients: ingredientsList.value.map(i => ({ 
      name: i.name, 
      qty: i.qty, 
      unit: i.unit 
    })),
    ingredients1000: ingredientsList.value.map(i => ({ 
      name: i.name, 
      qty: i.qty1000, 
      unit: i.unit1000 
    }))
  };

  try {
    // Panggil API dengan Method POST (sesuai handleUpdateMenu GAS)
    const res = await apiCall(action, 'Menu Databases', payload);
    
    // GAS kamu mengembalikan "Success" (teks murni)
    if (res === "Success" || (res as any).status === "Success") {
      await Swal.fire({
        title: 'Berhasil!',
        text: isEditMode.value ? 'Resep berhasil diperbarui.' : 'Resep berhasil ditambahkan.',
        icon: 'success',
        timer: 1500,
        showConfirmButton: false
      });
      
      // Langsung pindah ke halaman My Recipes
      router.push('/my-recipes');
    } else {
      throw new Error(res as string);
    }
  } catch (error) {
    console.error("Save Error:", error);
    Swal.fire('Gagal!', 'Terjadi kesalahan saat menyimpan: ' + error, 'error');
  } finally {
    isLoading.value = false;
  }
};
</script>

<template>
  <div class="editor-page animate-fade-in">
    <header class="editor-top-bar">
      <div class="header-left">
        <button class="btn-circle-back" @click="router.back()">←</button>
        <div>
          <h1>{{ isEditMode ? 'Edit Resep' : 'Buat Resep Baru' }}</h1>
          <p class="subtitle">ID: {{ form.menuID }}</p>
        </div>
      </div>
      <button class="btn-save-main" @click="handleSave" :disabled="isLoading">
        {{ isLoading ? 'Memproses...' : '💾 Simpan Perubahan' }}
      </button>
    </header>

    <div class="editor-content-grid">
      <div class="side-panel">
        <div class="card editor-card">
        <h3 class="card-title">📸 Foto Masakan</h3>
        <div class="image-upload-zone" @click="fileInput?.click()">
            <img v-if="imagePreview || form.menuImage" :src="imagePreview || form.menuImage" class="preview-img" />
            <div v-else class="upload-placeholder">
            <span>➕ Klik untuk Upload</span>
            </div>
            <input type="file" ref="fileInput" hidden @change="handleFileUpload" accept="image/*">
        </div>
        </div>
        <div class="card">
        <h3 class="card-title">🎯 Link Youtube</h3>
          <div class="input-group">
              <input v-model="form.menuVideo" type="text" class="form-input" placeholder="Masukkan URL video YouTube...">
          </div>
        </div>
        <div class="card editor-card mt-20">
          <h3 class="card-title">📍 Letak pada Nampan</h3>
          <div class="tray-visual-editor">
            <div v-for="s in ['1','2','3','4','5']" :key="s" 
                 class="tray-slot" :class="{ 'active': form.targetAKG.includes(s) }"
                 @click="toggleSlot(s)" :data-slot="s">
              <span class="slot-label">Slot {{ s }}</span>
              <span class="slot-status">{{ form.targetAKG.includes(s) ? 'TERISI' : 'KOSONG' }}</span>
            </div>
          </div>
        </div>


      </div>

      <div class="main-panel">
        <div class="card editor-card">
          <h3 class="card-title">📝 Identitas & Prosedur</h3>
          <div class="input-group">
            <label>Nama Menu</label>
            <input v-model="form.menuName" type="text" class="form-input" placeholder="Masukkan nama menu...">
          </div>
          
          <div class="input-grid mt-15">
            <div class="input-group">
              <label>Deskripsi Menu</label>
              <textarea v-model="form.menuDesc" class="form-input" rows="2"></textarea>
            </div>
            <div class="input-group">
              <label>Total Nutrisi</label>
              <input v-model="form.totalNutrition" type="text" class="form-input" placeholder="Contoh: 500 kcal">
            </div>
          </div>

          <div class="input-group mt-15">
            <label>Prosedur Memasak</label>
            <textarea v-model="procedureInput" @keydown="onProcedureKeydown" 
                      class="form-input procedure-area" 
                      placeholder="1. Mulai mengetik baris pertama..."></textarea>
            <p class="hint">Tekan <b>Enter</b> untuk membuat langkah baru secara otomatis.</p>
          </div>
        </div>

        <div class="card editor-card mt-20">
            <div class="header-with-btn">
                <h3 class="card-title">🥗 Manajemen Bahan Baku</h3>
                
                <button class="btn-add-ing" @click="ingredientsList.push({name:'',qty:'',unit:'',qty1000:'',unit1000:''})">
                <span class="icon">+</span>
                <span class="text">Tambah Bahan</span>
                </button>
            </div>

            <div class="table-container">
                <table class="ing-table">
                    <thead>
                    <tr>
                        <th rowspan="2">Nama Bahan</th>
                        <th colspan="2" class="th-blue">Porsi Normal</th>
                        <th colspan="2" class="th-orange">Porsi 1000</th>
                        <th rowspan="2">Aksi</th>
                    </tr>
                    <tr>
                        <th>Qty</th><th>Unit</th>
                        <th>Qty</th><th>Unit</th>
                    </tr>
                    </thead>
                    <tbody>
                    <tr v-for="(ing, idx) in ingredientsList" :key="idx">
                        <td>
                        <input 
                            v-model="ing.name" 
                            list="ingredients-list" 
                            class="cell-input" 
                            placeholder="Ketik nama bahan..."
                        >
                        </td>

                        <td><input v-model="ing.qty" class="cell-input text-center" placeholder="0"></td>
                        <td>
                        <input v-model="ing.unit" list="urt-list" class="cell-input text-center" placeholder="Unit...">
                        </td>

                        <td><input v-model="ing.qty1000" class="cell-input text-center" placeholder="0"></td>
                        <td>
                        <input v-model="ing.unit1000" list="urt-list" class="cell-input text-center" placeholder="Unit...">
                        </td>

                        <td class="text-center">
                        <button @click="ingredientsList.splice(idx, 1)" class="btn-row-del">×</button>
                        </td>
                    </tr>
                    </tbody>
                </table>

                <datalist id="ingredients-list">
                    <option v-for="name in ingredientOptions" :key="name" :value="name" />
                </datalist>

                <datalist id="urt-list">
                    <option v-for="opt in urtOptions" :key="opt" :value="opt" />
                </datalist>
            </div>
        </div>  
      </div>
    </div>
  </div>
</template>

<style scoped>
h1 { color: white; }
.editor-page { padding: 20px; background: #f8fafc; min-height: 100vh;}
.editor-top-bar { display: flex; justify-content: space-between; align-items: center; background: #1c4d8d;; padding: 15px 30px; border-radius: 20px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); margin-bottom: 25px; /* Atur sticky agar berada di bawah Header Utama Aplikasi */
  position: sticky; 
  top: 80px; /* Sesuaikan dengan tinggi Header Utama kamu */
  z-index: 90; /* Pastikan di bawah Z-Index Header Utama (biasanya 100+) */ }
.editor-content-grid { display: grid; grid-template-columns: 350px 1fr; gap: 20px; }
.subtitle { font-size: 0.8rem; color: #cbd5e1; margin-top: 4px; }

/* Image Upload Zone */
.image-upload-zone { width: 100%; height: 220px; border: 2px dad #cbd5e1; border-radius: 18px; overflow: hidden; cursor: pointer; display: flex; align-items: center; justify-content: center; background: #f1f5f9; transition: 0.3s; }
.image-upload-zone:hover { border-color: #1c4d8d; }
.preview-img { width: 100%; height: 100%; object-fit: cover; }
.upload-placeholder { font-weight: 800; color: #64748b; }

/* Visual Tray Layout */
.tray-visual-editor { display: grid; grid-template-areas: "s1 s2 s2 s3" "s4 s4 s4 s5"; gap: 10px; height: 180px; background: #f1f5f9; padding: 12px; border-radius: 15px; }
.tray-slot { background: white; border: 2px dashed #cbd5e1; border-radius: 10px; cursor: pointer; display: flex; flex-direction: column; align-items: center; justify-content: center; transition: 0.2s; }
.tray-slot.active { background: #1c4d8d; color: white; border-style: solid; border-color: #0f2a4d; }
.tray-slot[data-slot="1"] { grid-area: s1; }
.tray-slot[data-slot="2"] { grid-area: s2; }
.tray-slot[data-slot="3"] { grid-area: s3; }
.tray-slot[data-slot="4"] { grid-area: s4; }
.tray-slot[data-slot="5"] { grid-area: s5; border-radius: 50%; }
.slot-label { font-size: 0.6rem; font-weight: 800; opacity: 0.8; }
.slot-status { font-size: 0.5rem; font-weight: 900; }

.card { background: white; padding: 25px; border-radius: 20px; border: 1px solid #e2e8f0; }
.card-title { font-size: 1.1rem; font-weight: 800; color: #1c4d8d; margin-bottom: 20px; }
.form-input { width: 100%; padding: 12px; border: 1px solid #cbd5e1; border-radius: 12px; font-size: 0.9rem; margin-top: 5px; }
.procedure-area { min-height: 250px; line-height: 1.8; white-space: pre-wrap; }

/* Table Styling */
/* Container Header agar Judul dan Tombol Sejajar */
.header-with-btn {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.ing-table { width: 100%; border-collapse: collapse; }
.ing-table th { font-size: 0.7rem; padding: 10px; border: 1px solid #e2e8f0; }
.th-blue { background: #eff6ff; color: #1e40af; }
.th-orange { background: #fff7ed; color: #9a3412; }

/* Menghilangkan tanda panah bawaan beberapa browser jika dirasa mengganggu, 
   tapi membiarkannya tetap ada biasanya lebih user-friendly */
.cell-input[list]::-webkit-calendar-picker-indicator {
  display: block;
  opacity: 0.4;
  cursor: pointer;
  transition: 0.2s;
}

.cell-input[list]::-webkit-calendar-picker-indicator:hover {
  opacity: 1;
}

/* Memastikan teks di tengah tetap rapi */
.cell-input.text-center {
  text-align: center;
  padding-right: 20px; /* Memberi ruang untuk icon datalist */
}

.cell-input { width: 100%; border: none; padding: 10px; font-weight: 600; text-align: inherit; }
.btn-save-main { background: white; color: #1c4d8d; border: none; padding: 12px 30px; border-radius: 12px; font-weight: 800; cursor: pointer; }
.btn-save-main:hover { background: #f1f5f9; }
.btn-circle-back { background: white; color: #1c4d8d; border: none; width: 36px; height: 36px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; }
/* --- TOMBOL TAMBAH BAHAN (PRIMARY-SOFT) --- */
.btn-add-ing {
  display: flex;
  align-items: center;
  gap: 8px;
  background-color: #f1f5f9;
  color: #1c4d8d;
  border: 1px solid #e2e8f0;
  padding: 8px 16px;
  border-radius: 10px;
  font-weight: 700;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  cursor: pointer;
  transition: all 0.2s ease;
}
.btn-add-ing:hover {
  background-color: #e0f2fe;
  border-color: #bae6fd;
  transform: translateY(-1px);
  box-shadow: 0 4px 6px rgba(28, 77, 141, 0.08);
}

.btn-add-ing .icon {
  font-size: 1.1rem;
  line-height: 1;
}

/* --- TOMBOL HAPUS BARIS (DANGER-SOFT) --- */
.btn-row-del {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #fef2f2;
  color: #ef4444;
  border: 1px solid #fee2e2;
  border-radius: 6px;
  font-size: 1.2rem;
  font-weight: 400;
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0 auto;
}

.btn-row-del:hover {
  background-color: #ef4444;
  color: white;
  border-color: #ef4444;
  transform: scale(1.1);
}

/* Menambahkan indikator dropdown yang halus pada input list */
.cell-input[list]::-webkit-calendar-picker-indicator {
  display: block;
  opacity: 0.3;
  transition: 0.3s;
}

.cell-input[list]:focus::-webkit-calendar-picker-indicator {
  opacity: 0.8;
  color: #1c4d8d;
}

/* Memastikan baris input terlihat bersih */
.cell-input {
  width: 100%;
  border: 1px solid transparent;
  padding: 10px;
  background: transparent;
  font-weight: 600;
  border-radius: 8px;
}

.cell-input:hover {
  background: #f1f5f9;
}
.cell-input.text-center {
  text-align: center;
}
</style>