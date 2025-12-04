// ============================================
// CONFIGURACIÓN DE NUBEFACT
// ============================================

const NUBEFACT_CONFIG = {
    // API Endpoint
    apiUrl: 'https://api.nubefact.com/api/v1/d35d9433-89d8-4883-8d75-daafbc1365e5',

    // Token de autenticación
    token: '5be2331e4c644d678a21a60001fab5ce7d338b19017e46a0bd1bb016b7d9edbc',

    // Datos de la empresa
    ruc: '15606237577',
    razonSocial: 'SILVA GUEDEZ LEONARDO JOSE',
    nombreComercial: 'PLASTIMARKET',

    // Código de cliente NubeFact
    codigoCliente: 'NF46894',

    // Series de comprobantes
    series: {
        factura: 'F001',
        boleta: 'B001'
    },

    // Modo de prueba (cambiar a false en producción)
    modoPrueba: true
};

// Exportar configuración
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NUBEFACT_CONFIG;
}
