<template>
  <div class="planner-page animate-fade-in">
    <header class="top-header">
      <div class="header-titles">
        <h1>📅 Schedule</h1>
        <p>Manajemen perencanaan porsi dan anggaran harian MBGKita.</p>
      </div>
    </header>

    <section class="planner-container">
      <div class="calendar-double-wrapper">
        <div class="calendar-card card">
          <div class="calendar-controls">
            <button class="back-btn" @click="changeMonth(-1)">←</button>
            <h3 id="monthYearLeft">{{ monthNames[currentMonth] }} {{ currentYear }}</h3>
            <span></span>
          </div>
          <div class="calendar-grid-header">
            <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
          </div>
          <div class="calendar-days-grid">
            <div 
              v-for="day in calendarLeft" 
              :key="day.date"
              class="day-cell" 
              :class="[day.type, { 'active': selectedDate === day.date, 'today': isToday(day.date) }]"
              :data-date="day.date"
              @click="day.type === 'current' && handleSelectDate(day)"
            >
              <span class="day-number">{{ day.dayNum }}</span>
              <div v-if="calendarStatus[day.date]" class="status-dot" :class="calendarStatus[day.date] || 'pending'.toLowerCase()"></div>
            </div>  
          </div>
        </div>

        <div class="calendar-card card">
          <div class="calendar-controls">
            <span></span>
            <h3 id="monthYearRight">{{ monthNames[nextMonthInfo.m] }} {{ nextMonthInfo.y }}</h3>
            <button class="back-btn" @click="changeMonth(1)">→</button>
          </div>
          <div class="calendar-grid-header">
            <span>Mo</span><span>Tu</span><span>We</span><span>Th</span><span>Fr</span><span>Sa</span><span>Su</span>
          </div>
          <div class="calendar-days-grid">
            <div 
              v-for="day in calendarRight" 
              :key="day.date"
              class="day-cell" 
              :class="[day.type, { 'active': selectedDate === day.date, 'today': isToday(day.date) }]"
              :data-date="day.date"
              @click="day.type === 'current' && handleSelectDate(day)"
            >
              <span class="day-number">{{ day.dayNum }}</span>
              <div v-if="calendarStatus[day.date]" class="status-dot" :class="calendarStatus[day.date] || 'pending'.toLowerCase()"></div>
            </div>
          </div>
        </div>
      </div>

      <div class="schedule-detail card" v-if="selectedDate">
      <div class="detail-header">
          <div class="date-info">
            <span class="label">Tanggal Terpilih:</span>
            <h4 id="selectedDateText">
              {{ displayDateText }} 
              <small v-if="peserta.length > 0 || operasional.length > 0" 
                    style="color: #f59e0b; font-size: 0.7rem; font-weight: 700; margin-left: 10px; background: #fffbeb; padding: 2px 8px; border-radius: 4px; border: 1px solid #fef3c7;">
                🟡 Draft Tersimpan Lokal
              </small>
            </h4>
          </div>
          <div class="action-group">
            <button class="add-menu-btn" @click="openMenuCatalog">+ Pilih Menu</button>
            <button class="add-menu-btn" style="background: #1c4d8d; color: white;">📥 Export PDF</button>
          </div>
        </div>

        <div class="report-section">
          <h5 class="section-title">Sasaran Penerima Manfaat</h5>
          <h5 class="section-title">A. Peserta Didik</h5>
          <table class="report-table">
            <thead>
              <tr>
                <th>Kelompok Penerima Manfaat</th>
                <th>Nama Sekolah</th>
                <th>Laki-laki</th>
                <th>Perempuan</th>
                <th>Jumlah</th>
                <th>Menu</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="bodyPesertaDidik">
              <tr v-for="(row, i) in peserta" :key="'p'+i" @click="applyMenuToRow(row)">
                <td><select v-model="row.group" class="table-input" @change="saveToDraft">
                  <option value="" disabled>-- Pilih Kategori --</option>
                  <option v-for="kat in kategoriPeserta" :key="kat" :value="kat">{{ kat }}</option>
                  </select>
                </td>
                <td><input type="text" v-model="row.school" class="table-input"></td>
                <td><input type="number" v-model.number="row.male" class="table-input qty-input" @input="recalculateAllIngredients"></td>
                <td><input type="number" v-model.number="row.female" class="table-input qty-input" @input="recalculateAllIngredients"></td>
                <td class="row-total">{{ row.male + row.female }}</td>
                <td><div class="badge-container"><span v-for="m in row.menuNames" :key="m" class="badge-menu">{{m}}</span></div></td>
                <td class="text-center"><button class="btn-icon delete" @click.stop="removeRow(peserta, i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <button class="btn-add-row" @click="addRow('peserta')">+ Tambah Sasaran</button>
        </div>

        <div class="report-section">
          <h5 class="section-title">B. Non-Peserta Didik</h5>
          <table class="report-table">
            <thead>
              <tr>
                <th>Kelompok Penerima Manfaat</th>
                <th>Nama Posyandu</th>
                <th>Laki-laki</th>
                <th>Perempuan</th>
                <th>Jumlah</th>
                <th>Menu</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody id="bodyNonPesertaDidik">
              <tr v-for="(row, i) in nonPeserta" :key="'np'+i" @click="applyMenuToRow(row)">
                <td><select v-model="row.group" class="table-input" @change="saveToDraft">
                  <option value="" disabled>-- Pilih Kategori --</option>
                  <option v-for="kat in kategoriNonPeserta" :key="kat" :value="kat">{{ kat }}</option>
                  </select>
                </td>
                <td><input type="text" v-model="row.school" class="table-input"></td>
                <td><input type="number" v-model.number="row.male" class="table-input qty-input"></td>
                <td><input type="number" v-model.number="row.female" class="table-input qty-input"></td>
                <td class="row-total">{{ row.male + row.female }}</td>
                <td><div class="badge-container"><span v-for="m in row.menuNames" :key="m" class="badge-menu">{{m}}</span></div></td>
                <td class="text-center"><button class="btn-icon delete" @click.stop="removeRow(nonPeserta, i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <button class="btn-add-row" @click="addRow('nonPeserta')">+ Tambah Sasaran</button>
        </div>

        <div class="report-section">
          <h5 class="section-title">Rincian Pembelanjaan</h5>
          <h5 class="section-title">A. Bahan Baku Pangan</h5>
          <table class="report-table">
            <thead>
              <tr>
                <th>Nama Bahan Baku</th>
                <th>Jumlah</th>
                <th>Unit Satuan</th>
                <th>Harga Satuan</th>
                <th>Total</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ing, i) in ingredients" :key="'ing'+i">
                <td>{{ ing.name }}</td>
                <td><input type="number" v-model.number="ing.qty" class="table-input"></td>
                <td>{{ ing.unit }}</td>
                <td><input type="number" v-model.number="ing.price" class="table-input"></td>
                <td class="row-total">Rp {{ (ing.qty * ing.price).toLocaleString() }}</td>
                <td class="text-center"><button class="btn-icon delete" @click="removeRow(ingredients, i)">🗑️</button></td>
              </tr>
            </tbody>
            <tfoot>
              <tr class="footer-total">
                <td colspan="4">Total Belanja Bahan Baku</td>
                <td id="grandTotalIngredients">Rp {{ totalBelanja.toLocaleString() }}</td>
                <td></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div class="report-section">
          <h5 class="section-title">B. Biaya Operasional</h5>
          <table class="report-table">
            <thead>
              <tr>
                <th>Kebutuhan</th>
                <th>Biaya per Hari (Rp)</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(op, i) in operasional" :key="'op'+i">
                <td><input type="text" v-model="op.name" class="table-input"></td>
                <td><input type="number" v-model.number="op.cost" class="table-input"></td>
                <td><input type="text" v-model="op.note" class="table-input"></td>
                <td class="text-center"><button class="btn-icon delete" @click="removeRow(operasional, i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <button class="btn-add-row" @click="addCostRow('Operational')">+ Tambah Biaya</button>
        </div>

        <div class="report-section">
          <h5 class="section-title">C. Biaya Insentif Fasilitas SPPG</h5>
          <table class="report-table">
            <thead>
              <tr>
                <th>Uraian</th>
                <th>Jumlah</th>
                <th>Keterangan</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(ins, i) in insentif" :key="'ins'+i">
                <td><input type="text" v-model="ins.name" class="table-input"></td>
                <td><input type="number" v-model.number="ins.cost" class="table-input"></td>
                <td><input type="text" v-model="ins.note" class="table-input"></td>
                <td class="text-center"><button class="btn-icon delete" @click="removeRow(insentif, i)">🗑️</button></td>
              </tr>
            </tbody>
          </table>
          <button class="btn-add-row" @click="addCostRow('Incentive')">+ Tambah Biaya</button>
        </div>

        <div class="planner-footer-actions">
          <div class="status-selector">
            <label>Set Status Laporan:</label>
            <select v-model="exportStatus" class="manual-status-select">
              <option value="Pending">🟡 Pending (Kuning)</option>
              <option value="Exported">🟢 Exported (Hijau)</option>
            </select>
          </div>
          <button class="submit-btn" @click="saveDailyReport" :disabled="isLoading">
            {{ isLoading ? 'Memproses...' : '💾 SIMPAN LAPORAN HARIAN' }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useUserStore } from '../stores/user';
