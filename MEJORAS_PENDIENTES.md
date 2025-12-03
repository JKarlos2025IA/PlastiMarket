# 🚀 Mejoras Pendientes - PlastiMarket

Este documento detalla las funcionalidades y mejoras planificadas para evolucionar el sitio web de PlastiMarket de un prototipo a una plataforma de comercio electrónico completa.

## 1. Funcionalidad y Backend (Prioridad Alta)
- [ ] **Pasarela de Pagos Real:** Integrar MercadoPago, Niubiz o Stripe para procesar tarjetas de crédito/débito reales en lugar de la simulación actual.
- [ ] **Base de Datos:** Implementar una base de datos (Firebase, MongoDB o PostgreSQL) para almacenar productos, pedidos y usuarios.
- [ ] **Panel de Administración (CMS):** Crear una interfaz privada para:
    - Subir, editar y eliminar productos.
    - Cambiar precios y stock en tiempo real.
    - Ver y gestionar los pedidos recibidos.
- [ ] **Autenticación de Usuarios:** Permitir que los clientes se registren e inicien sesión para guardar sus direcciones y ver su historial de compras.

## 2. Experiencia de Usuario (UI/UX)
- [ ] **Página de Detalle de Producto:** Crear una página individual para cada producto con más fotos, descripción detallada y productos relacionados.
- [ ] **Buscador Avanzado:** Implementar filtros por categoría, rango de precios y características (ej. micras, tamaño).
- [ ] **Botón de WhatsApp Flotante:** Agregar un botón fijo en la esquina inferior derecha para contacto rápido en cualquier momento.
- [ ] **Notificaciones de Pedido:** Enviar correos electrónicos automáticos de confirmación al cliente y al administrador cuando se realiza una compra.

## 3. SEO y Marketing
- [ ] **Optimización SEO:** Configurar `sitemap.xml`, `robots.txt` y metaetiquetas dinámicas para mejorar el posicionamiento en Google.
- [ ] **Analítica:** Integrar Google Analytics 4 y Facebook Pixel para rastrear visitas y conversiones.
- [ ] **Blog de Novedades:** Sección para publicar artículos sobre usos de los productos, noticias del sector, etc.

## 4. Infraestructura y Despliegue
- [ ] **Dominio Personalizado:** Configurar un dominio `.pe` o `.com` (ej. `www.plastimarket.pe`).
- [ ] **Hosting de Producción:** Migrar de GitHub Pages a una plataforma como Vercel, Netlify o AWS para mejor rendimiento y soporte de backend.
- [ ] **Certificado SSL:** Asegurar que todas las conexiones sean seguras (HTTPS) en el dominio final.
