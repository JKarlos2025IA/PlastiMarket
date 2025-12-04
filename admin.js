// Admin Panel Logic for PlastiMarket
console.log("PlastiMarket Admin Loaded");

// Placeholder Firebase Config (To be replaced by user)
const firebaseConfig = {
    // PASTE YOUR FIREBASE CONFIG HERE
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

document.addEventListener('DOMContentLoaded', async () => {
    // Wait for modules
    while (!window.firebaseModules) {
        await new Promise(resolve => setTimeout(resolve, 50));
    }

    const { initializeApp, getFirestore, collection, addDoc, getDocs, deleteDoc, doc, query, orderBy, onSnapshot, getAuth, signInWithEmailAndPassword, sendPasswordResetEmail, signOut, onAuthStateChanged } = window.firebaseModules;

    // Initialize Firebase (Try/Catch to handle invalid config gracefully initially)
    let app, db, auth, salesCollection;
    try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        salesCollection = collection(db, 'ventas');
    } catch (e) {
        console.warn("Firebase not configured yet. Using simulation mode for UI testing.");
    }

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

    if (dateInput) {
        dateInput.valueAsDate = new Date();
    }

    // --- Authentication Logic ---
    function checkAuth() {
        if (!auth) return; // Skip if no auth
        onAuthStateChanged(auth, (user) => {
            if (user) {
                showDashboard();
            } else {
                showLogin();
            }
        });
    }

    function showLogin() {
        loginView.style.display = 'flex';
        dashboardView.style.display = 'none';
    }

    function showDashboard() {
        loginView.style.display = 'none';
        dashboardView.style.display = 'flex';
        if (db) subscribeToSales();
    }

    // Login Form
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('admin-email').value;
        const password = document.getElementById('admin-password').value;

        if (auth) {
            try {
                await signInWithEmailAndPassword(auth, email, password);
            } catch (error) {
                alert("Error de inicio de sesión: " + error.message);
            }
        } else {
            // Simulation for UI testing
            if (email === 'admin@plastimarket.pe' && password === 'admin123') {
                showDashboard();
            } else {
                alert("Simulación: Usa admin@plastimarket.pe / admin123");
            }
        }
    });

    // Logout
    logoutBtn.addEventListener('click', async () => {
        if (auth) {
            await signOut(auth);
        } else {
            showLogin();
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
    let currentSales = [];

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
            cantidad: document.getElementById('cantidad').value,
            total: parseFloat(document.getElementById('precio').value),
            pago: document.getElementById('pago').value,
            timestamp: new Date().toISOString()
        };

        try {
            if (db) {
                await addDoc(salesCollection, newSale);
            } else {
                console.log("Simulated Save:", newSale);
                currentSales.unshift(newSale); // Add to local list for simulation
                renderTable(currentSales);
                alert("Venta guardada (Simulación)");
            }
            salesForm.reset();
            document.getElementById('fecha').valueAsDate = new Date();
        } catch (error) {
            alert("Error al guardar: " + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'REGISTRAR VENTA';
        }
    });

    function subscribeToSales() {
        const q = query(salesCollection, orderBy("timestamp", "desc"));
        onSnapshot(q, (snapshot) => {
            const sales = [];
            snapshot.forEach((doc) => {
                sales.push({ id: doc.id, ...doc.data() });
            });
            currentSales = sales;
            renderTable(sales);
            updateStats(sales);
        });
    }

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
                <td>
                    <button class="btn-delete" data-id="${sale.id || ''}" style="background:none; border:none; color: #ff4444; cursor:pointer;">
                        <i class="ph ph-trash" style="font-size: 1.2rem;"></i>
                    </button>
                </td>
            `;
            salesTableBody.appendChild(row);
        });

        // Add delete listeners
        document.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                if (confirm('¿Eliminar venta?')) {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (db && id) {
                        await deleteDoc(doc(db, "ventas", id));
                    } else {
                        e.target.closest('tr').remove();
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
            alert("No hay ventas de hoy para reportar.");
            return;
        }

        let msg = `*REPORTE PLASTIMARKET (${today})*\n\n`;
        let total = 0;
        todaysSales.forEach(s => {
            msg += `📦 ${s.producto} x${s.cantidad}\n`;
            msg += `👤 ${s.cliente} - S/ ${s.total}\n`;
            msg += `----------------\n`;
            total += s.total;
        });
        msg += `\n*TOTAL: S/ ${total.toFixed(2)}*`;

        navigator.clipboard.writeText(msg).then(() => alert("Reporte copiado!"));
    };

    window.exportToCSV = function () {
        if (currentSales.length === 0) return alert("Sin datos");
        let csv = "Fecha,Cliente,Producto,Cantidad,Total,Pago\n";
        currentSales.forEach(s => {
            csv += `${s.fecha},${s.cliente},${s.producto},${s.cantidad},${s.total},${s.pago}\n`;
        });
        const link = document.createElement("a");
        link.href = "data:text/csv;charset=utf-8," + encodeURI(csv);
        link.download = "ventas_plastimarket.csv";
        link.click();
    };

    checkAuth();
});
