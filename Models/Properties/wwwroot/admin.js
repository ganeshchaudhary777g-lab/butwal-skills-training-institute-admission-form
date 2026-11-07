const $ = (id) => document.getElementById(id);
const npr = (value) => `NPR ${new Intl.NumberFormat('en-NP', { maximumFractionDigits: 0 }).format(value)}`;
let requestToken = '';
let currentPage = 1;
let totalPages = 1;
let currentDetails = null;
const selectedApplicationIds = new Set();

function cell(parent, tag, text, cls) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  el.textContent = text ?? '';
  parent.append(el);
  return el;
}
async function refreshToken() {
  const response = await fetch('/api/security/token', { credentials: 'same-origin' });
  if (response.ok) requestToken = (await response.json()).requestToken;
}
async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.method && options.method !== 'GET') {
    if (!requestToken) await refreshToken();
    headers.set('X-CSRF-TOKEN', requestToken);
  }
  if (options.body && typeof options.body !== 'string') {
    headers.set('Content-Type', 'application/json'); options.body = JSON.stringify(options.body);
  }
  const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(data?.error || data?.title || (response.status === 401 ? 'Session expired. Sign in again.' : 'The request could not be completed.'));
    error.status = response.status; throw error;
  }
  return data;
}
function showMessage(element, message, error = true) {
  element.hidden = false; element.className = `form-message ${error ? 'error' : 'success'}`; element.textContent = message;
}
function showAdminNotice(message, isError = false) {
  const box = $('adminNotice'); box.textContent = message; box.hidden = false;
  box.style.background = isError ? '#fff0ef' : '#edf8f2'; box.style.color = isError ? '#9d302a' : '#176e4e';
  window.setTimeout(() => { box.hidden = true; }, 6000);
}

async function startSession() {
  try {
    const user = await api('/api/admin/me');
    $('loginView').hidden = true; $('dashboardView').hidden = false; $('logoutButton').hidden = false;
    $('welcomeText').textContent = `Signed in as ${user.username}. Check the institute account/official receipt before marking a manual payment Verified.`;
    await Promise.all([loadSummary(), loadApplications(), loadCourses(), loadAudit()]);
  } catch {
    $('loginView').hidden = false; $('dashboardView').hidden = true; $('logoutButton').hidden = true;
  }
}

$('loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget; if (!form.reportValidity()) return;
  const data = Object.fromEntries(new FormData(form).entries());
  try {
    await api('/api/admin/login', { method: 'POST', body: data });
    form.reset(); $('loginMessage').hidden = true;
    // The CSRF token is tied to the signed-in user, so fetch a new one after login.
    requestToken = ''; await refreshToken();
    await startSession();
  } catch (error) { showMessage($('loginMessage'), error.status === 429 ? 'Too many attempts. Wait before trying again.' : 'Sign-in failed. Check the username and password.'); }
});

$('logoutButton').addEventListener('click', async () => {
  try { await api('/api/admin/logout', { method: 'POST' }); }
  catch { /* A timed-out session is already signed out. */ }
  requestToken = '';
  $('loginView').hidden = false; $('dashboardView').hidden = true; $('logoutButton').hidden = true;
});

async function loadSummary() {
  const summary = await api('/api/admin/summary');
  const cards = [
    ['Applications', summary.totalApplications], ['Pending review', summary.pendingApplications],
    ['Approved', summary.approvedApplications], ['Rejected', summary.rejectedApplications],
    ['Payments pending', summary.pendingPayments], ['Payments verified', summary.verifiedPayments]
  ];
  const root = $('summaryCards'); root.replaceChildren();
  cards.forEach(([label, value]) => { const card = document.createElement('div'); card.className = 'summary-card'; cell(card, 'span', label); cell(card, 'b', String(value)); root.append(card); });
}

