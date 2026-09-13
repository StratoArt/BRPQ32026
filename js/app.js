// ============================================================
// INVOICE APP - FRONTEND
// Google Sheets + Google Apps Script API
// ============================================================

const API_URL =
  'https://script.google.com/macros/s/AKfycbwhAYHg3_Ty4nHvSacjXSS3NEooc2y58m-XHk57zyH9mE03KflQ07A8jYVSPYEP2jK1/exec';

const APP = {
  customers: [],
  invoices: [],
  settings: {}
};


// ============================================================
// HELPER DOM
// ============================================================

const $ = id => document.getElementById(id);


// ============================================================
// INITIALIZATION
// ============================================================

document.addEventListener('DOMContentLoaded', () => {

  // Buttons
  $('newInvoiceBtn').onclick = openNewInvoice;
  $('refreshBtn').onclick = loadData;
  $('addItemBtn').onclick = () => addItem();
  $('saveBtn').onclick = saveInvoice;
  $('printBtn').onclick = () => window.print();

  // Search
  $('searchInput').oninput = filterInvoices;

  // Customer
  $('customerSelect').onchange = selectCustomer;

  // Tax
  $('taxPercent').oninput = calculate;

  // Modal close buttons
  document
    .querySelectorAll('[data-close]')
    .forEach(button => {
      button.onclick = () => closeModal(button.dataset.close);
    });

  // Default invoice date
  $('invoiceDate').value =
    new Date().toISOString().slice(0, 10);

  // Load initial data
  loadData();
});


// ============================================================
// API
// ============================================================

async function api(action, payload = {}) {

  if (API_URL.includes('PASTE_APPS_SCRIPT')) {
    throw new Error(
      'API URL belum diisi di js/app.js'
    );
  }

  const response = await fetch(API_URL, {
    method: 'POST',

    headers: {
      'Content-Type': 'text/plain;charset=utf-8'
    },

    body: JSON.stringify({
      action,
      ...payload
    })
  });

  if (!response.ok) {
    throw new Error(
      `HTTP Error ${response.status}`
    );
  }

  const data = await response.json();

  if (data.success === false) {
    throw new Error(
      data.message ||
      data.error ||
      'API error'
    );
  }

  return data;
}


// ============================================================
// LOAD DATA
// ============================================================

async function loadData() {

  try {

    const data = await api(
      'getInitialData'
    );

    APP.customers =
      data.customers || [];

    APP.invoices =
      data.invoices || [];

    APP.settings =
      data.settings || {};

    renderCustomers();
    renderInvoices();
    renderStats();

  } catch (error) {

    console.error(
      'LOAD DATA ERROR:',
      error
    );

    toast(
      error.message,
      true
    );
  }
}


// ============================================================
// STATISTICS
// ============================================================

function renderStats() {

  const paid =
    APP.invoices.filter(
      invoice =>
        invoice.status === 'Paid'
    ).length;

  const unpaid =
    APP.invoices.filter(
      invoice =>
        [
          'Unpaid',
          'Partially Paid'
        ].includes(invoice.status)
    ).length;

  $('stats').innerHTML = `

    <div class="stat">
      <b>${APP.invoices.length}</b>
      <span>TOTAL INVOICE</span>
    </div>

    <div class="stat">
      <b>${paid}</b>
      <span>PAID</span>
    </div>

    <div class="stat">
      <b>${unpaid}</b>
      <span>UNPAID</span>
    </div>

  `;
}


// ============================================================
// CUSTOMER
// ============================================================

function renderCustomers() {

  $('customerSelect').innerHTML = `

    <option value="">
      -- Pilih Customer --
    </option>

    ${
      APP.customers
        .map(customer => `

          <option value="${escapeHtml(customer.id)}">
            ${escapeHtml(customer.id)}
            -
            ${escapeHtml(customer.name)}
          </option>

        `)
        .join('')
    }

  `;
}


function selectCustomer() {

  const customer =
    APP.customers.find(
      item =>
        item.id === $('customerSelect').value
    );

  if (!customer) {
    return;
  }

  $('customer').value =
    customer.name || '';

  $('phone').value =
    customer.phone || '';

  $('email').value =
    customer.email || '';

  $('address').value =
    customer.address || '';
}


// ============================================================
// INVOICE LIST
// ============================================================