import { apiCall, scriptURL } from '../services/api';
import Swal from 'sweetalert2';

const router = useRouter();
const userStore = useUserStore();

// --- CALENDAR LOGIC (planner-logic.js implementation) ---
const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "December"];
const currentYear = ref(new Date().getFullYear());
const currentMonth = ref(new Date().getMonth());
const calendarStatus = ref<Record<string, string>>({});

const kategoriPeserta = ref([
  "PAUD/TK/RA/TKLB",
  "SD/MI/SD SLB Kelas 1-3",
  "SD/MI/SD SLB Kelas 4-6",
  "Siswa SMP/MTS/SMP SLB/Pesantren Kelas 1-3",
  "Siswa SMA/MA/SMK/SMA SLB/Pesantren Kelas 4-6",
  "ATS Usia < 9 Tahun",
  "ATS Usia 9-18 Tahun",
  "Pendidik",
  "Tenaga Kependidikan",
  "Lainnya"
]);

const kategoriNonPeserta = ref([
  "Batita",
  "Balita",
  "Ibu Hamil",
  "Ibu Menyusui",
  "Lainnya"
]);

const nextMonthInfo = computed(() => {
  let m = currentMonth.value + 1;
  let y = currentYear.value;
  if (m > 11) { m = 0; y++; }
  return { m, y };
});