async function loadApplications(page = currentPage) {
  currentPage = page;
  const params = new URLSearchParams({ page: String(page) });
  const filters = Object.fromEntries(new FormData($('filterForm')).entries());
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  const result = await api(`/api/admin/applications?${params}`);
  const tbody = $('applicationRows'); tbody.replaceChildren();
  totalPages = Math.max(1, Math.ceil(result.totalRows / result.pageSize));
  $('pageLabel').textContent = `Page ${result.page} of ${totalPages} · ${result.totalRows} record(s)`;
  $('prevPage').disabled = result.page <= 1; $('nextPage').disabled = result.page >= totalPages;
  if (!result.rows.length) { const tr = tbody.insertRow(); const td = tr.insertCell(); td.colSpan = 8; td.textContent = 'No applications match these filters.'; return; }
  for (const item of result.rows) {
    const tr = tbody.insertRow(); tr.dataset.id = item.id;
    const selectCell = tr.insertCell(); const checkbox = document.createElement('input'); checkbox.type = 'checkbox'; checkbox.className = 'application-select'; checkbox.value = String(item.id); checkbox.checked = selectedApplicationIds.has(item.id); checkbox.setAttribute('aria-label', `Select ${item.applicationNumber} for printing`); selectCell.append(checkbox);
    const appCell = tr.insertCell(); cell(appCell, 'b', item.applicationNumber);
    const studentCell = tr.insertCell(); cell(studentCell, 'span', item.fullName); cell(studentCell, 'small', item.mobileNumber);
    const courseCell = tr.insertCell(); cell(courseCell, 'span', item.courseName); cell(courseCell, 'small', npr(item.payableFee));
    const statusCell = tr.insertCell();
    const appSelect=document.createElement('select');appSelect.dataset.statusSelect='application';
    ['Submitted','Approved','Rejected','Needs More Information'].forEach((status)=>{const option=new Option(status,status);option.selected=status===item.applicationStatus;appSelect.add(option)});
    statusCell.append(appSelect);const appSave=cell(statusCell,'button','Save','table-button');appSave.type='button';appSave.dataset.action='application-status';appSave.dataset.id=item.id;
    const paymentCell = tr.insertCell();
    const paySelect=document.createElement('select');paySelect.dataset.statusSelect='payment';
    ['Unpaid','Pending Verification','Verified','Rejected'].forEach((status)=>{const option=new Option(status,status);option.selected=status===item.paymentStatus;paySelect.add(option)});
    paymentCell.append(paySelect);const paySave=cell(paymentCell,'button','Save','table-button');paySave.type='button';paySave.dataset.action='payment-status';paySave.dataset.id=item.id;
    const dateCell = tr.insertCell(); dateCell.textContent = new Date(item.submittedAt).toLocaleDateString();
    const viewCell = tr.insertCell(); const view = cell(viewCell, 'button', 'View', 'table-button'); view.type = 'button'; view.dataset.action = 'view'; view.dataset.id = item.id;
  }
}

$('filterForm').addEventListener('submit', async (event) => { event.preventDefault(); try { await loadApplications(1); } catch (e) { showAdminNotice(e.message, true); } });
$('refreshButton').addEventListener('click', async () => { try { await Promise.all([loadSummary(), loadApplications()]); showAdminNotice('Application records refreshed.'); } catch (e) { showAdminNotice(e.message, true); } });
$('prevPage').addEventListener('click', async () => { if (currentPage > 1) await loadApplications(currentPage - 1).catch((e) => showAdminNotice(e.message, true)); });
$('nextPage').addEventListener('click', async () => { if (currentPage < totalPages) await loadApplications(currentPage + 1).catch((e) => showAdminNotice(e.message, true)); });
$('applicationRows').addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  try {
    if(button.dataset.action==='view'){currentDetails = await api(`/api/admin/applications/${button.dataset.id}`); renderDetails(currentDetails); $('detailsDialog').showModal();}
    if(button.dataset.action==='application-status'){const select=button.parentElement.querySelector('[data-status-select="application"]');await changeApplication(Number(button.dataset.id),select.value);}
    if(button.dataset.action==='payment-status'){const select=button.parentElement.querySelector('[data-status-select="payment"]');await changePayment(Number(button.dataset.id),select.value);}
  } catch (e) { showAdminNotice(e.message, true); }
});
$('applicationRows').addEventListener('change', (event) => {
  const checkbox = event.target.closest('.application-select'); if (!checkbox) return;
  const id = Number(checkbox.value);
  if (checkbox.checked) selectedApplicationIds.add(id); else selectedApplicationIds.delete(id);
  $('printSelected').textContent = `Print selected (${selectedApplicationIds.size})`;
  $('printSelected').disabled = selectedApplicationIds.size === 0;
});