function renderInvoices(
  list = APP.invoices
) {

  $('emptyState').hidden =
    !!list.length;

  $('invoiceList').innerHTML =
    list
      .map(invoice => `

        <tr>

          <td>
            <strong>
              ${escapeHtml(invoice.invoiceNo)}
            </strong>
          </td>

          <td>
            ${escapeHtml(invoice.date)}
          </td>

          <td>
            ${escapeHtml(invoice.customer)}
          </td>

          <td>
            ${money(invoice.grandTotal)}
          </td>

          <td>

            <span class="status ${escapeHtml(invoice.status)}">
              ${escapeHtml(invoice.status)}
            </span>

          </td>

          <td>

            <button
              class="btn btn-light btn-small"
              onclick="previewInvoice('${encodeURIComponent(invoice.invoiceNo)}')"
            >
              View
            </button>

          </td>

        </tr>

      `)
      .join('');
}


function filterInvoices() {

  const query =
    $('searchInput')
      .value
      .toLowerCase()
      .trim();

  const filtered =
    APP.invoices.filter(invoice => {

      const invoiceNo =
        String(invoice.invoiceNo || '')
          .toLowerCase();

      const customer =
        String(invoice.customer || '')
          .toLowerCase();

      return (
        invoiceNo.includes(query) ||
        customer.includes(query)
      );
    });

  renderInvoices(filtered);
}


// ============================================================
// NEW INVOICE
// ============================================================

function openNewInvoice() {

  $('invoiceNo').value = '';

  $('customerSelect').value = '';

  $('customer').value = '';
  $('phone').value = '';
  $('email').value = '';
  $('address').value = '';
  $('notes').value = '';

  $('status').value = 'Draft';

  $('paymentMethod').value =
    'Transfer Bank';

  $('taxPercent').value =
    APP.settings['Pajak Default (%)'] || 15;

  $('invoiceDate').value =
    new Date().toISOString().slice(0, 10);

  $('itemsBody').innerHTML = '';

  addItem();

  openModal('formModal');
}


// ============================================================
// INVOICE ITEMS
// ============================================================

function addItem(item = {}) {

  const row =
    document.createElement('tr');

  row.innerHTML = `

    <td class="item-no"></td>

    <td>

      <input
        class="description"
        type="text"
        value="${escapeAttr(
          item.description || ''
        )}"
      >

    </td>

    <td>

      <input
        class="qty"
        type="number"
        min="0"
        value="${item.qty ?? 1}"
      >

    </td>

    <td>

      <input
        class="price"
        type="number"
        min="0"
        value="${item.price ?? 0}"
      >

    </td>

    <td class="item-total">
      Rp 0
    </td>

    <td>

      <button
        type="button"
        class="delete-item"
      >
        ×
      </button>

    </td>

  `;

  // Input events
  row
    .querySelectorAll('input')
    .forEach(input => {
      input.oninput = calculate;
    });

  // Delete item
  row
    .querySelector('.delete-item')
    .onclick = () => {

      row.remove();

      renumber();

      calculate();
    };

  $('itemsBody')
    .appendChild(row);

  renumber();

  calculate();
}


// ============================================================
// RENUMBER ITEMS
// ============================================================

function renumber() {

  document
    .querySelectorAll('.item-no')
    .forEach((element, index) => {

      element.textContent =
        index + 1;

    });
}


// ============================================================
// GET ITEMS
// ============================================================

function getItems() {

  return [

    ...document.querySelectorAll(
      '#itemsBody tr'
    )

  ]

    .map(row => {

      const description =
        row
          .querySelector('.description')
          .value
          .trim();

      const qty =
        Number(
          row
            .querySelector('.qty')
            .value
        ) || 0;

      const price =
        Number(
          row
            .querySelector('.price')
            .value
        ) || 0;

      return {
        description,
        qty,
        price
      };

    })

    .filter(item =>
      item.description ||
      item.qty ||
      item.price
    );
}


// ============================================================
// CALCULATE
// ============================================================

function calculate() {

  let subtotal = 0;

  document
    .querySelectorAll(
      '#itemsBody tr'
    )
    .forEach(row => {

      const qty =
        Number(
          row
            .querySelector('.qty')
            .value
        ) || 0;

      const price =
        Number(
          row
            .querySelector('.price')
            .value
        ) || 0;

      const total =
        qty * price;

      subtotal += total;

      row
        .querySelector('.item-total')
        .textContent =
        money(total);

    });

  const taxPercent =
    Number(
      $('taxPercent').value
    ) || 0;

  const tax =
    subtotal *
    taxPercent /
    100;

  const grandTotal =
    subtotal + tax;

  $('subtotal').textContent =
    money(subtotal);

  $('tax').textContent =
    money(tax);

  $('grandTotal').textContent =
    money(grandTotal);
}


