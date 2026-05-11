/*** CONFIG ***/
const SHEET_ID   = '1I-iWwijASFbxyo3joi07goxnWtACzl_r2DUC3-poc4A';   // e.g. 1AbC... from the sheet URL
const SHEET_NAME = 'CMSE 201-8 Attendance';                           // change if your tab is named differently
const DATE_FMT   = 'yyyy-MM-dd';

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error(`No sheet named ${SHEET_NAME}`);

    const lastRow = sh.getLastRow();
    const lastCol = sh.getLastColumn();
    const header  = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    const groupIdx = header.findIndex(h => String(h).trim().toLowerCase() === 'group'); // 0-based

    const rows = [];
    if (lastRow >= 2) {
      const vals = sh.getRange(2, 1, lastRow - 1, Math.max(1, lastCol)).getValues();
      vals.forEach(r => {
        const name = (r[0] || '').toString().trim();
        if (!name) return;
        const groupVal = groupIdx >= 0 ? (r[groupIdx] == null ? '' : String(r[groupIdx]).trim()) : '';
        rows.push({ name, group: groupVal });
      });
    }

    return ContentService.createTextOutput(JSON.stringify({ ok: true, rows }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  // Lightweight concurrency guard to avoid races when creating "today" column
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(5000)) {
    return json({ ok: false, error: 'Busy, please try again in a moment.' });
  }

  try {
    const tz = Session.getScriptTimeZone() || 'America/Detroit';
    const today = Utilities.formatDate(new Date(), tz, DATE_FMT);

    const posted = e && e.postData && e.postData.contents ? e.postData.contents : '';
    const params = parseUrlEncoded(posted);
    const checkedNames = JSON.parse(params['names'] || '[]').map(s => s.toString().trim()).filter(Boolean);

    // Group: "none" => do not change
    const groupRaw = (params['group'] || '').toString().trim().toLowerCase();
    const groupIsNoChange = groupRaw === '' || groupRaw === 'none';
    const groupVal = groupIsNoChange ? '' : (/^[1-9]\d?$/.test(groupRaw) ? groupRaw : '');

    if (!checkedNames.length) return json({ ok: false, error: 'No names received.' });

    const ss = SpreadsheetApp.openById(SHEET_ID);
    const sh = ss.getSheetByName(SHEET_NAME);
    if (!sh) throw new Error(`No sheet named ${SHEET_NAME}`);

    const lastRow = sh.getLastRow();

    // Map names -> row numbers (1-based rows; headers on row 1)
    const nameVals = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, 1).getValues() : [];
    const nameToRow = {};
    nameVals.forEach((r, i) => {
      const nm = (r[0] || '').toString().trim();
      if (nm) nameToRow[nm.toLowerCase()] = 2 + i;
    });

    // ---- Today's attendance column (normalize headers to DATE_FMT) ----
    const lastCol = Math.max(sh.getLastColumn(), 1);
    const headerVals = sh.getRange(1, 1, 1, lastCol).getValues()[0];

    const norm = v => (v instanceof Date)
      ? Utilities.formatDate(v, tz, DATE_FMT)
      : (v == null ? '' : String(v).trim());

    // Normalize any date-like headers to yyyy-MM-dd to prevent duplicates later
    for (let i = 0; i < headerVals.length; i++) {
      const normalized = norm(headerVals[i]);
      if (normalized && /^\d{4}-\d{2}-\d{2}$/.test(normalized) && headerVals[i] !== normalized) {
        sh.getRange(1, i + 1).setValue(normalized);
        headerVals[i] = normalized; // keep local copy in sync
      }
    }

    // Find/create today's column (header may be "date" or "date\nDay X")
    let dateCol = -1;
    for (let i = 0; i < headerVals.length; i++) {
      const firstLine = (norm(headerVals[i]) || '').split('\n')[0].trim();
      if (firstLine === today) { dateCol = i + 1; break; }
    }
    if (dateCol < 1) {
      dateCol = Math.max(lastCol - 1, 1); // never overwrite col A
      const headerText = today + '\nDay ' + dateCol;
      sh.getRange(1, dateCol).setValue(headerText);
      if (lastRow >= 2) {
        const numRows = lastRow - 1; // rows 2 through lastRow (matches nameVals)
        const newRange = sh.getRange(2, dateCol, numRows, 1);

        // Copy data validation and conditional formatting from an existing date column
        let templateCol = -1;
        for (let i = 0; i < headerVals.length; i++) {
          const firstLine = (norm(headerVals[i]) || '').split('\n')[0].trim();
          if (i + 1 !== dateCol && /^\d{4}-\d{2}-\d{2}$/.test(firstLine)) {
            templateCol = i + 1;
            break;
          }
        }
        if (templateCol > 0) {
          const templateRange = sh.getRange(2, templateCol, numRows, 1);
          templateRange.copyTo(newRange, SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION);
          templateRange.copyTo(newRange, SpreadsheetApp.CopyPasteType.PASTE_CONDITIONAL_FORMATTING);
        } else {
          const rule = SpreadsheetApp.newDataValidation()
            .requireValueInList(['-', 'X', 'E'], true)
            .setAllowInvalid(false)
            .build();
          newRange.setDataValidation(rule);
        }
        newRange.setValues(Array.from({ length: numRows }, () => ['-']));
      }
    }

    // ---- "Group" column only if we need to change it ----
    let groupCol = -1;
    if (!groupIsNoChange && groupVal) {
      const headers2 = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
      for (let i = 0; i < headers2.length; i++) {
        if (String(headers2[i]).toString().trim().toLowerCase() === 'group') { groupCol = i + 1; break; }
      }
      if (groupCol < 1) {
        groupCol = Math.max(sh.getLastColumn() + 1, 2);
        sh.getRange(1, groupCol).setValue('Group');
      }
    }

    // ---- Update rows (per current constraints: unique names, class ~60–80) ----
    const updated = [], missing = [], grouped = [];
    checkedNames.forEach(name => {
      const row = nameToRow[name.toLowerCase()];
      if (!row) { missing.push(name); return; }
      sh.getRange(row, dateCol).setValue('X');
      updated.push(name);
      if (groupCol > 0 && groupVal) {
        sh.getRange(row, groupCol).setValue(groupVal);
        grouped.push(name);
      }
    });

    return json({
      ok: true,
      date: today,
      updated,
      grouped,
      missing,
      updatedCount: updated.length,
      groupedCount: grouped.length,
      missingCount: missing.length,
      groupApplied: (groupCol > 0 && groupVal) ? groupVal : null
    });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    try { lock.releaseLock(); } catch(_){}
  }
}

/*** helpers ***/
function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// Robustly parses application/x-www-form-urlencoded, including values containing '='
function parseUrlEncoded(body) {
  const out = {};
  for (const pair of (body || '').split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = i >= 0 ? pair.slice(0, i) : pair;
    const v = i >= 0 ? pair.slice(i + 1) : '';
    const key = decodeURIComponent(k || '').trim();
    const val = decodeURIComponent((v || '').replace(/\+/g, ' '));
    out[key] = val;
  }
  return out;
}