function renderDetails(data) {
  const root = $('detailsContent'); root.replaceChildren();
  const fields = [
    ['Application number', data.applicationNumber], ['Submitted (UTC)', new Date(data.submittedAt).toISOString().replace('T', ' ').replace('Z', '')],
    ['Application status', data.applicationStatus], ['Payment status', data.paymentStatus], ['Payment record updated', new Date(data.paymentUpdatedAt).toLocaleString()], ['Full name', data.fullName], ["Father's name", data.fatherName],
    ['Date of birth', data.dateOfBirth], ['Gender', data.gender], ['Mobile number', data.mobileNumber], ['Email', data.email || 'Not supplied'],
    ['Permanent address', data.permanentAddress], ['Current address', data.currentAddress || 'Same / not supplied'],
    ['Municipality', data.municipality], ['District', data.district], ['Province', data.province],
    ['Highest qualification', data.highestQualification], ['School / college', data.schoolCollege || 'Not supplied'],
    ['Passed year', data.passedYear ?? 'Not supplied'], ['Preferred class time', data.preferredClassTime || 'To be confirmed'], ['Emergency contact', data.emergencyContactName],
    ['Relationship', data.emergencyRelationship], ['Emergency phone', data.emergencyContactNumber], ['Course', data.courseName],
    ['Original fee', npr(data.originalFee)], ['Discount', `${data.discountPercent}% · ${npr(data.discountAmount)}`],
    ['Payable fee', npr(data.payableFee)], ['Amount claimed', npr(data.claimedPaymentAmount)], ['Payment method', data.paymentMethod],
    ['Transaction reference', data.transactionReference || 'Not supplied']
  ];
  const photo = document.createElement('img'); photo.className = 'detail-photo'; photo.alt = 'Student photo'; photo.src = `/api/admin/applications/${encodeURIComponent(data.id)}/photo`;
  photo.addEventListener('error', () => photo.remove());
  root.append(photo);
  const grid = document.createElement('div'); grid.className = 'detail-grid';
  fields.forEach(([label, value]) => { const item = document.createElement('div'); item.className = 'detail-item'; cell(item, 'small', label); cell(item, 'b', String(value)); grid.append(item); }); root.append(grid);
  if (data.offerNeedsConfirmation) cell(root, 'p', 'This course offer is subject to institute confirmation.', 'offer-flag');
}
$('closeDetails').addEventListener('click', () => $('detailsDialog').close());
$('closeDetailsBottom').addEventListener('click', () => $('detailsDialog').close());
$('editStudentButton').addEventListener('click', () => {
  if (!currentDetails) return;
  const form = $('editStudentForm');
  for (const key of ['fullName','fatherName','dateOfBirth','gender','mobileNumber','email','permanentAddress','currentAddress','municipality','district','province','highestQualification','preferredClassTime'])
    form.elements[key].value = currentDetails[key] ?? '';
  $('detailsContent').hidden = true; form.hidden = false;
});
$('cancelStudentEdit').addEventListener('click', () => { $('editStudentForm').hidden = true; $('detailsContent').hidden = false; });
$('editStudentForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity() || !currentDetails) return;
  const values = new FormData(form);
  const update = Object.fromEntries(values.entries());
  try {
    await api(`/api/admin/applications/${currentDetails.id}/student`, { method: 'PUT', body: update });
    currentDetails = await api(`/api/admin/applications/${currentDetails.id}`);
    form.hidden = true; $('detailsContent').hidden = false; renderDetails(currentDetails);
    await Promise.all([loadApplications(), loadAudit()]); showAdminNotice('Student details updated and recorded in the audit log.');
  } catch (error) { showAdminNotice(error.message, true); }
});
$('printDetails').addEventListener('click', () => {
  if (!currentDetails) return;
  if (!window.BstiAdmissionPrint?.open([currentDetails])) showAdminNotice('Allow pop-ups for this site to open the print preview.', true);
});

