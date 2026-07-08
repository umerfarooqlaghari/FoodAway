const { brandName, tagline, logoUrl, siteUrl, supportEmail } = require('./config');

function emailLogoBlock({ height = 44, centered = false } = {}) {
  const centerStyle = centered ? 'margin-left:auto;margin-right:auto;' : '';
  if (logoUrl) {
    return `<img src="${logoUrl}" alt="${brandName}" height="${height}" style="display:block;${centerStyle}margin-bottom:12px;" onerror="this.style.display='none'" />`;
  }
  return `<h1 style="color:#FF5A00;margin:0 0 12px;font-size:26px;font-weight:700;${centered ? 'text-align:center;' : ''}">${brandName}</h1>`;
}

function emailOrangeHeader(subtitle = '') {
  return `
    <div style="background:linear-gradient(135deg,#FF5A00 0%,#FF8A00 100%);padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">
      ${emailLogoBlock({ height: 48, centered: true })}
      ${subtitle ? `<p style="color:#ffe0cc;margin:4px 0 0;font-size:13px;">${subtitle}</p>` : ''}
    </div>`;
}

function emailFooter({ dark = false } = {}) {
  const color = dark ? '#9ca3af' : '#aaa';
  const host = siteUrl.replace(/^https?:\/\//, '');
  return `<p style="margin:0;color:${color};font-size:12px;">© ${new Date().getFullYear()} ${brandName} — ${tagline} · <a href="${siteUrl}" style="color:${color};">${host}</a></p>`;
}

function emailSimpleLayout({ title, bodyHtml }) {
  return `
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;">
      ${emailOrangeHeader(title)}
      <div style="background:#fff;padding:24px 32px;border:1px solid #eee;border-top:none;color:#333;line-height:1.6;">
        ${bodyHtml}
      </div>
      <div style="background:#f5f5f5;padding:14px 32px;text-align:center;border-radius:0 0 8px 8px;">
        ${emailFooter()}
      </div>
    </div>`;
}

function emailSellerWelcomeLayout({ brandName: storeName }) {
  return emailSimpleLayout({
    title: 'Your store is ready!',
    bodyHtml: `
      <p>Hi <strong>${storeName}</strong>,</p>
      <p>Your store has been onboarded onto ${brandName}. You can now log in with the ${brandName} mobile app to manage your stores, orders, and inventory.</p>
      <p style="font-size:14px;color:#666;">Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#FF5A00;">${supportEmail}</a>.</p>`,
  });
}

module.exports = {
  emailLogoBlock,
  emailOrangeHeader,
  emailFooter,
  emailSimpleLayout,
  emailSellerWelcomeLayout,
  supportEmail,
};
