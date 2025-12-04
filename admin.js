// Admin Panel Logic for PlastiMarket
import { auth, db } from "./firebase-config.js";
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
        // Initialize with one empty row
        if (itemsBody && itemsBody.children.length === 0) {
            addInvoiceRow();
        }
    }

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
        });

        function addInvoiceRow() {
            const row = document.createElement('tr');
            const rowCount = itemsBody.children.length + 1;

            row.innerHTML = `
            <td>${rowCount}</td>
            <td>
                <select class="item-product" required>
                    <option value="">Seleccionar...</option>
                    <option value="Bolsa Blanca 16x24">Bolsa Blanca 16x24</option>
                    <option value="Bolsa Blanca 20x30">Bolsa Blanca 20x30</option>
                    <option value="Bolsa Cristal 10x15">Bolsa Cristal 10x15</option>
                    <option value="Manga Industrial">Manga Industrial</option>
                    <option value="Descartables">Descartables</option>
                    <option value="Otros">Otros</option>
                </select>
            </td>
            <td>
                <select class="item-unit">
                    <option value="UND">UND</option>
                    <option value="KG">KG</option>
                    <option value="MILLAR">MILLAR</option>
                    <option value="PAQ">PAQ</option>
                </select>
            </td>
            <td><input type="number" class="item-qty" value="1" min="1" required></td>
            <td><input type="number" class="item-price" value="0.00" step="0.01" min="0" required></td>
            <td><input type="text" class="item-total" value="0.00" readonly style="background: #f9f9f9;"></td>
            <td>
                ${rowCount > 1 ? '<button type="button" class="btn-remove-item"><i class="ph ph-trash"></i></button>' : ''}
            </td>
        `;

            itemsBody.appendChild(row);
            attachRowEvents(row);
        }

        function attachRowEvents(row) {
            const qtyInput = row.querySelector('.item-qty');
            const priceInput = row.querySelector('.item-price');
            const removeBtn = row.querySelector('.btn-remove-item');

            const updateRowTotal = () => {
                const qty = parseFloat(qtyInput.value) || 0;
                const price = parseFloat(priceInput.value) || 0;
                const total = qty * price;
                row.querySelector('.item-total').value = total.toFixed(2);
                calculateInvoiceTotals();
            };

            qtyInput.addEventListener('input', updateRowTotal);
            priceInput.addEventListener('input', updateRowTotal);

            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    row.remove();
                    calculateInvoiceTotals();
                    // Re-index rows
                    Array.from(itemsBody.children).forEach((r, index) => {
                        r.firstElementChild.textContent = index + 1;
                    });
                });
            }
        }

        function calculateInvoiceTotals() {
            let subtotal = 0;
            const rows = itemsBody.querySelectorAll('tr');

            rows.forEach(row => {
                const total = parseFloat(row.querySelector('.item-total').value) || 0;
                subtotal += total;
            });

            const igv = subtotal * 0.18;
            const total = subtotal + igv;

            lblSubtotal.textContent = `S/ ${subtotal.toFixed(2)}`;
            lblIgv.textContent = `S/ ${igv.toFixed(2)}`;
            lblTotal.textContent = `S/ ${total.toFixed(2)}`;

            return { subtotal, igv, total };
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
                items.push({
                    producto: row.querySelector('.item-product').value,
                    unidad: row.querySelector('.item-unit').value,
                    cantidad: parseFloat(row.querySelector('.item-qty').value),
                    precio_unit: parseFloat(row.querySelector('.item-price').value),
                    total: parseFloat(row.querySelector('.item-total').value)
                });
            });

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
                type: 'invoice' // Mark as invoice type
            };

            try {
                await addDoc(salesCollection, newSale);

                // Reset Form
                salesForm.reset();
                document.getElementById('fecha').valueAsDate = new Date();
                itemsBody.innerHTML = '';
                addInvoiceRow(); // Add one empty row
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
                <td><i class="ph ph-caret-down expand-icon"></i> ${dateStr}</td>
                <td>${sale.cliente || 'Cliente General'}</td>
                <td>${productSummary}</td>
                <td>${itemCount}</td>
                <td style="font-weight: bold; color: var(--primary-color);">${totalFormatted}</td>
                <td><span class="status-badge status-${(sale.pago || 'efectivo').toLowerCase()}">${(sale.pago || 'Efectivo').toUpperCase()}</span></td>
                <td style="font-size: 0.85em; color: #888;">${sale.createdBy || 'N/A'}</td>
                <td>
                    <button class="btn-delete" data-id="${sale.id}" style="background:none; border:none; color: #ff4444; cursor:pointer;" title="Eliminar">
                        <i class="ph ph-trash" style="font-size: 1.2rem;"></i>
                    </button>
                </td>
            `;

                // --- Detail Row (Hidden by default) ---
                const trDetail = document.createElement('tr');
                trDetail.className = 'detail-row';
                trDetail.id = `detail-${sale.id}`;

                let detailsHtml = '';
                if (isInvoice && sale.items) {
                    detailsHtml = `
                    <div class="detail-content">
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
                    </div>
                `;
                } else {
                    detailsHtml = `
                    <div class="detail-content">
                        <p><em>Venta simple (sin detalle de ítems)</em></p>
                        <p>Producto: ${sale.producto}</p>
                        <p>Cantidad: ${sale.cantidad}</p>
                    </div>
                `;
                }

                trDetail.innerHTML = `<td colspan="8">${detailsHtml}</td>`;

                // Add Click Event to Toggle
                tr.addEventListener('click', (e) => {
                    // Don't expand if clicking delete button
                    if (e.target.closest('.btn-delete')) return;

                    tr.classList.toggle('expanded');
                    const detailRow = document.getElementById(`detail-${sale.id}`);

                    if (detailRow.classList.contains('active')) {
                        detailRow.classList.remove('active');
                    } else {
                        // Optional: Close other open rows
                        document.querySelectorAll('.detail-row.active').forEach(row => {
                            row.classList.remove('active');
                            const prevId = row.id.replace('detail-', '');
                            const prevTr = document.querySelector(`tr[data-id="${prevId}"]`);
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

            let msg = `*REPORTE PLASTIMARKET (${today})*\n\n`;
            let total = 0;
            todaysSales.forEach(s => {
                if (s.items) {
                    s.items.forEach(item => {
                        msg += `📦 ${item.producto} x${item.cantidad} (${item.unidad})\n`;
                    });
                } else {
                    msg += `📦 ${s.producto} x${s.cantidad}\n`;
                }
                msg += `👤 ${s.cliente} - S/ ${s.total.toFixed(2)}\n`;
                msg += `----------------\n`;
                total += s.total;
            });
            msg += `\n*TOTAL: S/ ${total.toFixed(2)}*`;

            navigator.clipboard.writeText(msg).then(() => alert("Reporte copiado al portapapeles!"));
        };

        window.exportToCSV = function () {
            if (currentSales.length === 0) return alert("Sin datos para exportar");

            let csv = "Fecha,Cliente,Documento,Producto,Cantidad,Unidad,PrecioUnit,TotalItem,TotalVenta,Pago,Vendedor\n";

            currentSales.forEach(s => {
                if (s.items && s.items.length > 0) {
                    s.items.forEach(item => {
                        csv += `${s.fecha},${s.cliente},${s.documento || ''},${item.producto},${item.cantidad},${item.unidad},${item.precio_unit},${item.total},${s.total},${s.pago},${s.createdBy || ''}\n`;
                    });
                } else {
                    // Legacy support
                    csv += `${s.fecha},${s.cliente},${s.documento || ''},${s.producto},${s.cantidad},UND,${(s.total / s.cantidad).toFixed(2)},${s.total},${s.total},${s.pago},${s.createdBy || ''}\n`;
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
