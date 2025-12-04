# Investigación API Facturación APIsPERU - Resultados

**Fecha**: 2025-12-04
**Investigador**: Sistema
**Objetivo**: Determinar requisitos y endpoints para facturación electrónica

---

## ✅ HALLAZGOS CLAVE

### 1. **SÍ REQUIERE CERTIFICADO DIGITAL** ⚠️

APIsPERU requiere un certificado digital para firmar los comprobantes electrónicos. Sin embargo, hay opciones:

#### Opción A: Certificado Digital Tributario (SUNAT - GRATUITO) ✅
SUNAT ofrece un Certificado Digital Tributario (CDT) **GRATIS** si cumples:
- ✅ RUC activo (no suspendido)
- ✅ Afecto a renta de tercera categoría
- ✅ No inscrito en OSE/PSE
- ✅ Ingresos dentro de límites permitidos

**Tu caso**: RUC `15606237577` - Persona Natural con Negocio
- **Puedes calificar** para el certificado gratuito de SUNAT

#### Opción B: Certificado de Entidad Privada
- Costo: ~S/ 70-100 anuales
- Proveedores: Llama.pe, Dora.pe, CertificadoDigital.pe

#### Opción C: Certificado de Prueba APIsPERU (GRATIS)
- APIsPERU ofrece certificado PFX **GRATUITO para pruebas**
- Válido solo en ambiente BETA (no producción)

---

### 2. **ENDPOINTS CONFIRMADOS** 📡

**URL Base**: `https://facturacion.apisperu.com/api/v1.3`

**Documentación oficial**: `https://facturacion.apisperu.com/doc`

#### Endpoints principales:

##### Autenticación
```
POST /auth/login
```
- Genera token válido por 24 horas
- Necesario para todas las operaciones

##### Gestión de Empresas
```
GET    /companies              # Listar empresas
POST   /companies              # Registrar empresa
PUT    /companies/{id}         # Actualizar empresa
DELETE /companies/{id}         # Eliminar empresa
```

##### Certificados
```
POST /companies/certificate/convert  # Convertir P12/PFX
POST /companies/certificate/free     # Certificado gratis pruebas
```

##### Facturación (LOS MÁS IMPORTANTES)
```
POST /invoice/send    # Enviar factura/boleta a SUNAT
POST /invoice/xml     # Generar XML
POST /invoice/pdf     # Generar PDF
```

##### Notas de Crédito/Débito
```
POST /note/send       # Enviar nota
POST /note/xml        # Generar XML nota
POST /note/pdf        # Generar PDF nota
```

---

### 3. **FORMATO DE RESPUESTA** 📄

La API devuelve:
- ✅ **XML** firmado digitalmente
- ✅ **PDF** del comprobante
- ✅ **CDR** (Constancia de Recepción de SUNAT)
- ✅ **Respuesta de SUNAT** (código y mensaje)

**Ejemplo de respuesta (JSON)**:
```json
{
  "success": true,
  "data": {
    "numero_comprobante": "F001-00000123",
    "xml": "base64_encoded_xml",
    "pdf": "base64_encoded_pdf",
    "pdf_url": "https://facturacion.apisperu.com/downloads/...",
    "xml_url": "https://facturacion.apisperu.com/downloads/...",
    "cdr": "base64_encoded_cdr",
    "sunat_response": {
      "code": "0",
      "description": "La Factura numero F001-00000123, ha sido aceptada"
    }
  }
}
```

---

## 🎯 CONCLUSIONES

### ✅ Buenas Noticias:
1. **APIsPERU Premium ya lo tienes contratado** (S/ 25/mes)
2. **Documentación completa disponible**
3. **Certificado de prueba GRATIS** para desarrollo
4. **Posible certificado GRATUITO de SUNAT** para producción

### ⚠️ Requisitos Identificados:
1. **Certificado Digital** (gratuito de SUNAT o de prueba APIsPERU)
2. **Configurar empresa en APIsPERU** (via `/companies`)
3. **Obtener token de autenticación** (via `/auth/login`)
4. **Firebase Functions** para integración

### ⏱️ Timeline Actualizado:

**Con certificado gratuito de SUNAT**:
- Solicitar certificado SUNAT: 1-3 días
- Configurar Firebase Functions: 2-3 días
- Pruebas en BETA: 2-3 días
- **TOTAL: 5-9 días (1-1.5 semanas)**

**Con certificado de prueba APIsPERU** (más rápido):
- Obtener certificado prueba: INMEDIATO
- Configurar Firebase Functions: 2-3 días
- Pruebas en BETA: 2-3 días
- Migrar a certificado real: 1-3 días
- **TOTAL: 6-10 días (1-2 semanas)**

---

## 📋 PRÓXIMOS PASOS RECOMENDADOS

### Opción 1: Ruta Rápida (Recomendada para aprender) 🚀
1. Usar certificado de prueba de APIsPERU (GRATIS)
2. Implementar Firebase Functions
3. Probar en ambiente BETA
4. Luego migrar a cerificado real de SUNAT

### Opción 2: Ruta Formal
1. Solicitar Certificado Digital Tributario gratuito SUNAT
2. Esperar aprobación (1-3 días)
3. Implementar Firebase Functions
4. Ir directo a producción

---

## 🔗 Referencias

- Documentación: https://facturacion.apisperu.com/doc
- Swagger UI: https://facturacion.apisperu.com/doc/swagger/ui
- Soporte: soporte@apisperu.com
- Certificado SUNAT: https://www.sunat.gob.pe/

**Fecha de investigación**: 2025-12-04 15:16
