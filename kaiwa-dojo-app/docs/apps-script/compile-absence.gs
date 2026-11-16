/**
 * Kaiwa Dojo — penerima rekap kehadiran untuk tab "Compile Absence".
 *
 * Pasang di spreadsheet absensi: Extensions → Apps Script → tempel file ini.
 * Setup lengkap ada di docs/REKAP_KEHADIRAN.md.
 *
 * Server Kaiwa Dojo mengirim POST JSON:
 *   { secret, sheet_name, values[][], header_row, first_date_col, date_count, student_count, percent_col }
 * Tab tujuan dikosongkan lalu ditulis ulang setiap kali admin menekan "Kirim ke Google Sheets".
 */

var DEFAULT_SHEET_NAME = 'Compile Absence';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret || body.secret !== secret) {
      return json_({ ok: false, error: 'Kunci rahasia tidak cocok. Samakan Script Property SECRET dengan ATTENDANCE_SHEET_SECRET di server.' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(30000);
    try {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      var sheet = ss.getSheetByName(body.sheet_name || DEFAULT_SHEET_NAME) || ss.insertSheet(body.sheet_name || DEFAULT_SHEET_NAME);
      writeReport_(sheet, body);
      return json_({ ok: true, rows: body.student_count, url: ss.getUrl() + '#gid=' + sheet.getSheetId() });
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Cek cepat dari browser: buka URL web app → harus tampil {"ok":true,...} */
function doGet() {
  return json_({ ok: true, service: 'kaiwadojo-compile-absence', sheet: DEFAULT_SHEET_NAME });
}

function writeReport_(sheet, body) {
  var values = body.values || [];
  var width = 1;
  values.forEach(function (r) { width = Math.max(width, r.length); });
  var grid = values.map(function (r) {
    var row = r.slice();
    while (row.length < width) row.push('');
    return row;
  });

  var headerRow = body.header_row;
  var firstDateCol = body.first_date_col;
  var dateCount = body.date_count;
  var studentCount = body.student_count;
  var firstDataRow = headerRow + 1;
  var totalRow = firstDataRow + studentCount;

  // Bersihkan isi, format, validasi & aturan warna lama
  if (sheet.getMaxRows() > 0 && sheet.getMaxColumns() > 0) {
    sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearDataValidations();
  }
  sheet.clear();
  sheet.setConditionalFormatRules([]);
  sheet.setFrozenRows(0);
  sheet.setFrozenColumns(0);

  // Pastikan ukuran grid cukup
  if (sheet.getMaxColumns() < width) sheet.insertColumnsAfter(sheet.getMaxColumns(), width - sheet.getMaxColumns());
  if (sheet.getMaxRows() < grid.length + 2) sheet.insertRowsAfter(sheet.getMaxRows(), grid.length + 2 - sheet.getMaxRows());

  // Sel jam (HH:MM) & "Terakhir Aktif" disimpan sebagai teks agar tidak diubah jadi waktu/zonasi
  if (studentCount > 0) {
    if (dateCount > 0) sheet.getRange(firstDataRow, firstDateCol, studentCount, dateCount).setNumberFormat('@');
    sheet.getRange(firstDataRow, firstDateCol - 1, studentCount, 1).setNumberFormat('@');
  }

  sheet.getRange(1, 1, grid.length, width).setValues(grid);

  // ── Format ──
  sheet.getRange(1, 1).setFontSize(13).setFontWeight('bold');
  sheet.getRange(2, 1, 2, width).setFontColor('#475569');
  sheet.getRange(2, 1, 2, 1).setFontWeight('bold');

  var header = sheet.getRange(headerRow, 1, 1, width);
  header.setFontWeight('bold').setBackground('#0f172a').setFontColor('#ffffff')
    .setWrap(true).setHorizontalAlignment('center').setVerticalAlignment('middle');
  sheet.setRowHeight(headerRow, 40);
  sheet.setFrozenRows(headerRow);
  sheet.setFrozenColumns(2);

  var tableRows = studentCount + 2; // header + data + total
  sheet.getRange(headerRow, 1, tableRows, width)
    .setBorder(true, true, true, true, true, true, '#cbd5e1', SpreadsheetApp.BorderStyle.SOLID);

  if (studentCount > 0) {
    sheet.getRange(firstDataRow, body.percent_col, studentCount, 1).setNumberFormat('0%');
    sheet.getRange(firstDataRow, 1, studentCount, 1).setHorizontalAlignment('center');
    sheet.getRange(firstDataRow, 5, studentCount, 3).setHorizontalAlignment('center');
    if (dateCount > 0) {
      sheet.getRange(firstDataRow, firstDateCol, studentCount + 1, dateCount).setHorizontalAlignment('center');
    }
  }
  sheet.getRange(totalRow, 1, 1, width).setFontWeight('bold').setBackground('#f1f5f9');

  // Warna: hari hadir hijau, kategori berwarna
  var rules = [];
  if (studentCount > 0 && dateCount > 0) {
    rules.push(SpreadsheetApp.newConditionalFormatRule()
      .whenCellNotEmpty()
      .setBackground('#d1fae5').setFontColor('#065f46')
      .setRanges([sheet.getRange(firstDataRow, firstDateCol, studentCount, dateCount)])
      .build());
  }
  if (studentCount > 0) {
    var catRange = sheet.getRange(firstDataRow, 7, studentCount, 1);
    [['Sangat Aktif', '#bbf7d0', '#14532d'], ['Aktif', '#dbeafe', '#1e3a8a'], ['Kurang Aktif', '#fef3c7', '#78350f'], ['Pasif', '#fee2e2', '#7f1d1d']]
      .forEach(function (c) {
        rules.push(SpreadsheetApp.newConditionalFormatRule()
          .whenTextEqualTo(c[0]).setBackground(c[1]).setFontColor(c[2])
          .setRanges([catRange]).build());
      });
  }
  sheet.setConditionalFormatRules(rules);

  // Lebar kolom
  sheet.setColumnWidth(1, 40);
  sheet.setColumnWidth(2, 220);
  sheet.setColumnWidth(3, 130);
  sheet.setColumnWidth(4, 150);
  sheet.setColumnWidths(5, 3, 90);
  sheet.setColumnWidth(8, 130);
  if (dateCount > 0) sheet.setColumnWidths(firstDateCol, dateCount, 64);
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