$('printSelected').addEventListener('click', async () => {
  const ids = [...selectedApplicationIds]; if (!ids.length) return;
  const popup = window.open('', '_blank', 'popup,width=900,height=1000');
  if (!popup) { showAdminNotice('Allow pop-ups for this site to open the print preview.', true); return; }
  try {
    const details = await Promise.all(ids.map((id) => api(`/api/admin/applications/${id}`)));
    if (!window.BstiAdmissionPrint?.open(details, popup)) throw new Error('Print preview could not be opened.');
  } catch (error) { popup.close(); showAdminNotice(error.message, true); }
});

async function changeApplication(id, status) {
  const note = window.prompt('Optional internal note for the audit log:', '') ?? '';
  await api(`/api/admin/applications/${id}/status`, { method: 'POST', body: { status, note } });
  await Promise.all([loadApplications(), loadSummary(), loadAudit()]); showAdminNotice(`Application status updated to ${status}.`);
}
async function changePayment(id, status) {
  const text = status === 'Verified' ? 'Confirm you checked the payment against the institute account/official receipt before marking it verified.' : `Change payment status to ${status}?`;
  if (!window.confirm(text)) return;
  const note = window.prompt('Optional internal verification note:', '') ?? '';
  await api(`/api/admin/applications/${id}/payment`, { method: 'POST', body: { status, transactionReference: null, note } });
  await Promise.all([loadApplications(), loadSummary(), loadAudit()]); showAdminNotice(`Payment status updated to ${status}.`);
}

async function loadCourses() {
  const courses = await api('/api/admin/courses'); const root = $('courseAdminList'); root.replaceChildren();
  courses.forEach((course) => {
    const form = document.createElement('form'); form.className = 'course-edit'; form.dataset.id = course.id;
    cell(form, 'h3', course.name);
    const fields = [
      ['Course name','name',course.name,'text'],['Original fee (NPR)','regularFee',course.regularFee,'number'],
      ['Discount (%)','discountPercent',course.discountPercent,'number'],['Advertised fee (NPR)','advertisedFee',course.advertisedFee,'number'],
      ['Course description','description',course.description,'text'],['Topics shown','topics',course.topics,'text']
    ];
    fields.forEach(([label,key,value,type]) => { const wrap=document.createElement('label'); wrap.textContent=label; const input=document.createElement('input'); input.name=key; input.type=type; input.value=value ?? ''; input.maxLength=key==='topics'?600:400; if(type==='number'){input.min='0';input.step='1'} wrap.append(input); form.append(wrap); });
    const active = document.createElement('label'); active.className='checkbox-line'; const check=document.createElement('input'); check.type='checkbox';check.name='active';check.checked=course.active;active.append(check,document.createTextNode('Active'));form.append(active);
    const confirm = document.createElement('label'); confirm.className='checkbox-line'; const confirmCheck=document.createElement('input'); confirmCheck.type='checkbox';confirmCheck.name='requiresConfirmation';confirmCheck.checked=course.needsConfirmation;confirm.append(confirmCheck,document.createTextNode('Offer needs confirmation'));form.append(confirm);
    const confirmText=course.needsConfirmation?'Institute confirmation required for the advertised offer.':`Current client quote (server recalculates): ${npr(Math.round(course.regularFee*(100-course.discountPercent)/100))}`;
    cell(form, 'div', confirmText, 'course-meta');
    const save=cell(form,'button','Save course','button button-primary');save.type='submit';form.addEventListener('submit',async(e)=>{e.preventDefault();const values=new FormData(form);const dto={name:values.get('name'),description:values.get('description'),topics:values.get('topics'),regularFee:Number(values.get('regularFee')),discountPercent:Number(values.get('discountPercent')),advertisedFee:Number(values.get('advertisedFee')),active:values.has('active'),requiresConfirmation:values.has('requiresConfirmation')};try{await api(`/api/admin/courses/${course.id}`,{method:'PUT',body:dto});await Promise.all([loadCourses(),loadAudit()]);showAdminNotice('Course updated. Existing applications retain their saved fee.');}catch(err){showAdminNotice(err.message,true);}});
    root.append(form);
  });
}