// ============================================================
// SAVE INVOICE
// ============================================================

async function saveInvoice() {

  const data = {

    invoiceNo:
      $('invoiceNo').value,

    date:
      $('invoiceDate').value,

    customerId:
      $('customerSelect').value,

    customer:
      $('customer').value.trim(),

    phone:
      $('phone').value.trim(),

    email:
      $('email').value.trim(),

    address:
      $('address').value.trim(),

    taxPercent:
      Number(
        $('taxPercent').value
      ) || 0,

    status:
      $('status').value,

    paymentMethod:
      $('paymentMethod').value,

    notes:
      $('notes').value.trim(),

    items:
      getItems()

  };


  // Validation
  if (!data.customer) {

    toast(
      'Nama customer belum diisi.',
      true
    );

    return;
  }


  if (!data.items.length) {

    toast(
      'Minimal ada 1 item.',
      true
    );

    return;
  }


  try {

    $('saveBtn').disabled = true;

    $('saveBtn').textContent =
      'Menyimpan...';


    // ========================================================
    // PENTING:
    // Backend menerima:
    // { action: "saveInvoice", invoice: data }
    // ========================================================

    const result =
      await api(
        'saveInvoice',
        {
          invoice: data
        }
      );


    console.log(
      'SAVE INVOICE RESULT:',
      result
    );


    // Close form
    closeModal(
      'formModal'
    );


    // Success notification
    toast(
      `Invoice ${result.invoiceNo} berhasil disimpan.`
    );


    // Refresh data
    await loadData();


    // Open invoice preview
    previewInvoice(
      encodeURIComponent(
        result.invoiceNo
      )
    );


  } catch (error) {

    console.error(
      'SAVE INVOICE ERROR:',
      error
    );

    toast(
      error.message ||
      'Gagal menyimpan invoice.',
      true
    );


  } finally {

    $('saveBtn').disabled = false;

    $('saveBtn').textContent =
      'Simpan Invoice';

  }
}


// ============================================================
// PREVIEW INVOICE
// ============================================================

async function previewInvoice(
  encodedInvoiceNo
) {

  try {

    const invoiceNo =
      decodeURIComponent(
        encodedInvoiceNo
      );

    const invoice =
      await api(
        'getInvoice',
        {
          invoiceNo
        }
      );


    $('printArea').innerHTML =
      buildInvoiceHTML(invoice);


    openModal(
      'previewModal'
    );


  } catch (error) {

    console.error(
      'PREVIEW INVOICE ERROR:',
      error
    );

    toast(
      error.message,
      true
    );
  }
}


// ============================================================
// BUILD INVOICE HTML
// ============================================================

