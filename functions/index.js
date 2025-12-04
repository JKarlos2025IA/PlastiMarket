const functions = require('firebase-functions');
const admin = require('firebase-admin');
const axios = require('axios');

admin.initializeApp();

// ==================================
// CONFIGURACIÓN NUBEFACT 
// ==================================

const NUBEFACT_CONFIG = {
    apiUrl: 'https://api.nubefact.com/api/v1/d35d9433-89d8-4883-8d75-daafbc1365e5',
    token: '5be2331e4c644d678a21a60001fab5ce7d338b19017e46a0bd1bb016b7d9edbc',
    ruc: '15606237577',
    razonSocial: 'SILVA GUEDEZ LEONARDO JOSE',
    nombreComercial: 'PLASTIMARKET'
};

// ==================================
// FUNCIÓN: Generar Comprobante Manual
// ==================================

exports.generateInvoiceManual = functions.https.onCall(async (data, context) => {
    // Verificar autenticación
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    const { saleId } = data;

    if (!saleId) {
        throw new functions.https.HttpsError('invalid-argument', 'Se requiere saleId');
    }

    console.log(`[NubeFact] Generando comprobante para venta: ${saleId}`);

    try {
        // 1. Obtener datos de la venta
        const saleRef = admin.firestore().collection('ventas').doc(saleId);
        const saleSnap = await saleRef.get();

        if (!saleSnap.exists) {
            throw new functions.https.HttpsError('not-found', 'Venta no encontrada');
        }

        const saleData = saleSnap.data();

        // 2. Validar que tenga items
        if (!saleData.items || saleData.items.length === 0) {
            throw new functions.https.HttpsError('failed-precondition', 'La venta no tiene items');
        }

        // 3. Determinar tipo de comprobante
        const tipoComprobante = saleData.documento?.length === 11 ? 1 : 3; // 1=Factura, 3=Boleta
        const serie = tipoComprobante === 1 ? 'F001' : 'B001'; // F001=Factura, B001=Boleta

        // 4. Obtener siguiente correlativo
        const correlativo = await getNextCorrelative(serie);

        // 5. Preparar payload para NubeFact
        const invoicePayload = {
            operacion: "generar_comprobante",
            tipo_de_comprobante: tipoComprobante,
            serie: serie,
            numero: correlativo,
            sunat_transaction: 1,
            cliente_tipo_de_documento: saleData.documento?.length === 11 ? "6" : "1",
            cliente_numero_de_documento: saleData.documento || "00000000",
            cliente_denominacion: saleData.cliente || "CLIENTE VARIOS",
            cliente_direccion: "Lima, Perú",
            fecha_de_emision: saleData.fecha || new Date().toISOString().split('T')[0],
            moneda: 1,
            tipo_de_cambio: "",
            porcentaje_de_igv: 18,
            descuento_global: "",
            total_descuento: "",
            total_anticipo: "",
            total_gravada: parseFloat((saleData.subtotal || 0).toFixed(2)),
            total_inafecta: 0,
            total_exonerada: 0,
            total_igv: parseFloat((saleData.igv || 0).toFixed(2)),
            total_gratuita: 0,
            total_otros_cargos: 0,
            total: parseFloat((saleData.total || 0).toFixed(2)),
            percepcion_tipo: "",
            percepcion_base_imponible: "",
            total_percepcion: "",
            total_incluido_percepcion: "",
            detraccion: false,
            observaciones: "",
            documento_que_se_modifica_tipo: "",
            documento_que_se_modifica_serie: "",
            documento_que_se_modifica_numero: "",
            tipo_de_nota_de_credito: "",
            tipo_de_nota_de_debito: "",
            enviar_automaticamente_a_la_sunat: true,
            enviar_automaticamente_al_cliente: false,
            codigo_unico: "",
            condiciones_de_pago: saleData.pago === 'Efectivo' || saleData.pago === 'Yape' || saleData.pago === 'Plin' ? "Contado" : "Credito",
            medio_de_pago: getMedioPago(saleData.pago),
            items: saleData.items.map((item, index) => {
                const baseValue = calculateBaseValue(item.total, item.impuesto);
                const igvValue = item.impuesto === '18' ? (item.total - baseValue) : 0;

                return {
                    unidad_de_medida: item.unidad || "NIU",
                    codigo: item.codigo || `PROD${String(index + 1).padStart(3, '0')}`,
                    descripcion: item.producto,
                    cantidad: parseFloat(item.cantidad),
                    valor_unitario: parseFloat((item.precio_unit / (item.impuesto === '18' ? 1.18 : 1)).toFixed(2)),
                    precio_unitario: parseFloat(item.precio_unit.toFixed(2)),
                    descuento: "",
                    subtotal: parseFloat(baseValue.toFixed(2)),
                    tipo_de_igv: item.impuesto === '18' ? 1 : 2,
                    igv: parseFloat(igvValue.toFixed(2)),
                    total: parseFloat(item.total.toFixed(2)),
                    anticipo_regularizacion: false,
                    anticipo_documento_serie: "",
                    anticipo_documento_numero: ""
                };
            })
        };

        console.log('[NubeFact] Payload:', JSON.stringify(invoicePayload, null, 2));

        // 6. Enviar a NubeFact
        const response = await axios.post(NUBEFACT_CONFIG.apiUrl, invoicePayload, {
            headers: {
                'Authorization': `Bearer ${NUBEFACT_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        });

        const nubefactData = response.data;
        console.log('[NubeFact] Respuesta:', nubefactData);

        // 7. Verificar errores
        if (nubefactData.errors) {
            throw new functions.https.HttpsError('internal', nubefactData.errors);
        }

        // 8. Actualizar venta en Firestore
        await saleRef.update({
            invoiceNumber: `${serie}-${String(correlativo).padStart(8, '0')}`,
            invoiceType: tipoComprobante === 1 ? 'Factura' : 'Boleta',
            invoiceSeries: serie,
            invoiceCorrelative: correlativo,
            invoiceStatus: 'emitido',
            invoicePDF: nubefactData.enlace_del_pdf || null,
            invoiceXML: nubefactData.enlace_del_xml || null,
            invoiceCDR: nubefactData.enlace_del_cdr || null,
            sunatResponse: nubefactData.aceptada_por_sunat ? 'Aceptado' : 'Pendiente',
            nubefactResponse: nubefactData,
            invoiceGeneratedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[NubeFact] Comprobante generado: ${serie}-${correlativo}`);

        return {
            success: true,
            invoiceNumber: `${serie}-${String(correlativo).padStart(8, '0')}`,
            pdfUrl: nubefactData.enlace_del_pdf,
            xmlUrl: nubefactData.enlace_del_xml,
            message: '¡Comprobante generado exitosamente!'
        };

    } catch (error) {
        console.error('[NubeFact] Error:', error.response?.data || error.message);

        // Actualizar con error
        try {
            await admin.firestore().collection('ventas').doc(saleId).update({
                invoiceStatus: 'error',
                invoiceError: error.response?.data?.errors || error.message,
                invoiceErrorAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } catch (updateError) {
            console.error('[NubeFact] Error al actualizar:', updateError);
        }

        throw new functions.https.HttpsError('internal', error.response?.data?.errors || error.message);
    }
});

// ==================================
// FUNCIÓN: Prueba de Conexión NubeFact
// ==================================

exports.testNubeFact = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', 'Usuario no autenticado');
    }

    try {
        // Enviar comprobante de prueba
        const testPayload = {
            operacion: "generar_comprobante",
            tipo_de_comprobante: 3,
            serie: "B001",
            numero: await getNextCorrelative('B001'),
            sunat_transaction: 1,
            cliente_tipo_de_documento: "1",
            cliente_numero_de_documento: "12345678",
            cliente_denominacion: "CLIENTE DE PRUEBA",
            cliente_direccion: "Lima, Perú",
            fecha_de_emision: new Date().toISOString().split('T')[0],
            moneda: 1,
            porcentaje_de_igv: 18,
            total_gravada: 84.75,
            total_inafecta: 0,
            total_exonerada: 0,
            total_igv: 15.25,
            total: 100.00,
            enviar_automaticamente_a_la_sunat: true,
            enviar_automaticamente_al_cliente: false,
            items: [{
                unidad_de_medida: "NIU",
                codigo: "PROD001",
                descripcion: "PRODUCTO DE PRUEBA",
                cantidad: 1,
                valor_unitario: 84.75,
                precio_unitario: 100.00,
                subtotal: 84.75,
                tipo_de_igv: 1,
                igv: 15.25,
                total: 100.00,
                anticipo_regularizacion: false
            }]
        };

        const response = await axios.post(NUBEFACT_CONFIG.apiUrl, testPayload, {
            headers: {
                'Authorization': `Bearer ${NUBEFACT_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        });

        return {
            success: true,
            data: response.data
        };

    } catch (error) {
        console.error('[testNubeFact] Error:', error.response?.data || error.message);
        throw new functions.https.HttpsError('internal', error.response?.data?.errors || error.message);
    }
});

// ==================================
// HELPER FUNCTIONS
// ==================================

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

function calculateBaseValue(total, impuesto) {
    if (impuesto === '18') {
        return parseFloat((total / 1.18).toFixed(2));
    }
    return total;
}

function getMedioPago(pago) {
    const medios = {
        'Efectivo': '001',
        'Yape': '003',
        'Plin': '003',
        'Transferencia': '003',
        'Credito': '002'
    };
    return medios[pago] || '001';
}
