// Re-applies the English translation dictionaries in this folder onto the
// product data embedded in index.html. Run this as the LAST step of every
// Site 1 -> Site 2 sync, after the fresh Hebrew catalog data has been spliced
// in - otherwise the next sync silently wipes all English text.
//
// Usage:  node translations/apply-translations.js <path-to-index.html>
//
// New products/addons added in Site 1 since the last translation pass won't
// have an entry in these dictionaries yet; the script lists them at the end
// so they can be translated and added.

const fs = require('fs');
const path = require('path');

const sitePath = process.argv[2];
if (!sitePath) {
  console.error('Usage: node apply-translations.js <path-to-index.html>');
  process.exit(1);
}

const dir = __dirname;
const read = (f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));

const productNames = read('product-names-en.json');
const productNotes = read('product-notes-en.json');
const addonNames = read('addon-names-en.json');
const categoryNames = read('category-names-en.json');
const materialNames = read('material-names-en.json');
const subcategoryNames = read('subcategory-names-en.json');
const sizeNames = read('size-names-en.json');
const thicknessNames = read('thickness-names-en.json');
const miscText = read('misc-text-en.json');

const content = fs.readFileSync(sitePath, 'utf8');
const marker = '<script id="sf-data" type="application/json">';
const start = content.indexOf(marker) + marker.length;
const end = content.indexOf('</script>', start);
if (start < marker.length || end < 0) {
  console.error('Could not find sf-data script block in ' + sitePath);
  process.exit(1);
}
const data = JSON.parse(content.slice(start, end));

const heRegex = /[֐-׿]/;
const untranslatedNames = [];
const untranslatedNotes = [];
const untranslatedAddons = new Set();
const untranslatedSizes = new Set();
const untranslatedThickness = new Set();

data.products.forEach((p) => {
  const en = productNames[p.id];
  if (en) p.nameEn = en; else untranslatedNames.push(p.id + ' | ' + p.name);

  if (p.notes && p.notes.trim()) {
    const noteEn = productNotes[p.id];
    if (noteEn) p.notesEn = noteEn; else untranslatedNotes.push(p.id + ' | ' + p.name);
  }

  (p.addons || []).forEach((a) => {
    const addonEn = addonNames[a.name];
    if (addonEn) a.nameEn = addonEn; else untranslatedAddons.add(a.name);
  });

  if (p.size && heRegex.test(p.size)) {
    const sizeEn = sizeNames[p.size];
    if (sizeEn) p.sizeEn = sizeEn; else untranslatedSizes.add(p.size);
  }
  if (p.thickness && heRegex.test(p.thickness)) {
    const thickEn = thicknessNames[p.thickness];
    if (thickEn) p.thicknessEn = thickEn; else untranslatedThickness.add(p.thickness);
  }
});

data.categoryNamesEn = categoryNames;
data.materialNamesEn = materialNames;
data.subcategoryNamesEn = subcategoryNames;
data.sizeNamesEn = sizeNames;

const untranslatedMisc = [];
['storefrontTagline', 'businessHours', 'businessAddress'].forEach((field) => {
  const val = data[field];
  if (!val) return;
  const en = miscText[field] && miscText[field][val];
  if (en) data[field + 'En'] = en; else untranslatedMisc.push(field);
});

const newJson = JSON.stringify(data);
const newContent = content.slice(0, content.indexOf(marker) + marker.length) + newJson + content.slice(end);
fs.writeFileSync(sitePath, newContent, 'utf8');

console.log('Applied translations to ' + sitePath);
console.log('Products:', data.products.length, '| untranslated names:', untranslatedNames.length, '| untranslated notes:', untranslatedNotes.length, '| untranslated addon names:', untranslatedAddons.size, '| untranslated sizes:', untranslatedSizes.size, '| untranslated thickness:', untranslatedThickness.size);
if (untranslatedNames.length) { console.log('\nMissing product name translations:'); untranslatedNames.forEach(l => console.log('  ' + l)); }
if (untranslatedNotes.length) { console.log('\nMissing product notes translations:'); untranslatedNotes.forEach(l => console.log('  ' + l)); }
if (untranslatedAddons.size) { console.log('\nMissing addon name translations:'); untranslatedAddons.forEach(l => console.log('  ' + l)); }
if (untranslatedSizes.size) { console.log('\nMissing size translations:'); untranslatedSizes.forEach(l => console.log('  ' + l)); }
if (untranslatedThickness.size) { console.log('\nMissing thickness translations:'); untranslatedThickness.forEach(l => console.log('  ' + l)); }
if (untranslatedMisc.length) { console.log('\nMissing misc text translations (tagline/hours/address changed in Site 1):'); untranslatedMisc.forEach(l => console.log('  ' + l)); }

const missingCategories = (data.categories || []).filter(c => !categoryNames[c] && c !== 'מבצעים');
if (missingCategories.length) console.log('\nMissing category translations:', missingCategories.join(', '));