$('newCourseForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form=event.currentTarget; if(!form.reportValidity())return;
  const values=new FormData(form); const dto={name:values.get('name'),description:values.get('description')||'',topics:values.get('topics')||'',regularFee:Number(values.get('regularFee')),discountPercent:Number(values.get('discountPercent')),advertisedFee:Number(values.get('advertisedFee')),active:values.has('active'),requiresConfirmation:values.has('requiresConfirmation')};
  try { await api('/api/admin/courses',{method:'POST',body:dto}); form.reset(); form.elements.discountPercent.value='0';form.elements.active.checked=true;await Promise.all([loadCourses(),loadAudit()]);showAdminNotice('Course created.'); }
  catch(error){showAdminNotice(error.message,true);}
});

$('createAdminForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const values = new FormData(form);
  try {
    await api('/api/admin/accounts', { method: 'POST', body: { username: values.get('username'), password: values.get('password') } });
    form.reset(); showAdminNotice('Administrator account created. Store the password securely.');
  } catch (error) { showAdminNotice(error.message, true); }
});
$('resetAdminForm').addEventListener('submit', async (event) => {
  event.preventDefault(); const form = event.currentTarget; if (!form.reportValidity()) return;
  const values = new FormData(form); const username = values.get('username');
  if (!window.confirm(`Reset the password for administrator ${username}?`)) return;
  try {
    await api('/api/admin/accounts/reset-password', { method: 'POST', body: { username, password: values.get('password') } });
    form.reset(); showAdminNotice(`Password reset for ${username}.`);
  } catch (error) { showAdminNotice(error.message, true); }
});

async function loadAudit() {
  const logs=await api('/api/admin/audit');const tbody=$('auditRows');tbody.replaceChildren();
  if(!logs.length){const tr=tbody.insertRow();const td=tr.insertCell();td.colSpan=5;td.textContent='No administrator changes have been recorded.';return;}
  logs.forEach((log)=>{const tr=tbody.insertRow();[new Date(log.at).toISOString().replace('T',' ').replace('Z',''),log.admin,log.action,log.target,log.note||''].forEach((val)=>cell(tr.insertCell(),'span',val,val.length>60?'audit-note':''));});
}

document.querySelectorAll('.admin-tabs button').forEach((button)=>button.addEventListener('click',()=>{
  document.querySelectorAll('.admin-tabs button').forEach((item)=>item.classList.toggle('active',item===button));
  document.querySelectorAll('.admin-panel').forEach((panel)=>panel.hidden=panel.id!==button.dataset.tab);
}));
$('reloadCourses').addEventListener('click',()=>loadCourses().catch(e=>showAdminNotice(e.message,true)));
$('reloadAudit').addEventListener('click',()=>loadAudit().catch(e=>showAdminNotice(e.message,true)));
refreshToken().then(startSession).catch(()=>{ $('loginView').hidden=false; });
