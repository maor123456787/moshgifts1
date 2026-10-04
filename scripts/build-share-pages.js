// Generates lightweight static pages for sharing: p/<sku>/index.html per
// product and c/<slug>/index.html per category. Each page carries real
// Open Graph meta tags (title, description, image) so WhatsApp/Facebook/etc.
// show a rich preview when a link is shared, then redirects a real visitor
// into the full app (bots don't execute JS/meta-refresh, so they only ever
// see the lightweight preview page).
//
// Usage:  node scripts/build-share-pages.js index.html p c
//
// Run this any time product-images/ or the catalog changes (e.g. after
// scripts/build-merchant-feed.js), then commit the generated p/ and c/
// folders like any other deploy.

const fs = require('fs');
const path = require('path');

const sitePath = process.argv[2];
const productsOutDir = process.argv[3] || 'p';
const categoriesOutDir = process.argv[4] || 'c';
const siteBaseUrl = 'https://mosh-gifts1.netlify.app/';

const content = fs.readFileSync(sitePath, 'utf8');
const marker = '<script id="sf-data" type="application/json">';
const start = content.indexOf(marker) + marker.length;
const end = content.indexOf('</script>', start);
const data = JSON.parse(content.slice(start, end));

function htmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'category';
}

function extFromDataUri(dataUri) {
  const m = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUri || '');
  if (!m) return 'jpg';
  if (m[1].indexOf('png') !== -1) return 'png';
  if (m[1].indexOf('webp') !== -1) return 'webp';
  return 'jpg';
}

function writeSharePage(outDir, title, description, imageUrl, redirectUrl) {
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const html = '<!doctype html>\n' +
    '<html lang="he" dir="rtl">\n' +
    '<head>\n' +
    '<meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + htmlEsc(title) + '</title>\n' +
    '<meta name="description" content="' + htmlEsc(description) + '">\n' +
    '<link rel="canonical" href="' + htmlEsc(redirectUrl.canonical) + '">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:title" content="' + htmlEsc(title) + '">\n' +
    '<meta property="og:description" content="' + htmlEsc(description) + '">\n' +
    '<meta property="og:image" content="' + htmlEsc(imageUrl) + '">\n' +
    '<meta property="og:url" content="' + htmlEsc(redirectUrl.canonical) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + htmlEsc(title) + '">\n' +
    '<meta name="twitter:description" content="' + htmlEsc(description) + '">\n' +
    '<meta name="twitter:image" content="' + htmlEsc(imageUrl) + '">\n' +
    '<meta http-equiv="refresh" content="0; url=' + htmlEsc(redirectUrl.target) + '">\n' +
    '<script>location.replace(' + JSON.stringify(redirectUrl.target) + ');</script>\n' +
    '</head>\n' +
    '<body>\n' +
    '<p>טוען את ' + htmlEsc(title) + '...</p>\n' +
    '<p><a href="' + htmlEsc(redirectUrl.target) + '">לחצו כאן אם אינכם מועברים אוטומטית</a></p>\n' +
    '</body>\n' +
    '</html>\n';
  fs.writeFileSync(path.join(outDir, 'index.html'), html, 'utf8');
}

// Products
let productPages = 0;
data.products.forEach((p) => {
  const sku = (p.sku || p.id).replace(/[^A-Za-z0-9_-]/g, '');
  const slug = sku.toLowerCase();
  const imgDataUri = (p.images || [])[0];
  const imageUrl = imgDataUri
    ? siteBaseUrl + 'product-images/' + sku + '-1.' + extFromDataUri(imgDataUri)
    : siteBaseUrl + 'og-image.png';
  const title = p.name + ' - MOSH GIFTS';
  const description = (p.notes && p.notes.trim()) ? p.notes.trim().replace(/\s+/g, ' ').slice(0, 300) : p.name;
  const outDir = path.join(productsOutDir, slug);
  writeSharePage(outDir, title, description, imageUrl, {
    canonical: siteBaseUrl + productsOutDir + '/' + slug + '/',
    target: '/?product=' + encodeURIComponent(sku),
  });
  productPages++;
});

// Categories
const categoryEn = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'translations', 'category-names-en.json'), 'utf8'));
let categoryPages = 0;
(data.categories || []).forEach((cat) => {
  const slug = slugify(categoryEn[cat] || cat);
  const title = cat + ' - MOSH GIFTS';
  const description = 'מתנות בעיצוב אישי בקטגוריית ' + cat + ' - MOSH GIFTS';
  const outDir = path.join(categoriesOutDir, slug);
  writeSharePage(outDir, title, description, siteBaseUrl + 'og-image.png', {
    canonical: siteBaseUrl + categoriesOutDir + '/' + slug + '/',
    target: '/?page=shop&cat=' + encodeURIComponent(cat),
  });
  categoryPages++;
});

console.log('Product share pages written:', productPages);
console.log('Category share pages written:', categoryPages);