function buildInvoiceHTML(invoice) {

  const settings =
    APP.settings;


  const rows =
    (invoice.items || [])
      .map(item => `

        <tr>

          <td>
            ${escapeHtml(item.no)}
          </td>

          <td>
            ${escapeHtml(
              item.description
            )}
          </td>

          <td style="text-align:center">
            ${escapeHtml(item.qty)}
          </td>

          <td style="text-align:right">
            ${money(item.price)}
          </td>

          <td style="text-align:right">
            ${money(item.total)}
          </td>

        </tr>

      `)
      .join('');


  return `

    <div class="invoice">

      <!-- HEADER -->

      <div class="invoice-top">

        <div>

          <div class="company">

            ${escapeHtml(
              settings['Nama Perusahaan'] ||
              'NAMA PERUSAHAAN'
            )}

          </div>

          <div class="company-sub">

            ${escapeHtml(
              settings['Alamat Perusahaan'] ||
              ''
            )}

          </div>

        </div>


        <div style="text-align:right">

          <div class="invoice-title">
            INVOICE
          </div>

          <div style="font-size:10px">

            ${escapeHtml(
              settings['Website'] ||
              ''
            )}

          </div>

        </div>

      </div>


      <div class="invoice-line"></div>


      <!-- CUSTOMER / INVOICE INFO -->

      <div class="invoice-info">

        <div>

          <div>
            Invoice To :
          </div>

          <div class="customer-name">

            ${escapeHtml(
              invoice.customer
            )}

          </div>

          <div>
            ${escapeHtml(
              invoice.phone || ''
            )}
          </div>

          <div>
            ${escapeHtml(
              invoice.email || ''
            )}
          </div>

          <div>
            ${escapeHtml(
              invoice.address || ''
            )}
          </div>

        </div>


        <div style="text-align:right">

          <strong>

            Invoice No :
            ${escapeHtml(
              invoice.invoiceNo
            )}

          </strong>

          <br>

          ${escapeHtml(
            invoice.date
          )}

        </div>

      </div>


      <!-- ITEMS -->

      <table class="invoice-table">

        <thead>

          <tr>

            <th>
              NO
            </th>

            <th>
              DESCRIPTION
            </th>

            <th>
              QTY
            </th>

            <th>
              PRICE
            </th>

            <th>
              TOTAL
            </th>

          </tr>

        </thead>


        <tbody>

          ${rows}

        </tbody>

      </table>


      <!-- PAYMENT + SUMMARY -->

      <div class="invoice-bottom">


        <!-- PAYMENT -->

        <div class="payment">

          <div class="payment-title">
            PAYMENT METHOD :
          </div>

          <br>

          <strong>

            ${escapeHtml(
              invoice.paymentMethod || ''
            )}

          </strong>

          <br><br>

          Bank Name :
          ${escapeHtml(
            settings['Nama Bank'] || ''
          )}

          <br>

          Account Number :
          ${escapeHtml(
            settings['No. Rekening'] || ''
          )}

          <br>

          Account Name :
          ${escapeHtml(
            settings['Atas Nama'] || ''
          )}

        </div>


        <!-- SUMMARY -->

        <div class="summary">

          <div class="summary-row">

            <span>
              Sub Total :
            </span>

            <span>
              ${money(
                invoice.subtotal
              )}
            </span>

          </div>


          <div class="summary-row">

            <span>
              Tax ${invoice.taxPercent}% :
            </span>

            <span>
              ${money(
                invoice.tax
              )}
            </span>

          </div>


          <div class="summary-grand">

            <div class="summary-row">

              <span>
                GRAND TOTAL :
              </span>

              <span>
                ${money(
                  invoice.grandTotal
                )}
              </span>

            </div>

          </div>

        </div>

      </div>


      <!-- TERMS -->

      <div class="terms">

        <strong>
          Terms and Conditions :
        </strong>

        <br><br>

        ${escapeHtml(
          settings['Syarat Pembayaran'] ||
          ''
        )}

      </div>


      <!-- FOOTER -->

      <div class="footer">

        <span>
          ${escapeHtml(
            settings['Telepon'] || ''
          )}
        </span>

        <span>
          ${escapeHtml(
            settings['Email'] || ''
          )}
        </span>

        <span>
          ${escapeHtml(
            settings['Alamat Perusahaan'] || ''
          )}
        </span>

      </div>


    </div>

  `;
}


// ============================================================
// MODAL
// ============================================================

function openModal(id) {

  const modal =
    $(id);

  if (!modal) {
    return;
  }

  modal.classList.add(
    'show'
  );
}


function closeModal(id) {

  const modal =
    $(id);

  if (!modal) {
    return;
  }

  modal.classList.remove(
    'show'
  );
}


// ============================================================
// MONEY FORMAT
// ============================================================

function money(value) {

  return (
    'Rp ' +
    Number(value || 0)
      .toLocaleString(
        'id-ID'
      )
  );
}


// ============================================================
// TOAST
// ============================================================

function toast(
  message,
  isError = false
) {

  const element =
    $('toast');

  if (!element) {
    return;
  }

  element.textContent =
    message;


  element.style.background =
    isError
      ? '#b42318'
      : '#1f2937';


  element.classList.add(
    'show'
  );


  clearTimeout(
    window.__toastTimer
  );


  window.__toastTimer =
    setTimeout(() => {

      element.classList.remove(
        'show'
      );

    }, 2800);
}


// ============================================================
// SECURITY / ESCAPE HTML
// ============================================================

function escapeHtml(value) {

  return String(
    value ?? ''
  ).replace(
    /[&<>"']/g,
    character => ({

      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'

    }[character])
  );
}


function escapeAttr(value) {

  return escapeHtml(value);
}
