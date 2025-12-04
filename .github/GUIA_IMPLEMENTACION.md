# Guía de Implementación - Facturación Electrónica

**Creado**: 2025-12-04
**Estado**: En progreso - Fase 2 de 5

---

## ✅ LO QUE YA ESTÁ HECHO

### 1. Estructura de Firebase Functions
- ✅ Carpeta `functions/` creada
- ✅ `functions/package.json` - Dependencias configuradas
- ✅ `functions/index.js` - Cloud Function principal
- ✅ `functions/.env.example` - Plantilla de variables
- ✅ `firebase.json` - Configuración actualizada
- ✅ `.gitignore` - Protección de credenciales

### 2. Cloud Function `generateInvoice`
**Trigger**: Cuando se crea un documento en `ventas/`  
**Acción**: Genera comprobante electrónico automáticamente

**Flujo**:
1. Detecta nueva venta en Firestore
2. Valida datos y determina tipo de comprobante (Factura/Boleta)
3. Genera siguiente correlativo
4. Prepara payload para APIsPERU
5. Envía a APIsPERU para generar PDF/XML
6. Actualiza documento con número de comprobante

---

## ⏳ PRÓXIMOS PASOS

### Paso 1: Instalar dependencias
```bash
cd functions
npm install
```
**Estado**: ⏳ En progreso

### Paso 2: Configurar variables de entorno
Opción A - Desarrollo local:
```bash
cp functions/.env.example functions/.env
# Editar functions/.env con tus credenciales reales
```

Opción B - Firebase (producción):
```bash
firebase functions:config:set apisperu.token="TU_TOKEN_FACTURACION"
firebase functions:config:set apisperu.ruc="15606237577"
firebase functions:config:set apisperu.usuario_sol="DOFESIVA"
firebase functions:config:set apisperu.clave_sol="strangeno"
```

### Paso 3: Obtener Token de Facturación APIsPERU
1. Ir a https://facturacion.apisperu.com
2. Iniciar sesión con tu cuenta
3. Obtener token de facturación (diferente al de consultas)
4. Si usas certificado de prueba, solicitarlo en la plataforma

### Paso 4: Probar localmente
```bash
# Instalar Firebase Tools si no lo tienes
npm install -g firebase-tools

# Iniciar emulador de Functions
firebase emulators:start --only functions

# La función estará disponible en:
# http://localhost:5001/plastimarket-xxxxx/us-central1/generateInvoice
```

### Paso 5: Desplegar a Firebase
```bash
firebase deploy --only functions
```

---

## 🔧 CONFIGURACIÓN REQUERIDA

### Credenciales APIsPERU Necesarias:

| Variable | Valor Actual | Dónde Obtener |
|----------|--------------|---------------|
| `APISPERU_RUC` | 15606237577 | ✅ Ya lo tienes |
| `APISPERU_USUARIO_SOL` | DOFESIVA | ✅ Ya lo tienes |
| `SUNAT_CLAVE_SOL` | strangeno | ✅ Ya lo tienes |
| `APISPERU_FACTURACION_TOKEN` | ❌ Falta | Panel APIsPERU |

### Cómo obtener el token de facturación:
1. Login en https://facturacion.apisperu.com
2. Ir a "API" o "Integración"
3. Copiar token de autenticación
4. Alternativamente, usar endpoint `/auth/login`

---

## 📝 ESTRUCTURA DE DATOS

### Documento de Venta (Firestore)
Campos nuevos que se agregarán automáticamente:
```javascript
{
  // Campos existentes...
  fecha: "2025-12-04",
  cliente: "Nombre Cliente",
  documento: "12345678", // DNI o RUC
  items: [...],
  total: 100.00,
  
  // Campos NUEVOS de facturación
  invoiceNumber: "F001-00000001",     // Número del comprobante
  invoiceType: "01",                   // 01=Factura, 03=Boleta
  invoiceSeries: "F001",               // Serie
  invoiceCorrelative: 1,               // Correlativo
  invoiceStatus: "emitido",            // Estado: emitido | error | pendiente
  invoicePDF: "https://...",           // URL del PDF
  invoiceXML: "https://...",           // URL del XML
  sunatResponse: {...},                // Respuesta de SUNAT
  invoiceGeneratedAt: timestamp        // Fecha de generación
}
```

---

## ⚠️ NOTAS IMPORTANTES

### Certificado Digital
La implementación actual está preparada para:
1. **Certificado de prueba** APIsPERU (GRATIS - para desarrollo)
2. **Certificado real** SUNAT (GRATIS - para producción)

### Ambiente de Pruebas
- APIsPERU procesa automáticamente en ambiente BETA si usas certificado de prueba
- Los comprobantes de prueba NO son válidos fiscalmente
- Una vez listo, migrar a certificado real de SUNAT

### Costos
- APIsPERU Premium: S/ 25/mes (YA CONTRATADO) ✅
- Firebase Functions: ~S/ 0-10/mes (según uso)
- Certificado Digital: S/ 0 (Gratis de SUNAT) ✅

---

## 🐛 DEBUGGING

### Ver logs de la función:
```bash
firebase functions:log
```

### Probar manualmente:
```javascript
// Desde la consola de Firebase
const testSale = {
  fecha: "2025-12-04",
  cliente: "CLIENTE PRUEBA",
  documento: "12345678",
  items: [{
    producto: "Producto Test",
    cantidad: 1,
    precio_unit: 10,
    total: 10,
    impuesto: "18"
  }],
  subtotal: 8.47,
  igv: 1.53,
  total: 10,
  pago: "Efectivo"
};

// Firestore creará automáticamente el documento
// y la función se disparará
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [x] Crear estructura de Functions
- [x] Configurar package.json
- [x] Implementar generateInvoice function
- [ ] Instalar dependencias (npm install)
- [ ] Obtener token de facturación APIsPERU
- [ ] Configurar variables de entorno
- [ ] Probar localmente con emulador
- [ ] Desplegar a Firebase
- [ ] Emitir primer comprobante de prueba
- [ ] Validar PDF generado
- [ ] Documentar resultados

---

**Última actualización**: En progreso - instalando dependencias
