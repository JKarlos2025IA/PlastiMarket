// Admin Panel Logic for PlastiMarket
import { auth, db, app } from "./firebase-config.js";
import {
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import {
    collection,
    addDoc,
    deleteDoc,
    doc,
    query,
    orderBy,
    onSnapshot,
    where,
    getDocs
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";

// Initialize Cloud Functions
const functions = getFunctions(app);
const generateInvoiceManual = httpsCallable(functions, 'generateInvoiceManual');

console.log("PlastiMarket Admin Loaded (Invoice Mode)");

document.addEventListener('DOMContentLoaded', async () => {

    // DOM Elements
    const loginView = document.getElementById('login-view');
    const dashboardView = document.getElementById('dashboard-view');
    const loginForm = document.getElementById('login-form');
    const logoutBtn = document.getElementById('logout-btn');
    const salesForm = document.getElementById('sales-form');
    const salesTableBody = document.querySelector('#sales-table tbody');
    const tabBtns = document.querySelectorAll('.tab-btn');
    const sections = document.querySelectorAll('.dashboard-section');
    const dateInput = document.getElementById('fecha');
    const loginError = document.getElementById('login-error');

    // Invoice Elements
    const btnSearchRuc = document.getElementById('btn-search-ruc');
    const inputDocumento = document.getElementById('documento');
    const inputCliente = document.getElementById('cliente');
    const itemsBody = document.getElementById('invoice-items-body');
    const btnAddItem = document.getElementById('btn-add-item');
    const lblSubtotal = document.getElementById('lbl-subtotal');
    const lblIgv = document.getElementById('lbl-igv');
    const lblTotal = document.getElementById('lbl-total');

    // Filter Elements
    const filterDateStart = document.getElementById('filter-date-start');
    const filterDateEnd = document.getElementById('filter-date-end');
    const filterCliente = document.getElementById('filter-cliente');
    const filterPago = document.getElementById('filter-pago');
    const btnApplyFilters = document.getElementById('btn-apply-filters');
    const btnClearFilters = document.getElementById('btn-clear-filters');

    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // Collection Reference
    const salesCollection = collection(db, 'ventas');
    let unsubscribeSales = null;
    let currentSales = [];

    // --- Authentication Logic ---
    function checkAuth() {
        onAuthStateChanged(auth, (user) => {
            if (user) {
                console.log("User logged in:", user.email);
                showDashboard();
            } else {
                console.log("User logged out");
                showLogin();
            }
        });
    }

    function showLogin() {
        loginView.style.display = 'flex';
        dashboardView.style.display = 'none';
        if (unsubscribeSales) {
            unsubscribeSales();
            unsubscribeSales = null;
        }
    }

    function showDashboard() {
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        subscribeToSales();
        // Do NOT add a default row, user must use the drawer
    }

    // Login Form
    // Login Form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;
        loginError.style.display = 'none';

        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (error) {
            console.error("Login Error:", error);
            loginError.textContent = "Error de inicio de sesión: " + error.message;
            loginError.style.display = 'block';
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        try {
            await signOut(auth);
        } catch (error) {
            console.error("Logout Error:", error);
        }
    });

    // --- Navigation ---
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            sections.forEach(s => s.classList.remove('active'));
            btn.classList.add('active');
            const tabId = btn.getAttribute('data-tab');
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- Invoice Logic ---

    // RUC/DNI Lookup Configuration
    const API_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imxlb25hcmRvc2lsdmEyMDE5ODRAZ21haWwuY29tIn0.QYhQlE0qurCjc2COCmX3oY3cf3lkFAb2z9A17yr_9pQ';
    const BASE_API_URL = 'https://dniruc.apisperu.com/api/v1';

    // Mock Database for Demo (Fallback)
    const MOCK_DB = {
        '20100070970': 'SUPERMERCADOS PERUANOS S.A.',
        '20600000000': 'EMPRESA DE TRANSPORTES FLORES HNOS',
        '20100154308': 'INDUSTRIAL PAPELERA ATLAS S.A.',
        '20543212345': 'DISTRIBUIDORA COMERCIAL LIMA E.I.R.L.',
        '20100047235': 'TELEFONICA DEL PERU S.A.A.',
        '20100130204': 'ALICORP S.A.A.',
        '20254053822': 'CONSTRUCTORA Y MINERA M & S S.A.C.',
        '20601234567': 'PLASTICOS DEL SUR S.A.C.'
    };

    async function consultarDocumento(numero) {
        // 1. Check Mock DB first (Fast & Free for Demo RUCs)
        if (MOCK_DB[numero]) {
            return {
                nombre: MOCK_DB[numero],
                direccion: 'Dirección simulada para demo',
                estado: 'ACTIVO'
            };
        }

        // 2. API Call
        if (API_TOKEN) {
            let type = '';
            if (numero.length === 11) type = 'ruc';
            else if (numero.length === 8) type = 'dni';
            else throw new Error('El documento debe tener 8 (DNI) u 11 (RUC) dígitos.');

            try {
                const response = await fetch(`${BASE_API_URL}/${type}/${numero}?token=${API_TOKEN}`);
                if (!response.ok) throw new Error('Error al consultar API externa');
                const data = await response.json();

                if (type === 'ruc') {
                    return {
                        nombre: data.razonSocial,
                        direccion: `${data.direccion} - ${data.departamento} - ${data.provincia} - ${data.distrito}`,
                        estado: data.estado
                    };
                } else {
                    // DNI
                    return {
                        nombre: `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`,
                        direccion: '', // DNI usually doesn't return address publicly
                        estado: 'ACTIVO'
                    };
                }
            } catch (error) {
                console.error("API Error:", error);
                throw error;
            }
        }

        throw new Error('Documento no encontrado.');
    }

    btnSearchRuc.addEventListener('click', async () => {
        const documento = inputDocumento.value.trim();
        if (documento.length !== 11 && documento.length !== 8 || isNaN(documento)) {
            alert("El documento debe ser un RUC (11 dígitos) o DNI (8 dígitos) válido.");
            return;
        }

        // UI Loading State
        const originalBtnContent = btnSearchRuc.innerHTML;
        btnSearchRuc.disabled = true;
        btnSearchRuc.innerHTML = '<i class="ph ph-spinner ph-spin"></i>';
        inputCliente.value = 'Buscando...';

        try {
            const data = await consultarDocumento(documento);
            inputCliente.value = data.nombre;
            // If we add an address field later: 
            // if(data.direccion) document.getElementById('direccion').value = data.direccion;
        } catch (error) {
            console.warn(error);
            alert("No se encontró información. Por favor ingrese el nombre manualmente.");
            inputCliente.value = '';
            inputCliente.focus();
        } finally {
            btnSearchRuc.disabled = false;
            btnSearchRuc.innerHTML = originalBtnContent;
        }
    });

    // --- Side Drawer Logic ---
    const drawerOverlay = document.getElementById('drawer-overlay');
    const itemDrawer = document.getElementById('item-drawer');
    const btnCloseDrawer = document.getElementById('btn-close-drawer');
    const btnDrawerAdd = document.getElementById('btn-drawer-add');
    const drawerForm = document.getElementById('drawer-form');

    // Drawer Inputs
    const itemTipo = document.getElementsByName('tipo');
    const itemCodigo = document.getElementById('item-codigo');
    const itemDescripcion = document.getElementById('item-descripcion');
    const itemCantidad = document.getElementById('item-cantidad');
    const itemUnidad = document.getElementById('item-unidad');
    const itemPrecio = document.getElementById('item-precio');
    const itemImpuesto = document.getElementById('item-impuesto');
    const itemTotalDisplay = document.getElementById('item-total-display');

    function openDrawer() {
        drawerOverlay.classList.add('active');
        itemDrawer.classList.add('active');
        // Defaults
        itemCantidad.value = 1;
        itemPrecio.value = 0.00;
        itemDescripcion.value = '';
        itemCodigo.value = '';
        calculateDrawerTotal();
        itemDescripcion.focus();
    }

    function closeDrawer() {
        drawerOverlay.classList.remove('active');
        itemDrawer.classList.remove('active');
    }

    function calculateDrawerTotal() {
        const cant = parseFloat(itemCantidad.value) || 0;
        const price = parseFloat(itemPrecio.value) || 0;
        const total = cant * price;
        itemTotalDisplay.textContent = `S/ ${total.toFixed(2)}`;
    }

    // Event Listeners for Drawer
    btnAddItem.addEventListener('click', openDrawer);
    btnCloseDrawer.addEventListener('click', closeDrawer);
    drawerOverlay.addEventListener('click', closeDrawer);

    [itemCantidad, itemPrecio].forEach(input => {
        input.addEventListener('input', calculateDrawerTotal);
    });

    // Add Item from Drawer to Table
    btnDrawerAdd.addEventListener('click', () => {
        if (!drawerForm.checkValidity()) {
            drawerForm.reportValidity();
            return;
        }

        const tipo = Array.from(itemTipo).find(r => r.checked).value;
        const codigo = itemCodigo.value.trim();
        const descripcion = itemDescripcion.value.trim();
        const cantidad = parseFloat(itemCantidad.value);
        const unidad = itemUnidad.value;
        const precio = parseFloat(itemPrecio.value);
        const impuesto = itemImpuesto.value; // 18 or 0
        const total = cantidad * precio;

        addInvoiceRow({
            tipo,
            codigo,
            descripcion,
            cantidad,
            unidad,
            precio,
            impuesto,
            total
        });

        closeDrawer();
        calculateInvoiceTotals();
    });

    function addInvoiceRow(item) {
        const row = document.createElement('tr');
        const rowCount = itemsBody.children.length + 1;

        // Hidden inputs to store raw values for saving later
        row.dataset.json = JSON.stringify(item);

        row.innerHTML = `
            <td>${rowCount}</td>
            <td>
                <div style="font-weight:600; color:white;">${item.descripcion}</div>
                <div style="font-size:0.8rem; color:#888;">${item.codigo ? 'Cod: ' + item.codigo : ''} (${item.tipo})</div>
            </td>
            <td>${item.unidad}</td>
            <td>${item.cantidad}</td>
            <td>S/ ${item.precio.toFixed(2)}</td>
            <td class="row-total">S/ ${item.total.toFixed(2)}</td>
            <td>
                <button type="button" class="btn-remove-item" style="color:#ff4444; background:none; border:none; cursor:pointer;">
                    <i class="ph ph-trash" style="font-size:1.2rem;"></i>
                </button>
            </td>
        `;

        itemsBody.appendChild(row);

        // Remove Event
        row.querySelector('.btn-remove-item').addEventListener('click', () => {
            row.remove();
            calculateInvoiceTotals();
            // Re-index
            Array.from(itemsBody.children).forEach((r, index) => {
                r.firstElementChild.textContent = index + 1;
            });
        });
    }

    function calculateInvoiceTotals() {
        let subtotal = 0;
        let igvTotal = 0;
        let totalFinal = 0;

        const rows = itemsBody.querySelectorAll('tr');

        rows.forEach(row => {
            const item = JSON.parse(row.dataset.json);

            // Logic: 
            // If IGV is included (18%), we assume the Price Unit ALREADY includes IGV? 
            // Or is it Base + IGV? 
            // Standard retail usually implies Price includes IGV. 
            // Let's assume Price Unit is the final price per unit.

            // However, for proper accounting:
            // If item.impuesto == 18:
            // Base = Total / 1.18
            // IGV = Total - Base

            const rowTotal = item.total;

            if (item.impuesto == '18') {
                const base = rowTotal / 1.18;
                const igv = rowTotal - base;
                subtotal += base;
                igvTotal += igv;
            } else {
                // Exonerado (0%)
                subtotal += rowTotal;
                // No IGV
            }

            totalFinal += rowTotal;
        });

        lblSubtotal.textContent = `S/ ${subtotal.toFixed(2)}`;
        lblIgv.textContent = `S/ ${igvTotal.toFixed(2)}`;
        lblTotal.textContent = `S/ ${totalFinal.toFixed(2)}`;

        return { subtotal, igv: igvTotal, total: totalFinal };
    }

    // --- Sales Logic (Save) ---

    salesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = salesForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        // Gather Items
        const items = [];
        itemsBody.querySelectorAll('tr').forEach(row => {
            const item = JSON.parse(row.dataset.json);
            items.push({
                producto: item.descripcion, // Use description as main product name
                codigo: item.codigo,
                tipo: item.tipo,
                unidad: item.unidad,
                cantidad: item.cantidad,
                precio_unit: item.precio,
                impuesto: item.impuesto,
                total: item.total
            });
        });

        if (items.length === 0) {
            alert("Debe agregar al menos un ítem a la venta.");
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-floppy-disk"></i> GUARDAR VENTA';
            return;
        }

        const totals = calculateInvoiceTotals();

        const newSale = {
            fecha: document.getElementById('fecha').value,
            cliente: document.getElementById('cliente').value,
            documento: document.getElementById('documento').value,
            items: items,
            subtotal: totals.subtotal,
            igv: totals.igv,
            total: totals.total,
            pago: document.getElementById('pago').value,
            timestamp: new Date().toISOString(),
            createdBy: auth.currentUser ? auth.currentUser.email : 'unknown',
            type: 'invoice'
        };

        try {
            await addDoc(salesCollection, newSale);

            // Reset Form
            salesForm.reset();
            document.getElementById('fecha').valueAsDate = new Date();
            itemsBody.innerHTML = '';
            // No default row added, user must use drawer
            calculateInvoiceTotals(); // Reset totals

            alert("Venta registrada exitosamente");
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Error al guardar: " + error.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="ph ph-floppy-disk"></i> GUARDAR VENTA';
        }
    });

    function subscribeToSales() {
        if (unsubscribeSales) return;

        const q = query(salesCollection, orderBy("timestamp", "desc"));

        unsubscribeSales = onSnapshot(q, (snapshot) => {
            const sales = [];
            snapshot.forEach((doc) => {
                sales.push({ id: doc.id, ...doc.data() });
            });
            currentSales = sales;
            renderTable(sales);
            updateStats(sales);
        }, (error) => {
            console.error("Error getting documents: ", error);
        });
    }

    // --- Filters Logic ---
    btnApplyFilters.addEventListener('click', () => {
        let filtered = [...currentSales];

        const start = filterDateStart.value;
        const end = filterDateEnd.value;
        const client = filterCliente.value.toLowerCase();
        const payMethod = filterPago.value;

        if (start) {
            filtered = filtered.filter(s => s.fecha >= start);
        }
        if (end) {
            filtered = filtered.filter(s => s.fecha <= end);
        }
        if (client) {
            filtered = filtered.filter(s => s.cliente.toLowerCase().includes(client));
        }
        if (payMethod) {
            filtered = filtered.filter(s => s.pago === payMethod);
        }

        renderTable(filtered);
        updateStats(filtered);
    });

    btnClearFilters.addEventListener('click', () => {
        filterDateStart.value = '';
        filterDateEnd.value = '';
        filterCliente.value = '';
        filterPago.value = '';
        renderTable(currentSales);
        updateStats(currentSales);
    });


    function renderTable(sales) {
        salesTableBody.innerHTML = '';
        if (sales.length === 0) {
            document.getElementById('no-data-message').style.display = 'block';
            return;
        }
        document.getElementById('no-data-message').style.display = 'none';

        sales.forEach(sale => {
            // Determine if it's an invoice type or legacy
            const isInvoice = sale.type === 'invoice';
            const itemCount = isInvoice && sale.items ? sale.items.length : 1;

            // --- Main Row ---
            // --- Main Row ---
            const tr = document.createElement('tr');
            tr.className = 'sale-row';
            tr.dataset.id = sale.id; // Ensure ID is accessible

            // Format Date
            // Handle both Firestore Timestamp and string dates (legacy)
            let dateStr = sale.fecha;
            if (sale.timestamp && typeof sale.timestamp.toDate === 'function') {
                dateStr = sale.timestamp.toDate().toLocaleDateString('es-PE');
            }

            // Product Summary
            let productSummary = '';
            if (isInvoice && sale.items && sale.items.length > 0) {
                productSummary = `${sale.items[0].producto} <span style="color: #888; font-size: 0.85em;">(${itemCount} ítems)</span>`;
            } else {
                productSummary = sale.producto || 'Producto desconocido';
            }

            // Total Formatting
            const totalFormatted = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(sale.total || 0);

            tr.innerHTML = `
        < td > <i class="ph ph-caret-down expand-icon"></i> ${dateStr}</td >
                <td>${sale.cliente || 'Cliente General'}</td>
                <td>${productSummary}</td>
                <td style="font-weight: bold; color: var(--primary-color);">${totalFormatted}</td>
                <td><span class="status-badge status-${(sale.pago || 'efectivo').toLowerCase()}">${(sale.pago || 'Efectivo').toUpperCase()}</span></td>
                <td style="font-size: 0.85em; color: #888;">${sale.createdBy || 'N/A'}</td>
                <td class="invoice-cell">
                    ${sale.invoiceStatus === 'emitido' ? `
                        <span class="invoice-number">${sale.invoiceNumber || ''}</span>
                        ${sale.invoicePDF ? `<a href="${sale.invoicePDF}" target="_blank" class="btn-sunat emitido" title="Ver PDF"><i class="ph ph-file-pdf"></i></a>` : '<span class="btn-sunat emitido" title="Emitido">✓</span>'}
                    ` : sale.invoiceStatus === 'error' ? `
                        <button class="btn-sunat error" data-id="${sale.id}" title="Error - Click para reintentar">!</button>
                    ` : `
                        <button class="btn-sunat pendiente btn-generate-invoice" data-id="${sale.id}" title="Generar Comprobante"><i class="ph ph-receipt"></i></button>
                    `}
                </td>
                <td>
                    <button class="btn-delete" data-id="${sale.id}" style="background:none; border:none; color: #ff4444; cursor:pointer;" title="Eliminar">
                        <i class="ph ph-trash" style="font-size: 1.2rem;"></i>
                    </button>
                </td>
    `;


            // --- Detail Row (Hidden by default) ---
            const trDetail = document.createElement('tr');
            trDetail.className = 'detail-row';
            trDetail.id = `detail - ${sale.id} `;

            let detailsHtml = '';
            if (isInvoice && sale.items) {
                detailsHtml = `
        < div class="detail-content" >
                        <table class="detail-table">
                            <thead>
                                <tr>
                                    <th>Producto</th>
                                    <th>Medida</th>
                                    <th>Cant.</th>
                                    <th>P. Unit</th>
                                    <th>Total</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${sale.items.map(item => `
                                    <tr>
                                        <td>${item.producto}</td>
                                        <td>${item.unidad}</td>
                                        <td>${item.cantidad}</td>
                                        <td>S/ ${parseFloat(item.precio_unit).toFixed(2)}</td>
                                        <td>S/ ${parseFloat(item.total).toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                        <div style="margin-top: 10px; text-align: right; font-size: 0.9rem; color: #aaa;">
                            <strong>Subtotal:</strong> S/ ${(parseFloat(sale.subtotal) || 0).toFixed(2)} | 
                            <strong>IGV:</strong> S/ ${(parseFloat(sale.igv) || 0).toFixed(2)}
                        </div>
                    </div >
        `;
            } else {
                detailsHtml = `
        < div class="detail-content" >
                        <p><em>Venta simple (sin detalle de ítems)</em></p>
                        <p>Producto: ${sale.producto}</p>
                        <p>Cantidad: ${sale.cantidad}</p>
                    </div >
        `;
            }

            trDetail.innerHTML = `< td colspan = "8" > ${detailsHtml}</td > `;

            // Add Click Event to Toggle
            tr.addEventListener('click', (e) => {
                // Don't expand if clicking delete button
                if (e.target.closest('.btn-delete')) return;

                tr.classList.toggle('expanded');
                const detailRow = document.getElementById(`detail - ${sale.id} `);

                if (detailRow.classList.contains('active')) {
                    detailRow.classList.remove('active');
                } else {
                    // Optional: Close other open rows
                    document.querySelectorAll('.detail-row.active').forEach(row => {
                        row.classList.remove('active');
                        const prevId = row.id.replace('detail-', '');
                        const prevTr = document.querySelector(`tr[data - id= "${prevId}"]`);
                        if (prevTr) prevTr.classList.remove('expanded');
                    });
                    detailRow.classList.add('active');
                }
            });

            salesTableBody.appendChild(tr);
            salesTableBody.appendChild(trDetail);
        });

        // Re-attach delete listeners
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation(); // Prevent row expansion
                if (confirm('¿Estás seguro de eliminar esta venta?')) {
                    const id = e.currentTarget.dataset.id;
                    try {
                        await deleteDoc(doc(db, "ventas", id));
                        // Table updates automatically via onSnapshot
                    } catch (error) {
                        console.error("Error deleting document: ", error);
                        alert("Error al eliminar la venta");
                    }
                }
            });
        });

        // Attach invoice generation listeners
        document.querySelectorAll('.btn-generate-invoice').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const saleId = e.currentTarget.dataset.id;
                const button = e.currentTarget;
                const originalContent = button.innerHTML;

                try {
                    button.disabled = true;
                    button.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Generando...';

                    console.log('Generando comprobante para venta:', saleId);

                    const result = await generateInvoiceManual({ saleId });

                    console.log('Resultado:', result.data);

                    if (result.data.success) {
                        alert(`✅ Comprobante generado: ${result.data.invoiceNumber}`);
                        // Table will auto-update via onSnapshot
                    } else {
                        throw new Error(result.data.error || 'Error desconocido');
                    }
                } catch (error) {
                    console.error('Error al generar comprobante:', error);
                    alert(`❌ Error: ${error.message}`);
                    button.disabled = false;
                    button.innerHTML = originalContent;
                }
            });
        });
    }

    function updateStats(sales) {
        document.getElementById('total-sales-count').textContent = sales.length;
        const total = sales.reduce((sum, sale) => sum + (sale.total || 0), 0);
        document.getElementById('total-revenue').textContent = total.toFixed(2);
    }

    // --- Export & WhatsApp ---
    window.copyForWhatsApp = function () {
        const today = new Date().toISOString().split('T')[0];
        const todaysSales = currentSales.filter(s => s.fecha === today);

        if (todaysSales.length === 0) {
            alert("No hay ventas con fecha de hoy (" + today + ") para reportar.");
            return;
        }

        let msg = `* REPORTE PLASTIMARKET(${today}) *\n\n`;
        let total = 0;
        todaysSales.forEach(s => {
            if (s.items) {
                s.items.forEach(item => {
                    msg += `📦 ${item.producto} x${item.cantidad} (${item.unidad}) \n`;
                });
            } else {
                msg += `📦 ${s.producto} x${s.cantidad} \n`;
            }
            msg += `👤 ${s.cliente} - S / ${s.total.toFixed(2)} \n`;
            msg += `----------------\n`;
            total += s.total;
        });
        msg += `\n * TOTAL: S / ${total.toFixed(2)}* `;

        navigator.clipboard.writeText(msg).then(() => alert("Reporte copiado al portapapeles!"));
    };

    window.exportToCSV = function () {
        if (currentSales.length === 0) return alert("Sin datos para exportar");

        let csv = "Fecha,Cliente,Documento,Producto,Cantidad,Unidad,PrecioUnit,TotalItem,TotalVenta,Pago,Vendedor\n";

        currentSales.forEach(s => {
            if (s.items && s.items.length > 0) {
                s.items.forEach(item => {
                    csv += `${s.fecha},${s.cliente},${s.documento || ''},${item.producto},${item.cantidad},${item.unidad},${item.precio_unit},${item.total},${s.total},${s.pago},${s.createdBy || ''} \n`;
                });
            } else {
                // Legacy support
                csv += `${s.fecha},${s.cliente},${s.documento || ''},${s.producto},${s.cantidad}, UND, ${(s.total / s.cantidad).toFixed(2)},${s.total},${s.total},${s.pago},${s.createdBy || ''} \n`;
            }
        });

        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
        link.download = "ventas_plastimarket_detalle.csv";
        link.click();
    };

    // Start Auth Check
    checkAuth();
});
