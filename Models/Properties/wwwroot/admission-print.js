(() => {
  const rules = [
    'Students should be punctual and disciplined in the institution.',
    'Students are allowed in class only during their scheduled class time.',
    'If a student damages institutional property, the student is responsible for the resulting damage.',
    'Fees should be paid on time.',
    'A certificate will be provided after course completion and payment of course fees.',
    'Payments made during the course are non-refundable.'
  ];
  const papers = {
    a4p: 'A4 portrait', a4l: 'A4 landscape', a5: 'A5 portrait',
    letter: 'Letter portrait', legal: 'Legal portrait', custom: 'auto'
  };
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[c]);
  const money = (value) => `NPR ${new Intl.NumberFormat('en-NP', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;
  const line = (label, value) => `<div class="line"><span>${esc(label)}</span><b>${esc(value || '')}</b></div>`;

  // The public success page passes the photo it already holds (photoUrl).
  // The admin dashboard passes a saved record; its photo is read from the protected admin endpoint.
  function photoSource(record) {
    if (record.photoUrl) return record.photoUrl;
    if (record.id) return `${location.origin}/api/admin/applications/${encodeURIComponent(record.id)}/photo`;
    return '';
  }

  function formMarkup(record) {
    const payable = Number(record.payableFee ?? record.totalFee) || 0;
    const verified = record.paymentStatus === 'Verified';
    const claimed = Number(record.claimedPaymentAmount ?? record.initialPaidAmount) || 0;
    const paid = verified ? claimed : 0;
    const remaining = Math.max(0, payable - paid);
    const photo = photoSource(record);
    const address = record.address || [record.permanentAddress, record.municipality, record.district, record.province].filter(Boolean).join(', ');
    const dateText = record.admissionDate || (record.submittedAt ? new Date(record.submittedAt).toLocaleDateString() : '');
    const claimNote = claimed > 0 && !verified
      ? `<p class="claim">Payment claim ${esc(money(claimed))}: ${record.paymentStatus === 'Rejected' ? 'rejected' : 'waiting for the institute to check'}.</p>`
      : '';
    return `<article class="sheet">
      <header class="head"><img class="logo" src="${esc(location.origin)}/assets/butwal-skills-logo.png" alt="Butwal Skills Training Institute logo"><div class="inst"><h1>Butwal Skills<br><span>Training Institute</span></h1><p class="tag">Skill for Better Tomorrow</p><p class="addr">Butwal-8, Milanchowk, Rupandehi, Nepal</p></div><div class="motto">Learn Skills<br>Build Your Future</div></header>
      <div class="banner">ADMISSION FORM</div>
      <div class="body">
        <div class="lines">
          ${line('No.', record.applicationNumber || record.admissionNumber || '')}
          ${line('Name', record.fullName)}
          ${line("Father's Name", record.fatherName)}
          ${line('Date of Birth', record.dateOfBirth)}
          ${line('Address', address)}
          ${line('Qualification', record.qualification || record.highestQualification)}
          ${line('Contact No.', record.mobileNumber)}
          ${line('Time', record.classTime || record.preferredClassTime)}
          ${line('Course', record.courseName || record.course)}
        </div>
        <div class="photo-box">${photo ? `<img class="photo" src="${esc(photo)}" alt="Student photo">` : '<span>Passport size photo</span>'}</div>
      </div>
      <table class="fees"><tbody>
        <tr><th>Total Fee</th><td>${esc(money(payable))}</td></tr>
        <tr><th>Paid Fee</th><td>${esc(money(paid))}</td></tr>
        <tr><th>Remaining Fee</th><td>${esc(money(remaining))}</td></tr>
      </tbody></table>
      ${claimNote}
      <section class="rules"><h3>Rules &amp; Regulations</h3><ol>${rules.map((rule) => `<li>${esc(rule)}</li>`).join('')}</ol></section>
      <footer class="signatures"><div><span></span><b>Student Signature</b></div><div><span>${esc(dateText)}</span><b>Date</b></div><div><span></span><b>Class Teacher / Stamp</b></div></footer>
    </article>`;
  }

  const css = `*{box-sizing:border-box}body{margin:0;background:#e4ecf6;color:#14233b;font:12.5px/1.4 Arial,Helvetica,sans-serif}
.toolbar{position:sticky;top:0;z-index:2;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:10px 16px;background:#12347a;color:#fff}
.toolbar label{display:flex;gap:8px;align-items:center}.toolbar select,.toolbar button{min-height:38px;padding:6px 12px;border:0;border-radius:6px;font:inherit}
.toolbar button{background:#f0b429;color:#12347a;font-weight:700;cursor:pointer}.hint{margin-left:auto;font-size:12px}
.sheet{width:190mm;min-height:270mm;margin:16px auto;padding:9mm 10mm;background:#fff;border:1px solid #c8d8ec;break-after:page;page-break-after:always}
.sheet:last-child{break-after:auto;page-break-after:auto}
.head{display:flex;align-items:center;gap:14px}.logo{width:26mm;height:auto}.inst{flex:1}
.inst h1{margin:0;color:#12347a;font-size:21px;line-height:1.05;text-transform:uppercase}.inst h1 span{color:#1d5fa8}
.tag{margin:5px 0 2px;color:#12347a;font-style:italic;font-weight:700}.addr{margin:0;color:#5b6b82;font-size:11px}
.motto{align-self:stretch;display:flex;align-items:center;padding:8px 12px 8px 30px;background:#12347a;color:#fff;font-style:italic;font-size:14px;clip-path:polygon(22% 0,100% 0,100% 100%,0 100%)}
.banner{margin:10px 0 14px;padding:7px;background:#12347a;color:#fff;text-align:center;font-size:17px;font-weight:700;letter-spacing:.07em;clip-path:polygon(2.5% 0,97.5% 0,100% 100%,0 100%)}
.body{display:grid;grid-template-columns:1fr 35mm;gap:8mm;align-items:start}
.line{display:grid;grid-template-columns:30mm 1fr;align-items:end;gap:6px;min-height:10.5mm;border-bottom:1.5px dotted #6f8fb8}
.line span{color:#12347a;font-weight:700}.line b{font-weight:600;overflow-wrap:anywhere}
.photo-box{width:35mm;height:45mm;border:2px solid #1d5fa8;display:grid;place-items:center;text-align:center;color:#8b98aa;font-size:10px;overflow:hidden}
.photo-box img{width:100%;height:100%;object-fit:cover;display:block}
.fees{margin:7mm 0 0 auto;width:72mm;border-collapse:collapse;border:2px solid #1d5fa8}
.fees th,.fees td{padding:5px 8px;border-bottom:1px solid #b9cde6;text-align:left}.fees th{width:50%;background:#eaf2fc;color:#12347a;border-right:2px solid #1d5fa8}
.fees td{text-align:right;font-weight:700}.fees tr:last-child th,.fees tr:last-child td{border-bottom:0}
.claim{margin:4px 0 0;text-align:right;color:#7a5a05;font-size:10.5px}
.rules{margin-top:7mm;border:2px solid #1d5fa8;border-radius:5px;overflow:hidden}.rules h3{margin:0;padding:6px 10px;background:#12347a;color:#fff;font-size:13px}
.rules ol{margin:0;padding:8px 12px;list-style:none;counter-reset:r}.rules li{position:relative;counter-increment:r;padding:3px 0 3px 28px;font-size:11px}
.rules li::before{content:counter(r);position:absolute;left:0;top:2px;width:19px;height:19px;border-radius:50%;background:#12347a;color:#fff;display:grid;place-items:center;font-weight:700;font-size:10px}
.signatures{display:grid;grid-template-columns:1fr .7fr 1fr;gap:16px;margin-top:16mm}.signatures div{text-align:center}
.signatures span{display:block;min-height:22px;padding-bottom:2px;border-bottom:1px solid #6f8fb8;font-size:11px}.signatures b{display:block;padding-top:4px;font-size:10.5px}
@media print{body{background:#fff}.toolbar{display:none}.sheet{width:auto;min-height:0;margin:0;padding:0;border:0}.sheet:not(:last-child){break-after:page;page-break-after:always}}
@media(max-width:700px){.toolbar{position:static}.hint{width:100%;margin:0}.sheet{width:calc(100% - 16px);min-height:0;margin:8px;padding:14px}.body{grid-template-columns:1fr}.photo-box{margin:0 auto}.motto{display:none}}`;

  function open(records, targetWindow = null) {
    const popup = targetWindow || window.open('', '_blank', 'popup,width=900,height=1000');
    if (!popup) return false;
    const forms = records.map(formMarkup).join('');
    popup.document.open();
    // No inline script: the page's content security policy blocks it, so the controls are wired from here.
    popup.document.write(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Admission Form</title><style>${css}</style><style id="pageSize">@page{size:A4 portrait;margin:10mm}</style></head><body><div class="toolbar"><label>Paper size <select id="paperSize"><option value="a4p">A4 portrait</option><option value="a4l">A4 landscape</option><option value="a5">A5</option><option value="letter">Letter</option><option value="legal">Legal</option><option value="custom">Printer's own size</option></select></label><button id="printButton" type="button">Print or save as PDF</button><span class="hint">In the print window you can preview, print, or choose Save as PDF.</span></div>${forms}</body></html>`);
    popup.document.close();
    const sizeStyle = popup.document.getElementById('pageSize');
    const select = popup.document.getElementById('paperSize');
    select.addEventListener('change', () => { sizeStyle.textContent = `@page{size:${papers[select.value]};margin:10mm}`; });
    popup.document.getElementById('printButton').addEventListener('click', () => popup.print());
    popup.document.querySelectorAll('img.photo').forEach((image) => {
      const drop = () => { const box = image.parentElement; image.remove(); if (box) box.textContent = 'Passport size photo'; };
      image.addEventListener('error', drop);
      if (image.complete && image.naturalWidth === 0) drop();
    });
    return true;
  }

  window.BstiAdmissionPrint = { open };
})();
