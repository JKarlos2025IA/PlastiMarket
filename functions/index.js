const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

// ==================================
// CONFIGURACIÓN APISPERU
// ==================================

const APISPERU_CONFIG = {
    // API de Facturación
    baseURL: 'https://facturacion.apisperu.com/api/v1.3',
    // Credenciales (from environment variables)
    token: functions.config().apisperu?.token || null,
    ruc: functions.config().apisperu?.ruc || '15606237577',
    usuarioSol: functions.config().apisperu?.usuario_sol || 'DOFESIVA',
    claveSol: functions.config().apisperu?.clave_sol || null,
};

// ==================================
// FUNCIÓN: Generar Factura/Boleta
// ==================================

exports.generateInvoice = functions.firestore
    .document('ventas/{saleId}')
    .onCreate(async (snap, context) => {
        const saleId = context.params.saleId;
        const saleData = snap.data();

        console.log(`[generateInvoice] Processing sale ${saleId}`);

        try {
            // 1. Validar que tenga items
            if (!saleData.items || saleData.items.length === 0) {
                throw new Error('La venta no tiene items');
            }

            // 2. Determinar tipo de comprobante
            const tipoComprobante = saleData.documento?.length === 11 ? '01' : '03'; // 01=Factura, 03=Boleta
            const serie = tipoComprobante === '01' ? 'F001' : 'B001';

            // 3. Obtener siguiente correlativo
            const correlativo = await getNextCorrelative(serie);

            // 4. Preparar datos para APIsPERU (según especificación oficial)
            const invoicePayload = {
                // Campos obligatorios según API
                ublVersion: "2.1",
                tipoOperacion: "0101", // Venta interna
                tipoDoc: tipoComprobante, // "01" o "03"
                serie: serie,
                correlativo: String(correlativo),
                fechaEmision: `${saleData.fecha}T00:00:00-05:00`, // ISO 8601 format
                tipoMoneda: "PEN",

                // Cliente
                client: {
                    tipoDoc: saleData.documento?.length === 11 ? "6" : "1", // 6=RUC, 1=DNI
                    numDoc: parseInt(saleData.documento) || 0,
                    rznSocial: saleData.cliente || "CLIENTE VARIOS",
                    address: {}
                },

                // Empresa emisora
                company: {
                    ruc: parseInt(APISPERU_CONFIG.ruc),
                    razonSocial: "SILVA GUEDEZ LEONARDO JOSE",
                    nombreComercial: "PLASTIMARKET",
                    address: {
                        direccion: "Dirección de la empresa" // Actualizar con dirección real
                    }
                },

                // Forma de pago
                formaPago: {
                    moneda: "PEN",
                    tipo: saleData.pago === 'Efectivo' || saleData.pago === 'Yape' || saleData.pago === 'Plin' ? "Contado" : "Credito"
                },

                // Totales
                mtoOperGravadas: parseFloat((saleData.subtotal || 0).toFixed(2)),
                mtoOperExoneradas: 0,
                mtoIGV: parseFloat((saleData.igv || 0).toFixed(2)),
                totalImpuestos: parseFloat((saleData.igv || 0).toFixed(2)),
                valorVenta: parseFloat((saleData.subtotal || 0).toFixed(2)),
                subTotal: parseFloat((saleData.total || 0).toFixed(2)),
                mtoImpVenta: parseFloat((saleData.total || 0).toFixed(2)),

                // Detalles de items
                details: saleData.items.map((item, index) => {
                    const baseValue = calculateBaseValue(item.total, item.impuesto);
                    const igvValue = item.impuesto === '18' ? (item.total - baseValue) : 0;

                    return {
                        codProducto: item.codigo || `PROD${String(index + 1).padStart(3, '0')}`,
                        unidad: item.unidad || "NIU", // NIU = Unidad (Bienes)
                        descripcion: item.producto,
                        cantidad: parseFloat(item.cantidad),
                        mtoValorUnitario: parseFloat((item.precio_unit / (item.impuesto === '18' ? 1.18 : 1)).toFixed(2)),
                        mtoValorVenta: parseFloat(baseValue.toFixed(2)),
                        mtoBaseIgv: parseFloat(baseValue.toFixed(2)),
                        porcentajeIgv: item.impuesto === '18' ? 18 : 0,
                        igv: parseFloat(igvValue.toFixed(2)),
                        tipAfeIgv: item.impuesto === '18' ? 10 : 20, // 10=Gravado-Operación Onerosa, 20=Exonerado
                        totalImpuestos: parseFloat(igvValue.toFixed(2))
                    };
                }),

                // Leyendas (requerido)
                legends: [
                    {
                        code: "1000",
                        value: numeroALetras(saleData.total || 0)
                    }
                ]
            };

            console.log('[generateInvoice] Payload preparado:', JSON.stringify(invoicePayload, null, 2));

            // 5. Llamar a APIsPERU para generar comprobante
            const response = await sendToAPIsPERU(invoicePayload);

            console.log('[generateInvoice] Response from APIsPERU:', response);

            // 6. Guardar PDF y XML en Storage (opcional)
            // await saveToStorage(response.pdf, response.xml, saleId, serie, correlativo);

            // 7. Actualizar documento de venta con número de comprobante
            await snap.ref.update({
                invoiceNumber: `${serie}-${String(correlativo).padStart(8, '0')}`,
                invoiceType: tipoComprobante,
                invoiceSeries: serie,
                invoiceCorrelative: correlativo,
                invoiceStatus: 'emitido',
                invoicePDF: response.pdfUrl || null,
                invoiceXML: response.xmlUrl || null,
                sunatResponse: response.sunatResponse || null,
                invoiceGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            console.log(`[generateInvoice] Comprobante generado exitosamente: ${serie}-${correlativo}`);

            return { success: true, invoiceNumber: `${serie}-${correlativo}` };

        } catch (error) {
            console.error('[generateInvoice] Error:', error);

            // Actualizar documento con error
            await snap.ref.update({
                invoiceStatus: 'error',
                invoiceError: error.message,
                invoiceErrorAt: admin.firestore.FieldValue.serverTimestamp()
            });

            return { success: false, error: error.message };
        }
    });

// ==================================
// HELPER FUNCTIONS
// ==================================

function numeroALetras(num) {
    const unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE'];
    const decenas = ['', 'DIEZ', 'VEINTE', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA', 'OCHENTA', 'NOVENTA'];
    const especiales = ['DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISÉIS', 'DIECISIETE', 'DIECIOCHO', 'DIECINUEVE'];
    const centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS', 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    const convertirGrupo = (n) => {
        if (n === 0) return '';
        if (n < 10) return unidades[n];
        if (n >= 10 && n < 20) return especiales[n - 10];
        if (n >= 20 && n < 100) {
            const dec = Math.floor(n / 10);
            const uni = n % 10;
            return uni === 0 ? decenas[dec] : `${decenas[dec]} Y ${unidades[uni]}`;
        }
        if (n === 100) return 'CIEN';
        if (n < 1000) {
            const cen = Math.floor(n / 100);
            const resto = n % 100;
            return resto === 0 ? centenas[cen] : `${centenas[cen]} ${convertirGrupo(resto)}`;
        }
    };

    const entero = Math.floor(num);
    const decimal = Math.round((num - entero) * 100);

    if (entero === 0) {
        return `CERO Y ${String(decimal).padStart(2, '0')}/100 SOLES`;
    }

    let resultado = '';

    if (entero >= 1000) {
        const miles = Math.floor(entero / 1000);
        resultado += miles === 1 ? 'MIL ' : `${convertirGrupo(miles)} MIL `;
        entero = entero % 1000;
    }

    if (entero > 0) {
        resultado += convertirGrupo(entero);
    }

    return `${resultado.trim()} Y ${String(decimal).padStart(2, '0')}/100 SOLES`;
}

function calculateBaseValue(total, impuesto) {
    if (impuesto === '18') {
        return parseFloat((total / 1.18).toFixed(2));
    }
    return total;
}

async function getNextCorrelative(serie) {
    const counterRef = admin.firestore().collection('counters').doc(`invoice_${serie}`);

    const result = await admin.firestore().runTransaction(async (transaction) => {
        const doc = await transaction.get(counterRef);

        let newValue = 1;
        if (doc.exists) {
            newValue = (doc.data().current || 0) + 1;
        }

        transaction.set(counterRef, { current: newValue }, { merge: true });
        return newValue;
    });

    return result;
}

async function sendToAPIsPERU(payload) {
    const url = `${APISPERU_CONFIG.baseURL}/invoice/send`;

    try {
        const response = await axios.post(url, payload, {
            headers: {
                'Authorization': `Bearer ${APISPERU_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.success) {
            return {
                pdfUrl: response.data.enlace_del_pdf || null,
                xmlUrl: response.data.enlace_del_xml || null,
                sunatResponse: response.data.sunatResponse || null
            };
        } else {
            throw new Error(response.data?.message || 'Error desconocido de APIsPERU');
        }
    } catch (error) {
        console.error('[sendToAPIsPERU] Error:', error.response?.data || error.message);
        throw new Error(error.response?.data?.message || error.message);
    }
}

// ==================================
// FUNCIÓN AUXILIAR: Obtener Token
// ==================================
exports.getAPIsPERUToken = functions.https.onCall(async (data, context) => {
    // Verificar autenticación
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    try {
        const response = await axios.post(`${APISPERU_CONFIG.baseURL}/auth/login`, {
            username: 'tu_usuario_apisperu',
            password: 'tu_password_apisperu'
        });

        return { token: response.data.token };
    } catch (error) {
        throw new functions.https.HttpsError('internal', error.message);
    }
});
