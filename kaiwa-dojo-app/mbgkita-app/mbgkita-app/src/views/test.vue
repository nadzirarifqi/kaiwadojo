<div class="menu-grid">
  <div v-for="menu in filteredMenus" :key="menu.MenuID" class="menu-card">
    <div class="recipe-badge">APPROVED</div>
    <div class="recipe-thumb-container">
      <img :src="menu.Menu_Image || '/mbgkita.png'" class="recipe-thumb" @error="(e) => e.target.src='/mbgkita.png'">
    </div>
    <div class="recipe-thumb-content">
      <div class="category-tag">{{ menu.targetAKG }}</div>
      <h4>{{ menu.Menu_Name }}</h4>
      
      <div class="nutrition-grid-mini">
        <div class="nutri-item">
          <span class="nutri-label">Energi</span>
          <span class="nutri-value">{{ menu.Calories || '-' }} kCal</span>
        </div>
        <div class="nutri-item">
          <span class="nutri-label">Protein</span>
          <span class="nutri-value">{{ menu.Protein || '-' }} g</span>
        </div>
      </div>

      <div class="recipe-actions">
        <button class="action-btn view-btn" @click="selectMenu(menu)">👁️ Detail & Pilih</button>
      </div>
    </div>
  </div>
</div>

<div class="modal-body" v-if="selectedMenuForModal">
  <div class="view-tray-visualization">
    <h3 class="tray-title">📍 Tata Letak Nampan:</h3>
    <div class="food-tray-container">
      <div class="tray-layout">
        <div class="tray-slot" :class="{ filled: selectedMenuForModal.Slot1 }" data-slot="1">
          <span class="slot-label">Slot 1</span>
          <span class="food-name">{{ selectedMenuForModal.Slot1 || 'Kosong' }}</span>
        </div>
        <div class="tray-slot" :class="{ filled: selectedMenuForModal.Slot2 }" data-slot="2">
          <span class="slot-label">Slot 2</span>
          <span class="food-name">{{ selectedMenuForModal.Slot2 || 'Kosong' }}</span>
        </div>
        <div class="tray-slot" :class="{ filled: selectedMenuForModal.Slot3 }" data-slot="3">
          <span class="slot-label">Slot 3</span>
          <span class="food-name">{{ selectedMenuForModal.Slot3 || 'Kosong' }}</span>
        </div>
        <div class="tray-slot" :class="{ filled: selectedMenuForModal.Slot4 }" data-slot="4">
          <span class="slot-label">Slot 4</span>
          <span class="food-name">{{ selectedMenuForModal.Slot4 || 'Kosong' }}</span>
        </div>
        <div class="tray-slot" :class="{ filled: selectedMenuForModal.Slot5 }" data-slot="5">
          <span class="slot-label">Slot 5</span>
          <span class="food-name">{{ selectedMenuForModal.Slot5 || 'Kosong' }}</span>
        </div>
      </div>
    </div>
  </div>

  <div class="form-group mt-15">
    <label>Pilih Kelompok Sasaran:</label>
    <select v-model="targetGroup" class="modal-select">
      </select>
  </div>
</div>