const generateDays = (y: number, m: number) => {
  const days = [];
  const first = new Date(y, m, 1).getDay();
  const shift = (first === 0) ? 6 : first - 1;
  const last = new Date(y, m + 1, 0).getDate();
  const pLast = new Date(y, m, 0).getDate();

  for (let x = shift; x > 0; x--) days.push({ dayNum: pLast - x + 1, type: 'prev-date', date: '' });
  for (let i = 1; i <= last; i++) {
    const f = `${y}-${String(m + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
    days.push({ dayNum: i, type: 'current', date: f });
  }
  const remaining = 42 - days.length;
  for (let j = 1; j <= remaining; j++) days.push({ dayNum: j, type: 'next-date', date: '' });
  return days;
};

const calendarLeft = computed(() => generateDays(currentYear.value, currentMonth.value));
const calendarRight = computed(() => generateDays(nextMonthInfo.value.y, nextMonthInfo.value.m));

const changeMonth = (val: number) => {
  currentMonth.value += val;
  if (currentMonth.value > 11) { currentMonth.value = 0; currentYear.value++; }
  else if (currentMonth.value < 0) { currentMonth.value = 11; currentYear.value--; }
  updateCalendarIndicators();
};

const isToday = (dateStr: string) => dateStr === new Date().toISOString().split('T')[0];

// --- DATA LOGIC ---
const selectedDate = ref(sessionStorage.getItem('plannerSavedDate') || '');
const displayDateText = ref('-Select Date-');
const exportStatus = ref('Pending');
const isLoading = ref(false);

const peserta = ref<any[]>([]);
const nonPeserta = ref<any[]>([]);
const ingredients = ref<any[]>([]);
const operasional = ref<any[]>([]);
const insentif = ref<any[]>([]);
const isDrafting = ref(false);

const totalBelanja = computed(() => ingredients.value.reduce((acc, curr) => acc + (curr.qty * curr.price), 0));

// Key unik untuk menyimpan draft di browser
const DRAFT_KEY = 'planner_report_draft';

// Fungsi untuk menyimpan seluruh state saat ini ke LocalStorage
function saveToDraft() {
  if (!selectedDate.value) return;

  // Ambil master draft yang sudah ada atau buat objek baru
  const masterDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');

  // Masukkan data tanggal yang sedang aktif ke dalam master draft
  masterDraft[selectedDate.value] = {
    peserta: peserta.value,
    nonPeserta: nonPeserta.value,
    operasional: operasional.value,
    insentif: insentif.value,
    ingredients: ingredients.value,
    exportStatus: exportStatus.value
  };

  localStorage.setItem(DRAFT_KEY, JSON.stringify(masterDraft));
}

// Fungsi untuk memuat kembali data dari draft saat page dibuka
function loadDraftByDate(date: string) {
  const masterDraft = JSON.parse(localStorage.getItem(DRAFT_KEY) || '{}');
  const data = masterDraft[date];

  if (data) {
    peserta.value = data.peserta || [];
    nonPeserta.value = data.nonPeserta || [];
    operasional.value = data.operasional || [];
    insentif.value = data.insentif || [];
    ingredients.value = data.ingredients || []; 
    
    exportStatus.value = data.exportStatus || 'Pending';
    isDrafting.value = true;
    return true;
  }
  return false;
}

// Hapus draft setelah laporan resmi berhasil di-submit ke database
function clearDraft() {
  localStorage.removeItem(DRAFT_KEY);
}

async function updateCalendarIndicators() {
  const monthLeft = `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}`;
  
  // 1. Tambahkan timestamp (&t=...) agar browser tidak mengambil data lama dari cache
  const data = await apiCall<any[]>('readSchedules', 'Menu Schedules', `&month=${monthLeft}&t=${Date.now()}`);
  
  if (data && Array.isArray(data)) {
    const map: Record<string, string> = {};
    
    data.forEach(item => {
      // 2. Samakan dengan saveDailyReport: 
      // Jika di payload simpan pakai 'exportStatus', di sini baca juga 'exportStatus'
      const status = item.exportStatus || item.Export_Status; 
      
      if (item.Date && status) {
        map[item.Date] = status;
      }
    });

    // 3. REAKTIVITAS: Gunakan spread operator (...) agar Vue sadar ada perubahan objek
    // Ini yang membuat titik kuning/hijau langsung muncul di UI
    calendarStatus.value = { ...map };
    
    console.log("Indikator terupdate:", calendarStatus.value);
  }
}

async function handleSelectDate(day: any) {
  // 1. Simpan apa yang sedang dikerjakan sekarang sebelum pindah
  saveToDraft();

  // 2. Ganti tanggal aktif
  selectedDate.value = day.date;
  displayDateText.value = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(day.date));
  
  // 3. Reset UI sementara
  resetAll();
  isDrafting.value = false;

  // 4. Coba muat dari draft lokal dulu
  const foundLocal = loadDraftByDate(day.date);

  // 5. Jika tidak ada di lokal, baru tarik dari Google Sheets
  if (!foundLocal) {
    await fetchScheduleByDate(day.date);
  }
}

const resetAll = () => {
  peserta.value = []; nonPeserta.value = []; ingredients.value = []; operasional.value = []; insentif.value = [];
};

async function fetchScheduleByDate(date: string) {
  const results = await apiCall<any[]>('getScheduleByDate', 'Menu Schedules', `&date=${date}`);
  if (results && results.length > 0) {
    peserta.value = results.filter(r => r.Group_Name.includes("Peserta Didik")).map(mapRow);
    nonPeserta.value = results.filter(r => !r.Group_Name.includes("Peserta Didik")).map(mapRow);
    ingredients.value = JSON.parse(results[0].Ingredients_Used || "[]");
    const costs = JSON.parse(results[0].Op_Costs || "[]");
    operasional.value = costs.filter((c:any) => c.type === 'Operational');
    insentif.value = costs.filter((c:any) => c.type === 'Incentive');
    exportStatus.value = results[0].Export_Status;
  }
}

const mapRow = (r: any) => ({
  group: r.Group_Name, school: r.Institution_Name,
  male: Number(r.Male_Count), female: Number(r.Female_Count),
  menuIDs: JSON.parse(r.MenuID || "[]"),
  menuNames: r.Menu_Name ? r.Menu_Name.split(', ') : []
});


const addRow = (t: string) => {
  const row = { group: '', school: '', male: 0, female: 0, menuIDs: [], menuNames: [] };
  if (t === 'peserta') peserta.value.push(row); else nonPeserta.value.push(row);
};

const addCostRow = (type: 'Operational' | 'Incentive') => {
  const row = { name: '', cost: 0, note: '', type };
  if (type === 'Operational') operasional.value.push(row); else insentif.value.push(row);
};

const removeRow = (l: any[], i: number) => l.splice(i, 1);

const openMenuCatalog = () => {
  sessionStorage.setItem('plannerSavedDate', selectedDate.value);
  router.push('/list-menu');
};

const applyMenuToRow = (row: any) => {
  const tID = sessionStorage.getItem('tempSelectedMenuID');
  const tName = sessionStorage.getItem('tempSelectedMenuName');
  if (tID && tName && !row.menuIDs.includes(tID)) {
    row.menuIDs.push(tID); row.menuNames.push(tName);
    sessionStorage.removeItem('tempSelectedMenuID'); sessionStorage.removeItem('tempSelectedMenuName');
  }
};

// 1. Tambahkan fungsi hitung ulang di <script setup>
const recalculateAllIngredients = async () => {
  // Ambil database resep (karena kita butuh takaran per porsi)
  const ingredientDb = await apiCall<any[]>('readAll', 'Menu Ingredients');
  if (!ingredientDb) return;

  const newIngredients: any[] = [];

  // Loop semua baris (peserta & nonPeserta)
  const allRows = [...peserta.value, ...nonPeserta.value];
  
  allRows.forEach(row => {
    const totalPorsi = Number(row.male || 0) + Number(row.female || 0);
    
    // Untuk setiap menu yang ada di baris ini
    row.menuIDs.forEach((menuID: string) => {
      const match = ingredientDb.find(db => db.MenuID === menuID);
      if (match) {
        const recipe = JSON.parse(match.Ingredients_JSON || "[]");
        recipe.forEach((item: any) => {
          const needed = totalPorsi * Number(item.qty || 0);
          const exist = newIngredients.find(ni => ni.name === item.name);
          
          if (exist) {
            exist.qty += needed;
          } else {
            newIngredients.push({ name: item.name, qty: needed, unit: item.unit, price: 0 });
          }
        });
      }
    });
  });

  ingredients.value = newIngredients;
  saveToDraft(); // Simpan perubahan ke localStorage
};


watch(
  [peserta, nonPeserta], 
  () => {
    // Setiap kali angka di tabel peserta/non-peserta berubah, hitung ulang bahan baku
    recalculateAllIngredients();
  }, 
  { deep: true }
);

onMounted(() => {
  updateCalendarIndicators();
  
  if (selectedDate.value) {
    // Tampilkan tanggal yang tersimpan di session
    displayDateText.value = new Intl.DateTimeFormat('id-ID', { dateStyle: 'full' }).format(new Date(selectedDate.value));
    
    // Coba load draft lokal untuk tanggal tersebut, jika gagal baru fetch API
    if (!loadDraftByDate(selectedDate.value)) {
      fetchScheduleByDate(selectedDate.value);
    }
  }
}); 

async function saveDailyReport() {
  if (!selectedDate.value) {
    Swal.fire('Peringatan', 'Silakan pilih tanggal terlebih dahulu!', 'warning');
    return;
  }

  isLoading.value = true;
  
  // Pastikan bahan baku dihitung ulang berdasarkan porsi terbaru sebelum kirim
  // await recalculateAllIngredients(); 
  const totalPortions = [...peserta.value, ...nonPeserta.value].reduce((acc, p) => {
    return acc + (Number(p.male) || 0) + (Number(p.female) || 0);
  }, 0);

  const payload = {
    action: 'saveDailyReport',
    data: JSON.stringify([...peserta.value, ...nonPeserta.value].map(p => ({
      date: selectedDate.value, 
      group: p.group, 
      school: p.school,
      male: Number(p.male || 0), 
      female: Number(p.female || 0), 
      total: totalPortions,
      menuID: JSON.stringify(p.menuIDs), 
      menuName: p.menuNames.join(', ')
    }))),
    ingredients: JSON.stringify(ingredients.value),
    costs: JSON.stringify([...operasional.value, ...insentif.value]),
    exportStatus: exportStatus.value,
    plannerID: userStore.id
  };

  try {
    const res = await fetch(scriptURL, { 
      method: 'POST', 
      // Penting: body harus stringify
      body: JSON.stringify(payload) 
    });

    if (!res.ok) throw new Error('Network response was not ok');

    const result = await res.json();
    
    if (result.status === 'success') {
      Swal.fire('Success', 'Laporan Berhasil disimpan ke sistem!', 'success');
      clearDraft(); // Menghapus draft lokal setelah sukses simpan
      await updateCalendarIndicators(); // Memperbarui titik hijau/merah di kalender
    } else {
      Swal.fire('Gagal', result.message || 'Terjadi kesalahan pada server', 'error');
    }
  } catch (error) {
    console.error("Error saving report:", error);
    Swal.fire('Error', 'Gagal terhubung ke server. Periksa koneksi internet Anda.', 'error');
  } finally {
    isLoading.value = false;
  }
}

// Pantau perubahan pada semua array data
watch(
  [peserta, nonPeserta, operasional, insentif, exportStatus, selectedDate],
  () => {
    saveToDraft();
  },
  { deep: true } // 'deep' penting agar perubahan di dalam baris tabel terdeteksi
);
</script>

<style scoped>
/* --- LAYOUT & HEADER --- */
.planner-page {
  background: #f8fafc;
  min-height: 100vh;
}

.top-header {
  background: white;
  height: 70px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 30px;
  border-bottom: 1px solid #e2e8f0;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left { display: flex; align-items: center; gap: 20px; }
.header-titles h1 { font-size: 1.2rem; font-weight: 800; color: #1c4d8d; margin: 0; }
.header-titles p { font-size: 0.75rem; color: #94a3b8; margin: 0; }

.user-profile-small { display: flex; align-items: center; gap: 12px; }
.u-name { display: block; font-size: 0.85rem; font-weight: 700; color: #1e293b; }
.u-role { display: block; font-size: 0.7rem; color: #64748b; }
.avatar-circle {
  width: 38px; height: 38px; background: #1c4d8d; color: white;
  border-radius: 50%; display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.9rem;
}

.add-menu-btn {
  background: #1c4d8d; color: white; border: none; padding: 10px 20px;
  border-radius: 8px; font-weight: 700; cursor: pointer; transition: 0.3s;
}

.back-btn {
  background: #f1f5f9; border: none; width: 35px; height: 35px;
  border-radius: 8px; cursor: pointer; font-weight: 800; transition: 0.2s;
}
.back-btn:hover { background: #e2e8f0; }

/* --- CALENDAR SYSTEM --- */
.planner-container { padding: 30px; max-width: 1400px; margin: 0 auto; }

.calendar-double-wrapper {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 25px;
  margin-bottom: 20px;
}

.calendar-card { padding: 25px; }
.calendar-controls {
  display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;
}
.month-title { font-size: 1.1rem; font-weight: 800; color: #334155; }
.nav-btn { background: none; border: 1px solid #e2e8f0; border-radius: 6px; width: 30px; height: 30px; cursor: pointer; font-size: 1.2rem; }

.calendar-grid-header {
  display: grid; grid-template-columns: repeat(7, 1fr);
  text-align: center; margin-bottom: 10px;
}
.calendar-grid-header span { font-size: 0.75rem; font-weight: 800; color: #94a3b8; text-transform: uppercase; }

.calendar-days-grid {
  display: grid; grid-template-columns: repeat(7, 1fr); gap: 6px;
}

.day-cell {
  aspect-ratio: 1 / 1; border: 1px solid #f1f5f9; border-radius: 10px; display: flex;flex-direction: column;
  /* Menghapus center alignment agar bisa mengatur posisi manual */
  align-items: flex-start; justify-content: flex-start;padding: 8px; cursor: pointer;
  position: relative;
  transition: all 0.2s ease;
  background: white;
}
.day-cell:hover { background: #f0f9ff; border-color: #1c4d8d; }
.day-cell.active { background: #1c4d8d !important; color: white !important; box-shadow: 0 4px 12px rgba(28, 77, 141, 0.3); }
.day-cell.today { border: 2px solid #1c4d8d; color: #1c4d8d; font-weight: 800; }
.day-cell.prev-date, .day-cell.next-date { color: #e2e8f0; pointer-events: none; border: none; }

.status-dot {
  width: 6px; height: 6px; border-radius: 50%; position: absolute; bottom: 8px;
}
.status-dot.pending { background: #f59e0b; }
.status-dot.exported { background: #10b981; }

.legend { display: flex; gap: 20px; margin-bottom: 30px; padding: 15px 25px; }
.legend-item { display: flex; align-items: center; gap: 8px; font-size: 0.8rem; font-weight: 700; color: #64748b; }
.dot { width: 10px; height: 10px; border-radius: 50%; display: inline-block; }
.dot.yellow { background: #f59e0b; }
.dot.green { background: #10b981; }

/* --- REPORT SECTION --- */
.schedule-detail { padding: 40px; }
.detail-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 30px; border-bottom: 2px dashed #f1f5f9; padding-bottom: 20px;
}
.date-info .label { font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase; }
.date-info h4 { font-size: 1.4rem; font-weight: 800; color: #1c4d8d; margin-top: 5px; }

.action-group { display: flex; gap: 12px; }
.btn-action { padding: 10px 20px; border-radius: 8px; font-weight: 700; cursor: pointer; border: none; transition: 0.3s; }
.btn-action.primary { background: #1c4d8d; color: white; }
.btn-action.secondary { background: #f1f5f9; color: #1c4d8d; border: 1px solid #1c4d8d; }

.section-title {
  font-size: 0.9rem; font-weight: 800; color: #1c4d8d; margin: 30px 0 15px;
  display: flex; align-items: center; gap: 10px;
}
.section-title::before { content: ''; width: 4px; height: 18px; background: #1c4d8d; border-radius: 2px; }

.report-table { width: 100%; border-collapse: collapse; }
.report-table th { background: #f8fafc; padding: 14px; text-align: left; font-size: 0.75rem; color: #64748b; text-transform: uppercase; border-bottom: 2px solid #e2e8f0; }
.report-table td { padding: 12px; border-bottom: 1px solid #f1f5f9; }
.clickable-row { cursor: cell; transition: 0.2s; }
.clickable-row:hover { background: #f8fbff; }

.table-input {
  width: 100%; border: 1px solid #e2e8f0; padding: 8px 12px; border-radius: 6px;
  font-size: 0.85rem; transition: 0.3s;
}
.table-input:focus { border-color: #1c4d8d; outline: none; background: white; }

.row-total { font-weight: 800; color: #1c4d8d; text-align: center; }
.badge-menu {
  background: #e0f2fe; color: #0369a1; padding: 4px 10px; border-radius: 6px;
  font-size: 0.75rem; font-weight: 700; margin: 2px; display: inline-block;
}

.btn-add-row {
  width: 100%; background: white; border: 1px dashed #1c4d8d; color: #1c4d8d;
  padding: 12px; border-radius: 10px; font-weight: 800; cursor: pointer; margin-top: 15px;
}
.btn-del { border: none; background: #fee2e2; color: #ef4444; padding: 8px; border-radius: 6px; cursor: pointer; }

/* --- FOOTER --- */
.planner-footer-actions { margin-top: 50px; border-top: 2px solid #f1f5f9; padding-top: 30px; }
.status-selector-box { margin-bottom: 20px; display: flex; align-items: center; gap: 15px; justify-content: flex-end; }
.status-selector-box label { font-size: 0.9rem; font-weight: 700; color: #334155; }
.manual-status-select { padding: 10px 15px; border-radius: 8px; border: 1px solid #cbd5e1; font-weight: 700; }

.submit-btn {
  width: 100%; background: #1c4d8d; color: white; padding: 20px; border: none;
  border-radius: 15px; font-weight: 800; font-size: 1.1rem; cursor: pointer;
  box-shadow: 0 10px 20px rgba(28, 77, 141, 0.2); transition: 0.3s;
}
.submit-btn:hover:not(:disabled) { transform: translateY(-3px); box-shadow: 0 15px 30px rgba(28, 77, 141, 0.3); }

/* --- ANIMATIONS --- */
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
.animate-fade-in { animation: fadeIn 0.5s ease; }
.animate-slide-up { animation: slideUp 0.6s ease; }

.card { background: white; border-radius: 20px; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
.mt-30 { margin-top: 30px; }
.w-80 { width: 80px; }
.w-100 { width: 100px; }
.w-150 { width: 150px; }
.w-50 { width: 50px; }
.text-center { text-align: center; }
.text-bold { font-weight: 800; }
</style>