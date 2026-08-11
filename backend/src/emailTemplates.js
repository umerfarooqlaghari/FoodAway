const { brandName, tagline, logoUrl, logoCreamUrl, siteUrl, supportEmail } = require('./config');

function emailLogoBlock({ height = 44, centered = false, variant = 'default' } = {}) {
  const centerStyle = centered ? 'margin-left:auto;margin-right:auto;' : '';
  const textColor = variant === 'cream' ? '#FFFFFF' : '#FF5C00';
  return `<div style="display:inline-block;${centerStyle}margin-bottom:10px;text-align:${centered ? 'center' : 'left'};">
    <span style="font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:28px;font-weight:900;color:${textColor};letter-spacing:-0.5px;text-decoration:none;">
      ${brandName} <span style="font-size:24px;vertical-align:middle;">🍃</span>
    </span>
  </div>`;
}

function emailOrangeHeader(subtitle = '') {
  return `
    <div style="background:linear-gradient(135deg,#FF5C00 0%,#E55200 100%);padding:28px 32px;border-radius:8px 8px 0 0;text-align:center;">
      ${emailLogoBlock({ height: 48, centered: true, variant: 'cream' })}
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
      <p style="font-size:14px;color:#666;">Need help? Contact us at <a href="mailto:${supportEmail}" style="color:#FF5C00;">${supportEmail}</a>.</p>`,
  });
}

function emailCustomerWelcomeLayout({ name }) {
  return emailSimpleLayout({
    title: 'Welcome to Grabengo!',
    bodyHtml: `
      <p>Hi <strong>${name}</strong>,</p>
      <p>Welcome to <strong>${brandName}</strong>! Your account has been successfully created.</p>
      <p>Start exploring nearby stores, saving surplus food, and ordering delicious meals & surprise bags today.</p>
      <p style="font-size:14px;color:#666;margin-top:20px;">If you have any questions, reach out to us at <a href="mailto:${supportEmail}" style="color:#FF5C00;">${supportEmail}</a>.</p>`,
  });
}

module.exports = {
  emailLogoBlock,
  emailOrangeHeader,
  emailFooter,
  emailSimpleLayout,
  emailSellerWelcomeLayout,
  emailCustomerWelcomeLayout,
  supportEmail,
};
