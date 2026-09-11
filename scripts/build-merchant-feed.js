// Rebuilds product-images/ and google-merchant-feed.xml from the product data
// embedded in index.html. Run this after any Site 1 -> Site 2 sync that
// changes products, so the Google Merchant Center feed (which auto-fetches
// google-merchant-feed.xml every 24h) and the public product image files stay
// in sync with the catalog.
//
// Usage:  node scripts/build-merchant-feed.js index.html product-images google-merchant-feed.xml
//
// Note: run this from the site root (C:\Users\PC\Desktop\עסק\4.אתר\אתר) so the
// relative output paths land in the right place, then commit+push the
// product-images/ and google-merchant-feed.xml changes like any other deploy.

const fs = require('fs');
const path = require('path');

const sitePath = process.argv[2];
const imagesOutDir = process.argv[3];
const feedOutPath = process.argv[4];
const siteBaseUrl = 'https://mosh-gifts1.netlify.app/';

const content = fs.readFileSync(sitePath, 'utf8');
const marker = '<script id="sf-data" type="application/json">';
const start = content.indexOf(marker) + marker.length;
const end = content.indexOf('</script>', start);
const data = JSON.parse(content.slice(start, end));

if (!fs.existsSync(imagesOutDir)) fs.mkdirSync(imagesOutDir, { recursive: true });

function extFromMime(mime) {
  if (mime.indexOf('png') !== -1) return 'png';
  if (mime.indexOf('webp') !== -1) return 'webp';
  return 'jpg';
}

function xmlEsc(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

let totalImagesWritten = 0;
let skippedNoImage = 0;
const items = [];

data.products.forEach((p) => {
  const sku = (p.sku || p.id).replace(/[^A-Za-z0-9_-]/g, '');
  const imgs = p.images || [];
  const publicImageUrls = [];

  imgs.forEach((dataUri, idx) => {
    const m = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUri);
    if (!m) return;
    const mime = m[1];
    const b64 = m[2];
    const ext = extFromMime(mime);
    const filename = sku + '-' + (idx + 1) + '.' + ext;
    const filePath = path.join(imagesOutDir, filename);
    fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
    totalImagesWritten++;
    publicImageUrls.push(siteBaseUrl + 'product-images/' + filename);
  });

  if (!publicImageUrls.length) { skippedNoImage++; return; }

  const price = Number(p.salePrice) > 0 ? Number(p.salePrice) : Number(p.price) || 0;
  const link = siteBaseUrl + '?product=' + encodeURIComponent(p.sku || p.id);
  const description = (p.notes && p.notes.trim()) ? p.notes.trim() : p.name;
  const availability = p.outOfStock ? 'out of stock' : 'in stock';

  items.push({
    id: sku,
    title: p.name,
    description: description,
    link: link,
    image_link: publicImageUrls[0],
    additional_image_links: publicImageUrls.slice(1, 11),
    availability: availability,
    price: price.toFixed(2) + ' ILS',
    condition: 'new',
  });
});

let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
xml += '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">\n';
xml += '<channel>\n';
xml += '<title>MOSH GIFTS - Product Feed</title>\n';
xml += '<link>' + siteBaseUrl + '</link>\n';
xml += '<description>MOSH GIFTS product catalog for Google Merchant Center</description>\n';

items.forEach((it) => {
  xml += '<item>\n';
  xml += '<g:id>' + xmlEsc(it.id) + '</g:id>\n';
  xml += '<title>' + xmlEsc(it.title) + '</title>\n';
  xml += '<description>' + xmlEsc(it.description) + '</description>\n';
  xml += '<link>' + xmlEsc(it.link) + '</link>\n';
  xml += '<g:image_link>' + xmlEsc(it.image_link) + '</g:image_link>\n';
  it.additional_image_links.forEach((u) => {
    xml += '<g:additional_image_link>' + xmlEsc(u) + '</g:additional_image_link>\n';
  });
  xml += '<g:availability>' + it.availability + '</g:availability>\n';
  xml += '<g:price>' + it.price + '</g:price>\n';
  xml += '<g:condition>' + it.condition + '</g:condition>\n';
  xml += '<g:brand>MOSH GIFTS</g:brand>\n';
  xml += '<g:identifier_exists>no</g:identifier_exists>\n';
  xml += '<g:shipping>\n<g:country>IL</g:country>\n<g:service>Standard shipping</g:service>\n<g:price>45.00 ILS</g:price>\n<g:min_handling_time>1</g:min_handling_time>\n<g:max_handling_time>5</g:max_handling_time>\n<g:min_transit_time>1</g:min_transit_time>\n<g:max_transit_time>5</g:max_transit_time>\n</g:shipping>\n';
  xml += '<g:shipping>\n<g:country>IL</g:country>\n<g:service>' + xmlEsc('איסוף עצמי') + '</g:service>\n<g:price>0.00 ILS</g:price>\n<g:min_handling_time>1</g:min_handling_time>\n<g:max_handling_time>5</g:max_handling_time>\n<g:min_transit_time>1</g:min_transit_time>\n<g:max_transit_time>5</g:max_transit_time>\n</g:shipping>\n';
  xml += '</item>\n';
});

xml += '</channel>\n</rss>\n';

fs.writeFileSync(feedOutPath, xml, 'utf8');

console.log('Products total:', data.products.length);
console.log('Products with no images (skipped from feed):', skippedNoImage);
console.log('Products included in feed:', items.length);
console.log('Images written to disk:', totalImagesWritten);
console.log('Feed written to:', feedOutPath);
