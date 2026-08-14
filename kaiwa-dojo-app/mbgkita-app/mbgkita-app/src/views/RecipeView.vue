<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue'
import { useRouter } from 'vue-router'
import { apiCall } from '../services/api'
import Swal from 'sweetalert2'

const router = useRouter()
const isLoading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const imagePreview = ref('')

// Dropdown Options
const urtOptions = ref<string[]>([])
const ingredientOptions = ref<string[]>([])

const form = ref({
  menuID: `DRAFT-${Date.now()}`,
  userID: sessionStorage.getItem('userID') || '',
  menuName: '',
  menuDesc: '',
  menuImage: '',
  menuVideo: '',
  totalNutrition: '',
  targetAKG: [] as string[],
  procedure: [] as string[],
  status: 'Pending'
})

// Inisialisasi ingredientsList dengan field nutrisi lengkap
const ingredientsList = ref([
  { name: '', qty: '', unit: '', qty1000: '', unit1000: '', calories: 0, protein: 0, fat: 0, carb: 0, status: '' }
])
const procedureInput = ref('')

// --- LOGIKA KALKULASI GIZI ---
const grandTotalNutrition = computed(() => {
  return ingredientsList.value.reduce((acc, ing) => {
    acc.cal += Number(ing.calories || 0);
    acc.prot += Number(ing.protein || 0);
    acc.fat += Number(ing.fat || 0);
    acc.carb += Number(ing.carb || 0);
    return acc;
  }, { cal: 0, prot: 0, fat: 0, carb: 0 });
});

watch(grandTotalNutrition, (newVal) => {
  form.value.totalNutrition = `${Math.round(newVal.cal)} kcal | P: ${Math.round(newVal.prot)}g, L: ${Math.round(newVal.fat)}g, K: ${Math.round(newVal.carb)}g`;
});

const fetchRowNutrition = async (index: number) => {
  const ing = ingredientsList.value[index];
  if (!ing) return; // Fix: TypeScript Guard

  if (ing.name.length < 3 || !ing.qty || Number(ing.qty) <= 0) return;

  ing.status = '🔍';
  try {
    const res = await apiCall<any>('getNutrition', '', {
      query: ing.name,
      qty: ing.qty,
      unit: ing.unit
    });

    if (res && res.food && res.food.servings) {
      const data = res.food.servings.serving[0];
      ing.calories = data.calories;
      ing.protein = data.protein;
      ing.fat = data.fat;
      ing.carb = data.carbohydrate;
      ing.status = '✅';
    } else {
      ing.status = '⚠️';
    }
  } catch (e) {
    ing.status = '❌';
  }
};

// --- LOGIKA UTILITY & API ---
onMounted(async () => {
  await Promise.all([fetchURTOptions(), fetchIngredientOptions()])
})

const fetchURTOptions = async () => {
  const data = await apiCall<any[]>('readAll', 'URT Database')
  if (data) urtOptions.value = [...new Set(data.map((item: any) => item.URT_Name))]
}

const fetchIngredientOptions = async () => {
  const data = await apiCall<any[]>('readAll', 'Ingredients Database')
  if (data) ingredientOptions.value = [...new Set(data.map((item: any) => item.Ingredient_Name))]
}

const onProcedureKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter') {
    const target = e.target as HTMLTextAreaElement
    setTimeout(() => {
      const val = procedureInput.value
      const linesBeforeCursor = val.substring(0, target.selectionStart).split('\n')
      const lastLine = linesBeforeCursor[linesBeforeCursor.length - 2]
      if (lastLine) {
        const match = lastLine.match(/^(\d+)\./)
        if (match && match[1]) {
          const nextNum = parseInt(match[1], 10) + 1
          const insertText = `${nextNum}. `
          const start = target.selectionStart
          procedureInput.value = val.substring(0, start) + insertText + val.substring(target.selectionEnd)
          setTimeout(() => { target.selectionStart = target.selectionEnd = start + insertText.length }, 0)
        }
      }
    }, 10)
  }
}

