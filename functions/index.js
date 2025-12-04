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

            // 4. Preparar datos para APIsPERU
            const invoicePayload = {
                ruc: APISPERU_CONFIG.ruc,
                usuarioSol: APISPERU_CONFIG.usuarioSol,
                claveSol: APISPERU_CONFIG.claveSol,
                tipoDoc: tipoComprobante,
                serie: serie,
                numero: correlativo,
                fechaEmision: saleData.fecha,
                tipoMoneda: 'PEN',
                client: {
                    tipoDoc: saleData.documento?.length === 11 ? '6' : '1',
                    numDoc: saleData.documento || '00000000',
                    rznSocial: saleData.cliente || 'CLIENTE VARIOS'
                },
                company: {
                    ruc: APISPERU_CONFIG.ruc,
                    razonSocial: 'SILVA GUEDEZ LEONARDO JOSE',
                    nombreComercial: 'PLASTIMARKET',
                    address: {
                        direccion: 'Dirección de la empresa'
                    }
                },
                details: saleData.items.map((item, index) => ({
                    codProducto: item.codigo || `ITEM${index + 1}`,
                    unidad: item.unidad || 'NIU',
                    descripcion: item.producto,
                    cantidad: item.cantidad,
                    mtoValorUnitario: calculateBaseValue(item.precio_unit, item.impuesto),
                    mtoValorVenta: calculateBaseValue(item.total, item.impuesto),
                    mtoBaseIgv: calculateBaseValue(item.total, item.impuesto),
                    porcentajeIgv: item.impuesto === '18' ? 18 : 0,
                    igv: item.impuesto === '18' ? (item.total - calculateBaseValue(item.total, item.impuesto)) : 0,
                    tipAfeIgv: item.impuesto === '18' ? 10 : 20, // 10=Gravado, 20=Exonerado
                    totalImpuestos: item.impuesto === '18' ? (item.total - calculateBaseValue(item.total, item.impuesto)) : 0,
                    mtoValorGratuito: 0
                })),
                mtoOperGravadas: saleData.subtotal || 0,
                mtoOperExoneradas: 0,
                mtoIGV: saleData.igv || 0,
                totalImpuestos: saleData.igv || 0,
                valorVenta: saleData.subtotal || 0,
                subTotal: saleData.total || 0,
                mtoImpVenta: saleData.total || 0,
                formaPago: {
                    moneda: 'PEN',
                    tipo: saleData.pago === 'Efectivo' || saleData.pago === 'Yape' || saleData.pago === 'Plin' ? 'Contado' : 'Credito'
                }
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
