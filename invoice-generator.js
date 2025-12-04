// ============================================
// GENERADOR DE COMPROBANTES CON NUBEFACT
// ============================================

import { db } from './firebase-config.js';
import { doc, updateDoc, getDoc, setDoc, runTransaction } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Configuración de NubeFact
const NUBEFACT_CONFIG = {
    apiUrl: 'https://api.nubefact.com/api/v1/d35d9433-89d8-4883-8d75-daafbc1365e5',
    token: '5be2331e4c644d678a21a60001fab5ce7d338b19017e46a0bd1bb016b7d9edbc',
    ruc: '15606237577',
    razonSocial: 'SILVA GUEDEZ LEONARDO JOSE',
    nombreComercial: 'PLASTIMARKET'
};

/**
 * Genera un comprobante electrónico usando NubeFact
 * @param {string} saleId - ID de la venta en Firestore
 * @returns {Promise<Object>} Resultado de la operación
 */
export async function generateInvoice(saleId) {
    try {
        console.log(`[NubeFact] Generando comprobante para venta: ${saleId}`);

        // 1. Obtener datos de la venta desde Firestore
        const saleRef = doc(db, 'ventas', saleId);
        const saleSnap = await getDoc(saleRef);

        if (!saleSnap.exists()) {
            throw new Error('Venta no encontrada');
        }

        const saleData = saleSnap.data();

        // 2. Validar que la venta tenga items
        if (!saleData.items || saleData.items.length === 0) {
            throw new Error('La venta no tiene items');
        }

        // 3. Determinar tipo de comprobante
        const tipoComprobante = saleData.documento?.length === 11 ? 1 : 3; // 1=Factura, 3=Boleta
        const serie = tipoComprobante === 1 ? 'F001' : 'B001';

        // 4. Obtener siguiente correlativo
        const correlativo = await getNextCorrelative(serie);

        // 5. Preparar payload para NubeFact
        const invoicePayload = {
            operacion: "generar_comprobante",
            tipo_de_comprobante: tipoComprobante,
            serie: serie,
            numero: correlativo,
            sunat_transaction: 1, // 1 = Venta interna
            cliente_tipo_de_documento: saleData.documento?.length === 11 ? "6" : "1", // 6=RUC, 1=DNI
            cliente_numero_de_documento: saleData.documento || "00000000",
            cliente_denominacion: saleData.cliente || "CLIENTE VARIOS",
            cliente_direccion: "Lima, Perú",
            fecha_de_emision: saleData.fecha || new Date().toISOString().split('T')[0],
            moneda: 1, // 1 = PEN (Soles)
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

            // Items
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
                    tipo_de_igv: item.impuesto === '18' ? 1 : 2, // 1=Gravado, 2=Exonerado
                    igv: parseFloat(igvValue.toFixed(2)),
                    total: parseFloat(item.total.toFixed(2)),
                    anticipo_regularizacion: false,
                    anticipo_documento_serie: "",
                    anticipo_documento_numero: ""
                };
            })
        };

        console.log('[NubeFact] Payload preparado:', JSON.stringify(invoicePayload, null, 2));

        // 6. Enviar a NubeFact
        const response = await sendToNubeFact(invoicePayload);

        console.log('[NubeFact] Respuesta:', response);

        // 7. Actualizar venta en Firestore
        await updateDoc(saleRef, {
            invoiceNumber: `${serie}-${String(correlativo).padStart(8, '0')}`,
            invoiceType: tipoComprobante === 1 ? 'Factura' : 'Boleta',
            invoiceSeries: serie,
            invoiceCorrelative: correlativo,
            invoiceStatus: response.errors ? 'error' : 'emitido',
            invoicePDF: response.enlace_del_pdf || null,
            invoiceXML: response.enlace_del_xml || null,
            invoiceCDR: response.enlace_del_cdr || null,
            sunatResponse: response.aceptada_por_sunat ? 'Aceptado' : 'Pendiente',
            nubefactResponse: response,
            invoiceGeneratedAt: new Date().toISOString(),
            invoiceError: response.errors || null
        });

        return {
            success: !response.errors,
            invoiceNumber: `${serie}-${String(correlativo).padStart(8, '0')}`,
            pdfUrl: response.enlace_del_pdf,
            xmlUrl: response.enlace_del_xml,
            message: response.errors || '¡Comprobante generado exitosamente!'
        };

    } catch (error) {
        console.error('[NubeFact] Error:', error);

        // Actualizar con error
        try {
            await updateDoc(doc(db, 'ventas', saleId), {
                invoiceStatus: 'error',
                invoiceError: error.message,
                invoiceErrorAt: new Date().toISOString()
            });
        } catch (updateError) {
            console.error('[NubeFact] Error al actualizar estado:', updateError);
        }

        throw error;
    }
}

/**
 * Envía el comprobante a NubeFact
 */
async function sendToNubeFact(payload) {
    const response = await fetch(NUBEFACT_CONFIG.apiUrl, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${NUBEFACT_CONFIG.token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error de NubeFact: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * Obtiene el siguiente correlativo para una serie
 */
async function getNextCorrelative(serie) {
    const counterRef = doc(db, 'counters', `invoice_${serie}`);

    const result = await runTransaction(db, async (transaction) => {
        const counterDoc = await transaction.get(counterRef);

        let newValue = 1;
        if (counterDoc.exists()) {
            newValue = (counterDoc.data().current || 0) + 1;
        }

        transaction.set(counterRef, { current: newValue }, { merge: true });
        return newValue;
    });

    return result;
}

/**
 * Calcula el valor base sin IGV
 */
function calculateBaseValue(total, impuesto) {
    if (impuesto === '18') {
        return total / 1.18;
    }
    return total;
}

/**
 * Convierte método de pago a código NubeFact
 */
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

// Exportar función principal
window.generateInvoice = generateInvoice;