const handleFileUpload = async (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  // 1. Validasi Ukuran (Opsional tapi disarankan)
  // Jika lebih dari 2MB, GAS sering timeout atau gagal proses base64 yang terlalu panjang
  if (file.size > 2 * 1024 * 1024) {
    Swal.fire('File Terlalu Besar', 'Gunakan foto di bawah 2MB agar upload lancar.', 'warning');
    return;
  }

  imagePreview.value = URL.createObjectURL(file);
  isLoading.value = true;

  const reader = new FileReader();
  reader.readAsDataURL(file);
  reader.onload = async () => {
    try {
      // Pastikan 'action' disertakan di dalam objek params
      const res = await apiCall<string>('uploadImage', '', {
        action: 'uploadImage', // PENTING: Agar doPost GAS mengenali aksinya
        base64Data: reader.result as string,
        fileName: `IMG_${form.value.menuID}_${Date.now()}.png`
      });

      if (res && !res.includes('Error')) {
        form.value.menuImage = res;
        console.log("Upload berhasil, URL:", res);
      } else {
        throw new Error(res || "Respons server tidak valid");
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      Swal.fire('Gagal Upload', 'Terjadi kesalahan saat mengirim gambar ke Drive.', 'error');
    } finally {
      isLoading.value = false;
    }
  };
};

const handleSave = async () => {
  if (!form.value.menuName) return Swal.fire('Oops', 'Nama menu harus diisi', 'warning')
  isLoading.value = true
  const lines = procedureInput.value.split('\n')
  form.value.procedure = lines.map(l => l.replace(/^\d+\.\s*/, '').trim()).filter(s => s !== '')
  
  const payload = {
    ...form.value,
    ingredients: ingredientsList.value.map(i => ({ name: i.name, qty: i.qty, unit: i.unit })),
    ingredients1000: ingredientsList.value.map(i => ({ name: i.name, qty: i.qty1000, unit: i.unit1000 }))
  }

  try {
    const res = await apiCall('addMenu', 'Menu Databases', payload)
    if (res === "Success") {
      await Swal.fire('Berhasil!', 'Resep telah diajukan.', 'success')
      router.push('/my-recipes')
    }
  } finally { isLoading.value = false }
}
</script>

<template>
  <div class="editor-page animate-fade-in">
    <header class="editor-top-bar">
      <div class="header-left">
        <button class="btn-circle-back" @click="router.back()">←</button>
        <div>
          <h1 class="title-white">Ajukan Resep Baru</h1>
          <p class="subtitle">Draft ID: {{ form.menuID }}</p>
        </div>
      </div>
      <button class="btn-save-main" @click="handleSave" :disabled="isLoading">
        {{ isLoading ? 'Memproses...' : '🚀 Ajukan Resep' }}
      </button>
    </header>

    <div class="editor-content-grid">
      <div class="side-panel">
        <div class="card editor-card">
          <h3 class="card-title">📸 Foto Masakan</h3>
          <div class="image-upload-zone" @click="fileInput?.click()">
            <img v-if="imagePreview || form.menuImage" :src="imagePreview || form.menuImage" class="preview-img" />
            <div v-else class="upload-placeholder"><span>➕ Upload Foto</span></div>
            <input type="file" ref="fileInput" hidden @change="handleFileUpload" accept="image/*">
          </div>
        </div>

        <div class="card editor-card mt-20">
          <h3 class="card-title">🎥 Video Tutorial</h3>
          <div class="input-group">
            <input v-model="form.menuVideo" type="text" class="form-input" placeholder="URL YouTube (Opsional)">
          </div>
        </div>

        <div class="card editor-card mt-20">
          <h3 class="card-title">📍 Letak pada Nampan</h3>
          <div class="tray-visual-editor">
            <div v-for="s in ['1','2','3','4','5']" :key="s" 
                 class="tray-slot" :class="{ 'active': form.targetAKG.includes(s) }"
                 @click="form.targetAKG.includes(s) ? form.targetAKG = form.targetAKG.filter(i => i!==s) : form.targetAKG.push(s)" :data-slot="s">
              <span class="slot-label">Slot {{ s }}</span>
              <span class="slot-status">{{ form.targetAKG.includes(s) ? 'TERISI' : 'KOSONG' }}</span>
            </div>
          </div>
        </div>

    
      </div>

      <div class="main-panel">
        <div class="card editor-card">
          <h3 class="card-title">📝 Deskripsi & Prosedur</h3>
          <div class="input-group">
            <label class="field-label">Nama Menu</label>
            <input v-model="form.menuName" type="text" class="form-input" placeholder="Masukkan nama masakan...">
          </div>

          <div class="input-grid-2 mt-15">
            <div class="input-group">
              <label class="field-label">Deskripsi Singkat</label>
              <textarea v-model="form.menuDesc" class="form-input" rows="2" placeholder="Ceritakan sedikit tentang menu ini..."></textarea>
            </div>
            <div class="input-group">
              <label class="field-label">Ringkasan Gizi (Auto)</label>
              <input v-model="form.totalNutrition" type="text" class="form-input highlight-input" readonly>
            </div>
          </div>
          
          <div class="input-group mt-15">
            <label class="field-label">Langkah-langkah Memasak</label>
            <textarea v-model="procedureInput" @keydown="onProcedureKeydown" class="form-input procedure-area" placeholder="1. Masukkan langkah pertama..."></textarea>
          </div>
        </div>

        <div class="card editor-card mt-20">
          <div class="header-with-btn">
            <h3 class="card-title">🥗 Bahan Baku & Estimasi Gizi</h3>
            <button class="btn-add-ing" @click="ingredientsList.push({name:'',qty:'',unit:'',qty1000:'',unit1000:'',calories:0,protein:0,fat:0,carb:0,status:''})">
              <span class="icon">+</span> Tambah Baris
            </button>
          </div>
          
          <div class="table-container">
            <table class="ing-table">
              <thead>
                <tr>
                  <th rowspan="2">Nama Bahan</th>
                  <th colspan="2" class="th-blue">Porsi Normal</th>
                  <th colspan="2" class="th-orange">Estimasi 1000</th>
                  <th rowspan="2"></th>
                </tr>
                <tr>
                  <th class="th-blue-sub">Qty</th><th class="th-blue-sub">Unit</th>
                  <th class="th-orange-sub">Qty</th><th class="th-orange-sub">Unit</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(ing, idx) in ingredientsList" :key="idx">
                  <td class="td-name">
                    <input v-model="ing.name" list="ingredients-list" class="cell-input" @change="fetchRowNutrition(idx)" placeholder="Cari bahan...">
                    <div class="row-nutrition-hint" v-if="ing.calories">
                      🔥 {{ Math.round(ing.calories) }} kcal | P: {{ ing.protein }}g
                    </div>
                  </td>
                  <td><input v-model="ing.qty" class="cell-input text-center" @input="fetchRowNutrition(idx)" placeholder="0"></td>
                  <td><input v-model="ing.unit" list="urt-list" class="cell-input text-center" @change="fetchRowNutrition(idx)" placeholder="Unit"></td>
                  <td><input v-model="ing.qty1000" class="cell-input text-center" placeholder="0"></td>
                  <td><input v-model="ing.unit1000" list="urt-list" class="cell-input text-center" placeholder="Unit"></td>
                  <td class="text-center">
                    <div class="action-cell">
                      <span class="status-indicator">{{ ing.status }}</span>
                      <button @click="ingredientsList.splice(idx, 1)" class="btn-row-del">×</button>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div class="nutrition-summary-bar">
            <div class="summary-item">
              <span class="label">Total Energi</span>
              <span class="value">{{ Math.round(grandTotalNutrition.cal) }} <small>kcal</small></span>
            </div>
            <div class="summary-item">
              <span class="label">Protein</span>
              <span class="value">{{ Math.round(grandTotalNutrition.prot) }}g</span>
            </div>
            <div class="summary-item">
              <span class="label">Lemak</span>
              <span class="value">{{ Math.round(grandTotalNutrition.fat) }}g</span>
            </div>
            <div class="summary-item">
              <span class="label">Karbohidrat</span>
              <span class="value">{{ Math.round(grandTotalNutrition.carb) }}g</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <datalist id="ingredients-list"><option v-for="n in ingredientOptions" :key="n" :value="n" /></datalist>
    <datalist id="urt-list"><option v-for="u in urtOptions" :key="u" :value="u" /></datalist>
  </div>
</template>

<style scoped>
.editor-page { padding: 20px; background: #f8fafc; min-height: 100vh; margin-top: 80px; }

/* Header */
.editor-top-bar { 
  display: flex; justify-content: space-between; align-items: center; 
  background: #1c4d8d; padding: 15px 30px; border-radius: 20px; 
  box-shadow: 0 8px 30px rgba(28, 77, 141, 0.15); margin-bottom: 25px;
  position: sticky; top: 80px; z-index: 90;
}
.title-white { color: white; font-weight: 800; font-size: 1.4rem; margin: 0; }
.subtitle { font-size: 0.85rem; color: rgba(255,255,255,0.7); margin: 4px 0 0 0; }

/* Grid Layout */
.editor-content-grid { display: grid; grid-template-columns: 350px 1fr; gap: 24px; }
.card { background: white; padding: 24px; border-radius: 24px; border: 1px solid #e2e8f0; transition: transform 0.2s; }
.card-title { font-size: 1rem; font-weight: 800; color: #1e293b; margin-bottom: 18px; display: flex; align-items: center; gap: 8px; }

/* Inputs */
.field-label { font-size: 0.8rem; font-weight: 700; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; }
.form-input { 
  width: 100%; padding: 12px 16px; border: 1px solid #cbd5e1; border-radius: 12px; 
  font-size: 0.95rem; margin-top: 6px; background: #fcfdfe; transition: 0.2s;
}
.form-input:focus { border-color: #1c4d8d; box-shadow: 0 0 0 4px rgba(28, 77, 141, 0.1); outline: none; }
.highlight-input { background: #f0f9ff; color: #0369a1; font-weight: 700; border-color: #bae6fd; }
.procedure-area { min-height: 200px; line-height: 1.7; resize: vertical; }
.input-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }

/* Table Professional Look */
.table-container { overflow-x: auto; margin-top: 10px; border-radius: 12px; border: 1px solid #e2e8f0; }
.ing-table { width: 100%; border-collapse: collapse; min-width: 600px; }
.ing-table th { font-size: 0.7rem; font-weight: 800; text-transform: uppercase; padding: 12px; letter-spacing: 0.5px; }
.th-blue { background: #eff6ff; color: #1e40af; border-bottom: 1px solid #dbeafe; }
.th-blue-sub { background: #f8faff; color: #1e40af; font-size: 0.65rem; border: 1px solid #eff6ff; }
.th-orange { background: #fff7ed; color: #9a3412; border-bottom: 1px solid #ffedd5; }
.th-orange-sub { background: #fffcf9; color: #9a3412; font-size: 0.65rem; border: 1px solid #fff7ed; }

.td-name { min-width: 200px; position: relative; }
.cell-input { width: 100%; border: none; padding: 12px; font-weight: 600; background: transparent; transition: 0.2s; font-size: 0.9rem; }
.cell-input:focus { background: #f1f5f9; outline: none; }
.text-center { text-align: center; }

/* Nutrition Hints */
.row-nutrition-hint { font-size: 0.65rem; color: #10b981; font-weight: 800; padding: 0 12px 8px; margin-top: -5px; }
.nutrition-summary-bar {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
  margin-top: 20px; padding: 20px; background: #1e293b; border-radius: 16px; color: white;
}
.summary-item .label { font-size: 0.65rem; font-weight: 600; opacity: 0.6; text-transform: uppercase; display: block; margin-bottom: 4px; }
.summary-item .value { font-size: 1.2rem; font-weight: 800; }

/* Buttons & Elements */
.btn-save-main { background: #ffffff; color: #1c4d8d; border: none; padding: 12px 28px; border-radius: 14px; font-weight: 800; cursor: pointer; transition: 0.3s; }
.btn-save-main:hover { transform: translateY(-2px); box-shadow: 0 5px 15px rgba(0,0,0,0.1); }
.btn-circle-back { background: rgba(255,255,255,0.1); color: white; border: none; width: 40px; height: 40px; border-radius: 50%; cursor: pointer; margin-right: 15px; font-size: 1.2rem; }
.btn-add-ing { background: #1c4d8d; color: white; border: none; padding: 8px 16px; border-radius: 10px; font-weight: 700; cursor: pointer; font-size: 0.8rem; }
.btn-row-del { color: #ef4444; background: #fee2e2; border: none; width: 28px; height: 28px; border-radius: 8px; cursor: pointer; }

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

.image-upload-zone { width: 100%; height: 200px; background: #f1f5f9; border: 2px dashed #cbd5e1; border-radius: 16px; cursor: pointer; display: flex; align-items: center; justify-content: center; overflow: hidden; }
.preview-img { width: 100%; height: 100%; object-fit: cover; }
.action-cell { display: flex; align-items: center; justify-content: center; gap: 8px; }
</style>