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

console.log("PlastiMarket Admin Loaded (Firebase Integrated)");

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
            document.getElementById(tabId).classList.add('active');
        });
    });

    // --- Sales Logic ---

    salesForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = salesForm.querySelector('button[type="submit"]');
        btn.disabled = true;
        btn.textContent = 'Guardando...';

        const newSale = {
            fecha: document.getElementById('fecha').value,
            cliente: document.getElementById('cliente').value,
            documento: document.getElementById('documento').value,
            producto: document.getElementById('producto').value,
            cantidad: parseInt(document.getElementById('cantidad').value),
            total: parseFloat(document.getElementById('precio').value),
            pago: document.getElementById('pago').value,
            timestamp: new Date().toISOString(),
            createdBy: auth.currentUser ? auth.currentUser.email : 'unknown'
        };

        try {
            await addDoc(salesCollection, newSale);
            salesForm.reset();
            document.getElementById('fecha').valueAsDate = new Date();
            alert("Venta registrada exitosamente");
        } catch (error) {
            console.error("Error adding document: ", error);
            alert("Error al guardar: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'REGISTRAR VENTA';
        }
    });

    function subscribeToSales() {
        if (unsubscribeSales) return; // Already subscribed

        // Default query: Order by timestamp desc
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
            if (error.code === 'permission-denied') {
                alert("Permisos insuficientes para ver las ventas.");
            }
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
            const row = document.createElement('tr');
            const totalFormatted = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(sale.total);

            row.innerHTML = `
                <td>${sale.fecha}</td>
                <td>${sale.cliente}</td>
                <td>${sale.producto}</td>
                <td>${sale.cantidad}</td>
                <td>${totalFormatted}</td>
                <td><span class="status-badge status-${sale.pago}">${sale.pago}</span></td>
                <td style="font-size: 0.8em; color: #666;">${sale.createdBy || 'Anon'}</td>
                <td>
                    <button class="btn-delete" data-id="${sale.id}" style="background:none; border:none; color: #ff4444; cursor:pointer;">
                        <i class="ph ph-trash" style="font-size: 1.2rem;"></i>
                    </button>
                </td>
            `;
            salesTableBody.appendChild(row);
        });

        // Add delete listeners
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Eliminar venta? Esta acción no se puede deshacer.')) {
                    const id = e.currentTarget.getAttribute('data-id');
                    try {
                        await deleteDoc(doc(db, "ventas", id));
                    } catch (error) {
                        console.error("Error deleting document: ", error);
                        alert("Error al eliminar: " + error.message);
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
    // Attach to window so they can be called from HTML onclick (though event listeners are better)
    // Since we are in a module, functions are not global by default.
    // We need to attach them to window explicitly if we keep the onclick in HTML.

    window.copyForWhatsApp = function () {
        const today = new Date().toISOString().split('T')[0];
        // Use current filtered view or just today's sales? 
        // Usually daily report implies "today's sales".
        const todaysSales = currentSales.filter(s => s.fecha === today);

        if (todaysSales.length === 0) {
            alert("No hay ventas con fecha de hoy (" + today + ") para reportar.");
            return;
        }

        let msg = `*REPORTE PLASTIMARKET (${today})*\n\n`;
        let total = 0;
        todaysSales.forEach(s => {
            msg += `📦 ${s.producto} x${s.cantidad}\n`;
            msg += `👤 ${s.cliente} - S/ ${s.total.toFixed(2)}\n`;
            msg += `----------------\n`;
            total += s.total;
        });
        msg += `\n*TOTAL: S/ ${total.toFixed(2)}*`;

        navigator.clipboard.writeText(msg).then(() => alert("Reporte copiado al portapapeles!"));
    };

    window.exportToCSV = function () {
        // Export currently visible (filtered) sales
        // We need to access the sales currently in the table, or just use currentSales if no filter applied.
        // For simplicity, let's export currentSales (which is all loaded sales). 
        // Or better, let's export what is currently filtered. 
        // But the filter logic is inside the event listener. 
        // Let's just export currentSales for now.

        if (currentSales.length === 0) return alert("Sin datos para exportar");

        let csv = "Fecha,Cliente,Documento,Producto,Cantidad,Total,Pago,RegistradoPor\n";
        currentSales.forEach(s => {
            csv += `${s.fecha},${s.cliente},${s.documento || ''},${s.producto},${s.cantidad},${s.total},${s.pago},${s.createdBy || ''}\n`;
        });

        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
        link.download = "ventas_plastimarket.csv";
        link.click();
    };

    // Start Auth Check
    checkAuth();
});
