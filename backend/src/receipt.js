const PDFDocument = require('pdfkit');

const ORANGE = '#FF5A00';
const DARK   = '#1a1a1a';
const GREY   = '#555555';
const LIGHT  = '#f5f5f5';
const CURRENCY = '£';

/**
 * Generates a PDF receipt buffer.
 *
 * @param {Array}  orders       Array of order objects:
 *   { id, item_name, store_name, type, quantity, price, pickup_time, created_at }
 * @param {Object} customer     { name, email, phone }
 * @returns {Promise<Buffer>}   PDF file as a Buffer
 */
function generateReceiptBuffer(orders, customer = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4', autoFirstPage: true });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end',  () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const pageWidth  = doc.page.width;
    const innerWidth = pageWidth - 100; // left + right margin = 100
    const total = orders.reduce((s, o) => s + (Number(o.price) * (o.quantity || 1)), 0);
    const refNos = orders.map(o => `#${o.id}`).join(', ');
    const date   = orders[0]?.created_at
      ? new Date(orders[0].created_at).toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' })
      : new Date().toLocaleString('en-GB', { dateStyle: 'long', timeStyle: 'short' });

    // ── Header band ───────────────────────────────────────────────────────────
    doc.rect(0, 0, pageWidth, 110).fill(ORANGE);

    doc.fillColor('#ffffff')
       .fontSize(28).font('Helvetica-Bold')
       .text('FoodAway', 50, 28, { align: 'left' });

    doc.fontSize(11).font('Helvetica')
       .text('Reducing food waste, one meal at a time.', 50, 62, { align: 'left' });

    doc.fontSize(20).font('Helvetica-Bold')
       .text('ORDER RECEIPT', 0, 36, { align: 'right', width: pageWidth - 50 });

    doc.fontSize(10).font('Helvetica')
       .text(`Ref: ${refNos}`, 0, 62, { align: 'right', width: pageWidth - 50 });

    // ── Customer & date info ──────────────────────────────────────────────────
    doc.moveDown(0);
    let y = 130;

    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
       .text('BILLED TO', 50, y);
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
       .text(customer.name  || 'Guest',       50, y + 14)
       .text(customer.email || '',             50, y + 27)
       .text(customer.phone || '',             50, y + 40);

    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
       .text('ORDER DATE',                     pageWidth / 2, y);
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
       .text(date,                             pageWidth / 2, y + 14, { width: pageWidth / 2 - 50 });

    doc.fillColor(DARK).fontSize(10).font('Helvetica-Bold')
       .text('PAYMENT METHOD',                 pageWidth / 2, y + 36);
    doc.fillColor(GREY).font('Helvetica').fontSize(10)
       .text(orders[0]?.payment_method || 'Cash at Pickup', pageWidth / 2, y + 50, { width: pageWidth / 2 - 50 });

    // ── Divider ───────────────────────────────────────────────────────────────
    y += 80;
    doc.moveTo(50, y).lineTo(pageWidth - 50, y).strokeColor('#e0e0e0').lineWidth(1).stroke();

    // ── Table header ──────────────────────────────────────────────────────────
    y += 14;
    doc.rect(50, y, innerWidth, 24).fill(LIGHT);

    const col = { item: 50, store: 220, qty: 350, price: 400, total: 460, pickup: 510 };
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(9);
    doc.text('ITEM',         col.item,  y + 8);
    doc.text('STORE',        col.store, y + 8);
    doc.text('QTY',          col.qty,   y + 8, { width: 40, align: 'center' });
    doc.text('UNIT',         col.price, y + 8, { width: 50, align: 'right' });
    doc.text('TOTAL',        col.total, y + 8, { width: 50, align: 'right' });
    doc.text('PICKUP',       col.pickup, y + 8, { width: 80 });

    // ── Table rows ────────────────────────────────────────────────────────────
    y += 24;
    doc.font('Helvetica').fontSize(9).fillColor(DARK);

    orders.forEach((o, idx) => {
      if (idx % 2 === 0) {
        doc.rect(50, y, innerWidth, 22).fill('#fafafa');
      }
      const itemName  = o.item_name  || (o.type === 'bag' ? 'Surprise Bag' : 'Food Item');
      const storeName = o.store_name || '';
      const qty       = o.quantity || 1;
      const unitPrice = Number(o.price);
      const lineTotal = unitPrice * qty;
      const pickup    = o.pickup_time || 'Opening hours';

      doc.fillColor(DARK);
      doc.text(itemName,                            col.item,  y + 7, { width: 165, lineBreak: false });
      doc.text(storeName,                           col.store, y + 7, { width: 125, lineBreak: false });
      doc.text(String(qty),                         col.qty,   y + 7, { width: 40,  align: 'center', lineBreak: false });
      doc.text(`${CURRENCY}${unitPrice.toFixed(2)}`,col.price, y + 7, { width: 50,  align: 'right',  lineBreak: false });
      doc.text(`${CURRENCY}${lineTotal.toFixed(2)}`,col.total, y + 7, { width: 50,  align: 'right',  lineBreak: false });
      doc.text(pickup,                              col.pickup,y + 7, { width: 82,  lineBreak: false });

      // Row bottom border
      doc.moveTo(50, y + 22).lineTo(pageWidth - 50, y + 22)
         .strokeColor('#eeeeee').lineWidth(0.5).stroke();
      y += 22;
    });

    // ── Total band ────────────────────────────────────────────────────────────
    y += 12;
    doc.rect(50, y, innerWidth, 36).fill(ORANGE);
    doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(13)
       .text('TOTAL AMOUNT',               50,  y + 11)
       .text(`${CURRENCY}${total.toFixed(2)}`, 0, y + 11, { align: 'right', width: pageWidth - 50 });

    // ── Notice box ────────────────────────────────────────────────────────────
    y += 52;
    doc.rect(50, y, innerWidth, 52).fillAndStroke('#fff8f5', '#ffe0cc');
    doc.fillColor(ORANGE).font('Helvetica-Bold').fontSize(9)
       .text('IMPORTANT', 62, y + 10);
    doc.fillColor(GREY).font('Helvetica').fontSize(9)
       .text('Please present this receipt at the store when collecting your order.', 62, y + 22, { width: innerWidth - 24 })
       .text('Payment is cash only at pickup. Keep this receipt as proof of purchase.', 62, y + 34, { width: innerWidth - 24 });

    // ── Footer ────────────────────────────────────────────────────────────────
    const footerY = doc.page.height - 50;
    doc.moveTo(50, footerY - 12).lineTo(pageWidth - 50, footerY - 12)
       .strokeColor('#e0e0e0').lineWidth(0.5).stroke();
    doc.fillColor('#aaaaaa').font('Helvetica').fontSize(8)
       .text(`© ${new Date().getFullYear()} FoodAway — Reducing food waste, one meal at a time.`, 50, footerY - 4, { align: 'center', width: innerWidth });

    doc.end();
  });
}

module.exports = { generateReceiptBuffer };
