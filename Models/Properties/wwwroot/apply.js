'use strict';
const byId = (id) => document.getElementById(id);
const npr = (value) => `NPR ${new Intl.NumberFormat('en-NP', { maximumFractionDigits: 0 }).format(Number(value) || 0)}`;

const PHOTO_WIDTH = 413;            // 35 mm x 45 mm at about 300 dpi
const PHOTO_HEIGHT = 531;
const PHOTO_MAX_CHARS = 420000;     // about 300 KB once decoded; the server accepts up to 400 KB
const PHOTO_MAX_FILE = 20 * 1024 * 1024;

let courses = [];
let photoDataUrl = '';
let submissionToken = crypto.randomUUID();
let reviewApproved = false;

function safeText(parent, tag, text, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = text ?? '';
  parent.append(node);
  return node;
}

function setMessage(element, text, isError = true) {
  element.hidden = false;
  element.className = `form-message ${isError ? 'error' : 'success'}`;
  element.textContent = text;
}

function formatServerError(data) {
  if (data?.errors) return Object.values(data.errors).flat().join(' ');
  return data?.error || 'The request could not be completed. Please check the details and try again.';
}

/* ---------- Courses and fee ---------- */
function selectedCourse() {
  return courses.find((item) => item.id === Number(byId('courseSelect').value));
}

async function loadCourses() {
  const response = await fetch('/api/courses');
  if (!response.ok) throw new Error('Course list request failed');
  courses = await response.json();
  const select = byId('courseSelect');
  select.replaceChildren(new Option('Select a course', ''));
  courses.forEach((course) => select.add(new Option(course.name, String(course.id))));
}

function renderFee() {
  const course = selectedCourse();
  const paidInput = byId('initialPaidAmount');
  const note = byId('feeNote');
  if (!course) {
    byId('totalFee').textContent = 'Choose a course';
    byId('remainingFee').textContent = '—';
    paidInput.removeAttribute('max');
    paidInput.setCustomValidity('');
    note.textContent = '';
    return;
  }
  const total = course.payableFee;
  const paid = Math.max(0, Number(paidInput.value) || 0);
  paidInput.max = String(total);
  paidInput.setCustomValidity(paid > total ? 'The paid amount cannot be more than the total fee.' : '');
  byId('totalFee').textContent = npr(total);
  byId('remainingFee').textContent = npr(Math.max(0, total - paid));
  note.textContent = course.needsConfirmation
    ? 'The advertised offer for this course is confirmed by the institute.'
    : `Regular fee ${npr(course.regularFee)}, ${course.discountPercent}% discount.`;
}

byId('courseSelect').addEventListener('change', renderFee);
byId('initialPaidAmount').addEventListener('input', renderFee);

byId('paymentMethod').addEventListener('change', (event) => {
  byId('referenceRow').hidden = event.target.value === 'Cash';
  byId('qrOpenButton').hidden = event.target.value !== 'eSewa';
});
const qrDialog = byId('qrDialog');
document.querySelectorAll('[data-qr-open]').forEach((button) => button.addEventListener('click', () => qrDialog.showModal()));
byId('qrClose').addEventListener('click', () => qrDialog.close());
qrDialog.addEventListener('click', (event) => { if (event.target === qrDialog) qrDialog.close(); });

/* ---------- Passport-size photo ---------- */
function readAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); }
    catch { /* Fall back to an <img> element below. */ }
  }
  const url = await readAsDataUrl(file);
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('decode'));
    image.src = url;
  });
}

