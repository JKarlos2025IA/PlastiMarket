# Plan de Facturación Electrónica - PlastiMarket

## 🚀 ESTADO ACTUAL: IMPLEMENTADO (Nubefact)

**Fecha de Implementación**: 2025-12-04
**Proveedor Seleccionado**: Nubefact (PSE)
**Método**: Integración Directa Frontend (JSON)

---

## 📋 Configuración Activa (Nubefact)

### Credenciales de Prueba
- **Ruta**: `https://api.nubefact.com/api/v1/75567e96-3652-475d-9656-050478687440`
- **Token**: `403260d05154432198b839845347250444e99557457f443799650f4439169408`
- **Formato**: JSON (Estándar UBL 2.1)

### Archivos de Implementación
- `invoice-generator.js`: Lógica de construcción del JSON y envío.
- `nubefact-config.js`: Almacén de credenciales y rutas.
- `admin.js`: Integración con la UI (botón "Generar Comprobante").

---

## 🔌 APIs Utilizadas

### 1. Consulta RUC/DNI (APIsPERU)
**Estado**: ✅ ACTIVO
- **Uso**: Autocompletado de datos del cliente al registrar venta.
- **Token**: Configurado en `admin.js`.

### 2. Facturación Electrónica (Nubefact)
**Estado**: ✅ ACTIVO
- **Endpoint**: `POST /api/v1/{UUID}`
- **Funcionalidad**:
  - Generación de Facturas (F001) y Boletas (B001).
  - Respuesta inmediata con PDF (A4/Ticket) y XML.
  - Validación de datos obligatorios (Cliente, Items, Totales).

---

## ✅ Historial de Implementación

### Fase 1: Búsqueda RUC/DNI (COMPLETADA)
- **Fecha**: 2025-12-04
- **Resultado**: Búsqueda exitosa de RUC (11 dígitos) y DNI (8 dígitos) usando APIsPERU.

### Fase 2: Facturación Electrónica (COMPLETADA)
- **Fecha**: 2025-12-04
- **Cambio de Estrategia**: Se optó por Nubefact en lugar de APIsPERU para facturación debido a la facilidad de integración directa sin necesidad de firma digital manual (PSE).
- **Logros**:
  - Emisión de comprobantes desde el historial de ventas.
  - Almacenamiento de `invoiceNumber` y `invoicePdf` en Firestore.
  - Bloqueo de edición para ventas ya facturadas.

---

## 📅 Próximos Pasos (Optimización)

1. **Impresión Térmica Directa**:
   - Configurar formato de ticket 80mm para impresoras Bluetooth/USB.
   
2. **Envío por WhatsApp**:
   - Automatizar el envío del enlace del PDF al número del cliente.

3. **Pase a Producción**:
   - Reemplazar credenciales de prueba de Nubefact por las de producción.
   - Solicitar pase a producción en portal SUNAT (dar de alta al PSE Nubefact).

---

## 📚 Referencias Técnicas

### Estructura JSON Nubefact (Ejemplo Simplificado)
```json
{
  "operacion": "generar_comprobante",
  "tipo_de_comprobante": "1",
  "serie": "F001",
  "numero": "1",
  "sunat_transaction": "1",
  "cliente_tipo_de_documento": "6",
  "cliente_numero_de_documento": "20600695771",
  "cliente_denominacion": "EMPRESA X",
  "items": [
    {
      "unidad_de_medida": "NIU",
      "codigo": "001",
      "descripcion": "PRODUCTO A",
      "cantidad": "1",
      "valor_unitario": "100",
      "precio_unitario": "118",
      "subtotal": "100",
      "tipo_de_igv": "1",
      "igv": "18",
      "total": "118"
    }
  ]
}
```

---

**Estado Final**: ✅ SISTEMA DE FACTURACIÓN OPERATIVO

