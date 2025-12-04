# Plan de Facturación Electrónica - PlastiMarket

## 📋 Información de Cuenta APIsPERU

### Credenciales Activas
- **Email**: leonardosilva201984@gmail.com
- **RUC**: 15606237577 - SILVA GUEDEZ LEONARDO JOSE
- **Tipo**: Persona Natural con Negocio
- **Usuario SOL**: DOFESIVA
- **Plan**: Premium (S/ 25/mes - comprobantes ilimitados)

### Token de API
```
eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imxlb25hcmRvc2lsdmEyMDE5ODRAZ21haWwuY29tIn0.QYhQlE0qurCjc2COCmX3oY3cf3lkFAb2z9A17yr_9pQ
```

---

## 🔌 APIs Disponibles

### 1. Consulta RUC
**Endpoint**: `GET https://dniruc.apisperu.com/api/v1/ruc/{numero}?token={TOKEN}`

**Respuesta**:
```json
{
  "ruc": "string",
  "razonSocial": "string",
  "nombreComercial": "string",
  "telefonos": [],
  "estado": "string",
  "condicion": "string",
  "direccion": "string",
  "departamento": "string",
  "provincia": "string",
  "distrito": "string",
  "ubigeo": "string",
  "capital": "string"
}
```

### 2. Consulta DNI
**Endpoint**: `GET https://dniruc.apisperu.com/api/v1/dni/{numero}?token={TOKEN}`

**Respuesta**:
```json
{
  "dni": "string",
  "nombres": "string",
  "apellidoPaterno": "string",
  "apellidoMaterno": "string",
  "codVerifica": "string"
}
```

### 3. Facturación Electrónica (Próximamente)
**Endpoint**: `POST https://api.apisperu.com/v1/facturacion/generar`

**Documentación completa**: Ver [swagger.json](file:///c:/Users/juan.montenegro/.gemini/antigravity/scratch/plasticos-web/swagger.json)

---

## ✅ Implementación Actual

### Fase 1: Búsqueda RUC/DNI (Lista para implementar)

Ya tienes todo lo necesario para implementar la búsqueda automática de RUC/DNI en el formulario de ventas.

**Archivo a modificar**: [admin.js](file:///c:/Users/juan.montenegro/.gemini/antigravity/scratch/plasticos-web/admin.js)

```javascript
const APISPERU_TOKEN = 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJlbWFpbCI6Imxlb25hcmRvc2lsdmEyMDE5ODRAZ21haWwuY29tIn0.QYhQlE0qurCjc2COCmX3oY3cf3lkFAb2z9A17yr_9pQ';

async function searchRUC() {
    const docInput = document.getElementById('documento');
    const clienteInput = document.getElementById('cliente');
    const numero = docInput.value.trim();
    
    if (!numero) {
        alert('Ingrese un RUC o DNI');
        return;
    }
    
    const btn = document.getElementById('btn-search-ruc');
    btn.disabled = true;
    btn.innerHTML = '<i class="ph ph-spinner"></i>';
    
    try {
        if (numero.length === 11) {
            // Consulta RUC
            const response = await fetch(
                `https://dniruc.apisperu.com/api/v1/ruc/${numero}?token=${APISPERU_TOKEN}`
            );
            const data = await response.json();
            
            if (data.ruc) {
                clienteInput.value = data.razonSocial || data.nombreComercial;
            }
        } else if (numero.length === 8) {
            // Consulta DNI
            const response = await fetch(
                `https://dniruc.apisperu.com/api/v1/dni/${numero}?token=${APISPERU_TOKEN}`
            );
            const data = await response.json();
            
            if (data.dni) {
                clienteInput.value = `${data.nombres} ${data.apellidoPaterno} ${data.apellidoMaterno}`;
            }
        }
    } catch (error) {
        console.error('Error:', error);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="ph ph-magnifying-glass"></i>';
    }
}

// Conectar evento
document.getElementById('btn-search-ruc').addEventListener('click', searchRUC);
```

---

## 📅 Fase 2: Facturación Electrónica

### Requisitos Previos
1. ✅ Cuenta APIsPERU (YA TIENES)
2. ⏳ Certificado Digital Tributario (por obtener)
3. ⏳ Configurar Firebase Functions

### Costo Mensual
- APIsPERU Premium: **S/ 25** (ya contratado) ✅
- Firebase Functions: ~S/ 0-10
- Firebase Storage: ~S/ 0-5
- **TOTAL: S/ 25-40/mes**

### Cronograma
1. **Implementar búsqueda RUC/DNI** (1-2 días) ← **SIGUIENTE PASO**
2. Configurar Firebase Functions (3-5 días)
3. Obtener Certificado Digital (1 semana)
4. Pruebas con SUNAT (1-2 semanas)
5. Producción (1 día)

**Total estimado: 3-4 semanas**

---

## 🔐 Seguridad

> [!CAUTION]
> **Nunca subir credenciales a Git**: El token de API debe estar en variables de entorno o Firebase Config, NUNCA en el código.

**Variables de entorno recomendadas**:
```env
APISPERU_TOKEN=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...
APISPERU_RUC=15606237577
SUNAT_USUARIO_SOL=DOFESIVA
SUNAT_PASSWORD=strangeno
```

---

## 📚 Referencias

- **Documentación API**: [swagger.json](file:///c:/Users/juan.montenegro/.gemini/antigravity/scratch/plasticos-web/swagger.json)
- **Plan completo**: [implementation_plan.md](file:///C:/Users/juan.montenegro/.gemini/antigravity/brain/0ea6c60d-e1c6-48b1-b307-2ec847260876/implementation_plan.md)
- **Soporte APIsPERU**: soporte@apisperu.com

---

## ✅ Siguiente Acción

**¿Quieres implementar la búsqueda RUC/DNI AHORA?**

Es un cambio rápido (15 minutos) que mejorará inmediatamente la experiencia:
- ✅ Sin costos adicionales (ya tienes el servicio)
- ✅ Autocompletado de nombres
- ✅ Menos errores de tipeo
- ✅ Datos validados por SUNAT/RENIEC
