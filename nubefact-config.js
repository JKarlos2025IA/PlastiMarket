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