function toPassportJpeg(source) {
  const width = source.width;
  const height = source.height;
  const ratio = PHOTO_WIDTH / PHOTO_HEIGHT;
  let cropWidth = width;
  let cropHeight = width / ratio;
  if (cropHeight > height) { cropHeight = height; cropWidth = height * ratio; }
  const cropX = (width - cropWidth) / 2;
  const cropY = (height - cropHeight) * 0.2;   // keep the face: crop more from the bottom than the top
  const canvas = document.createElement('canvas');
  canvas.width = PHOTO_WIDTH;
  canvas.height = PHOTO_HEIGHT;
  const context = canvas.getContext('2d');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  context.imageSmoothingQuality = 'high';
  context.drawImage(source, cropX, cropY, cropWidth, cropHeight, 0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
  let quality = 0.9;
  let url = canvas.toDataURL('image/jpeg', quality);
  while (url.length > PHOTO_MAX_CHARS && quality > 0.4) {
    quality -= 0.08;
    url = canvas.toDataURL('image/jpeg', quality);
  }
  return url;
}

function photoProblem(text) {
  const box = byId('photoError');
  box.textContent = text;
  box.hidden = !text;
}

byId('photoButton').addEventListener('click', () => byId('photoInput').click());
byId('photoInput').addEventListener('change', async (event) => {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;
  photoProblem('');
  if (!file.type.startsWith('image/') || file.size > PHOTO_MAX_FILE) {
    photoProblem('Choose a photo (JPG or PNG) smaller than 20 MB.');
    return;
  }
  try {
    const image = await decodeImage(file);
    photoDataUrl = toPassportJpeg(image);
    if (typeof image.close === 'function') image.close();
    const preview = byId('photoPreview');
    preview.src = photoDataUrl;
    preview.hidden = false;
    byId('photoEmpty').hidden = true;
    byId('photoButton').classList.add('has-photo');
  } catch {
    photoProblem('This photo could not be opened. Choose a JPG or PNG photo.');
  }
});

/* ---------- Review and submit ---------- */
function formValues(form) {
  return Object.fromEntries(new FormData(form).entries());
}

function populateReview(values) {
  const photo = byId('reviewPhoto');
  photo.src = photoDataUrl;
  photo.hidden = !photoDataUrl;
  const summary = byId('reviewSummary');
  summary.replaceChildren();
  const course = selectedCourse();
  const paid = Math.max(0, Number(values.initialPaidAmount) || 0);
  const rows = [
    ['Name', values.fullName], ["Father's Name", values.fatherName], ['Date of Birth', values.dateOfBirth],
    ['Address', values.permanentAddress], ['Qualification', values.highestQualification],
    ['Contact No.', values.mobileNumber], ['Time', values.preferredClassTime],
    ['Course', course?.name], ['Total Fee', course ? npr(course.payableFee) : ''],
    ['Paid Fee', npr(paid)], ['Remaining Fee', course ? npr(Math.max(0, course.payableFee - paid)) : ''],
    ['Payment method', values.paymentMethod], ['Transaction reference', values.transactionReference]
  ];
  rows.forEach(([label, value]) => {
    if (!value) return;
    safeText(summary, 'dt', label);
    safeText(summary, 'dd', value);
  });
}

byId('admissionForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const message = byId('formMessage');
  message.hidden = true;
  if (!photoDataUrl) {
    photoProblem('Add your passport-size photo.');
    byId('photoButton').scrollIntoView({ behavior: 'smooth', block: 'center' });
    byId('photoButton').focus();
    return;
  }
  if (!form.reportValidity()) return;
  const values = formValues(form);
  if (!reviewApproved) {
    populateReview(values);
    byId('reviewDialog').showModal();
    return;
  }
  reviewApproved = false;
  const payload = {
    fullName: values.fullName,
    fatherName: values.fatherName,
    dateOfBirth: values.dateOfBirth,
    mobileNumber: values.mobileNumber,
    permanentAddress: values.permanentAddress,
    highestQualification: values.highestQualification,
    preferredClassTime: values.preferredClassTime || null,
    courseId: Number(values.courseId),
    initialPaidAmount: Number(values.initialPaidAmount || 0),
    paymentMethod: values.paymentMethod,
    transactionReference: values.transactionReference || null,
    photoData: photoDataUrl,
    submissionToken,
    confirmInformation: Boolean(values.confirmInformation)
  };
  const button = byId('submitApplication');
  button.disabled = true;
  button.textContent = 'Sending…';
  try {
    const tokenResponse = await fetch('/api/security/token', { credentials: 'same-origin' });
    if (!tokenResponse.ok) throw new Error('Security token could not be refreshed. Reload the page and try again.');
    const { requestToken } = await tokenResponse.json();
    const response = await fetch('/api/applications', {
      method: 'POST', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-TOKEN': requestToken },
      body: JSON.stringify(payload)
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(formatServerError(result));
    submissionToken = crypto.randomUUID();
    showSuccess(result, values);
  } catch (error) {
    setMessage(message, error.message || 'The form could not be sent. Please try again.');
    button.disabled = false;
    button.textContent = 'Review and apply';
  }
});

byId('editApplication').addEventListener('click', () => byId('reviewDialog').close());
byId('confirmApplication').addEventListener('click', () => {
  reviewApproved = true;
  byId('reviewDialog').close();
  byId('admissionForm').requestSubmit();
});

function showSuccess(result, values) {
  byId('applicationFormWrap').hidden = true;
  const success = byId('applicationSuccess');
  success.hidden = false;
  success.replaceChildren();
  const mark = safeText(success, 'div', '✓', 'success-mark');
  mark.setAttribute('aria-hidden', 'true');
  safeText(success, 'h3', result.isDuplicate ? 'Your form was already received' : 'Your form is received');
  safeText(success, 'p', 'Keep this application number. You need it to check your status.');
  safeText(success, 'p', result.applicationNumber, 'application-number');
  safeText(success, 'p', `${result.courseName} · Total fee ${npr(result.payableFee)}`);
  safeText(success, 'p', 'Your admission is not final until the institute checks your form and payment.', 'success-warning');
  const printNote = safeText(success, 'p', '', 'form-message');
  printNote.hidden = true;
  const print = document.createElement('button');
  print.type = 'button';
  print.className = 'primary';
  print.textContent = 'Print or save my admission form';
  print.addEventListener('click', () => {
    const paid = Math.max(0, Number(values.initialPaidAmount) || 0);
    const opened = window.BstiAdmissionPrint?.open([{
      applicationNumber: result.applicationNumber,
      admissionDate: new Date(result.submittedAt || Date.now()).toLocaleDateString(),
      fullName: values.fullName, fatherName: values.fatherName, dateOfBirth: values.dateOfBirth,
      mobileNumber: values.mobileNumber, address: values.permanentAddress,
      qualification: values.highestQualification, classTime: values.preferredClassTime,
      courseName: result.courseName, payableFee: result.payableFee,
      claimedPaymentAmount: paid, paymentStatus: result.paymentStatus, photoUrl: photoDataUrl
    }]);
    if (!opened) setMessage(printNote, 'Allow pop-ups for this site to open the print page.');
  });
  success.append(print);
  success.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---------- Status check ---------- */
byId('trackForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  if (!form.reportValidity()) return;
  const message = byId('trackMessage');
  const result = byId('trackResult');
  message.hidden = true;
  result.hidden = true;
  result.replaceChildren();
  try {
    const response = await fetch('/api/application-status', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formValues(form))
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(formatServerError(data));
    result.hidden = false;
    [['Application number', data.applicationNumber], ['Course', data.courseName],
     ['Total fee', npr(data.payableFee)], ['Application status', data.applicationStatus],
     ['Payment status', data.paymentStatus]].forEach(([label, value]) => {
      const line = document.createElement('div');
      line.append(document.createTextNode(`${label}: `));
      safeText(line, 'strong', value);
      result.append(line);
    });
  } catch (error) {
    setMessage(message, error.message || 'The status could not be checked.');
  }
});

/* ---------- Start ---------- */
byId('year').textContent = new Date().getFullYear();
byId('dateOfBirth').max = new Date().toISOString().slice(0, 10);
loadCourses().catch(() => {
  byId('courseSelect').replaceChildren(new Option('Courses are not available now. Try again later.', ''));
});
