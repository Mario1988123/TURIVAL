# 🎬 EMPEZAR AHORA - FinePath ERP

## ⚡ 5 Minutos para Tener Todo Configurado

### Paso 1: Leer (2 minutos)
Abre y lee estos documentos en orden:
1. **EXECUTIVE_SUMMARY.md** - Entender qué es
2. **SETUP.md** - Pasos de setup

### Paso 2: Base de Datos (3 minutos)
1. Abre https://supabase.com/dashboard
2. Selecciona tu proyecto
3. Ve a **SQL Editor** → **+ New Query**
4. Abre `DATABASE_SETUP.md`
5. Copia TODO el SQL de "Paso 2"
6. Pégalo en el editor y ejecuta (Ctrl+Enter)
7. Crea OTRA query
8. Copia TODO el SQL de "Paso 3"
9. Ejecuta

**Espera a que terminen ambas queries** ✅

### Paso 3: Credenciales (1 minuto)
En el dashboard de Supabase, ve a **Settings → API**

Copia:
- `Project URL` 
- `anon public` (Anon Key)

### Paso 4: Crear `.env.local` (1 minuto)
Abre terminal en la raíz del proyecto y ejecuta:

```bash
cat > .env.local << 'EOF'
NEXT_PUBLIC_SUPABASE_URL=AQUI_PEGA_PROJECT_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=AQUI_PEGA_ANON_KEY
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000/auth/callback
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

Reemplaza los valores entre mayúsculas con los que copiaste.

### Paso 5: Ejecutar (automático)
```bash
pnpm install
pnpm dev
```

Espera a ver:
```
▲ Next.js 16.2.0
- Local:        http://localhost:3000
```

✅ **¡YA ESTÁ!** Abre http://localhost:3000 en el navegador.

---

## 🔐 Primer Login

### Crear Usuario
1. Va a `/auth/sign-up` automáticamente
2. Completa:
   - Email: ejemplo@correo.com
   - Contraseña: algo123456
3. Clic en "Sign Up"

### Confirmar Email (Desarrollo)
1. Vuelve a https://supabase.com/dashboard
2. Ve a **Authentication → Users**
3. Encuentra el usuario que creaste
4. Haz clic en **User Details**
5. En la sección "Email", marca el checkbox "Confirm email address"
6. Clic en **Save**

### Login
1. Va a `/auth/login`
2. Email: el que registraste
3. Contraseña: la que pusiste
4. Clic "Sign In"

✅ **Verás el Dashboard**

---

## 📊 Dashboard - Primeros Pasos

### Explorar
- **Dashboard** (Inicio): Estadísticas
- **Clientes**: Ver/crear clientes
- **Catálogos**: Ver productos, colores, tarifas

### Crear un Cliente
1. Ve a **Clientes**
2. Clic **Nuevo Cliente**
3. Completa:
   - Nombre comercial: Mi Empresa
   - Email: contacto@miempresa.com
   - Teléfono: +34 666 777 888
4. Clic **Guardar**

### Ver Catálogos
1. Ve a **Catálogos**
2. Explora 5 tabs:
   - Productos
   - Colores
   - Tratamientos
   - Acabados
   - Tarifas

**Los datos vienen de la BD de Supabase**

---

## 🎯 Siguiente: Crear un Presupuesto

*(Pendiente en Fase 3, pero ya tienes la lógica)*

```typescript
// En la consola del navegador o en un componente:

import { crearPresupuesto } from '@/lib/services'

const { presupuesto, lineas } = await crearPresupuesto(
  cliente_id,
  [
    {
      producto_id: '...',
      cantidad: 1,
      modo_precio: 'm2',
      ancho: 1000,
      alto: 500,
      cara_frontal: true,
      cara_trasera: true,
      precio_m2: 50,
      precio_minimo: 150,
    }
  ]
)
console.log(presupuesto.numero) // → PRES-2026-0001
console.log(presupuesto.total)  // → Calculado automáticamente
```

---

## 📁 Archivos Importantes

```
📄 EXECUTIVE_SUMMARY.md    ← Empieza aquí
📄 SETUP.md                ← Pasos de setup
📄 DATABASE_SETUP.md       ← SQL para Supabase
📄 README_ERP.md           ← Documentación técnica
📄 INDEX.md                ← Índice del proyecto
📄 PROGRESS.md             ← Progreso completado

💾 lib/services/
   ├── presupuestos.ts     ← Motor de cálculo
   ├── piezas.ts           ← Trazabilidad QR
   ├── ocr.ts              ← OCR automático
   ├── documentos.ts       ← Albaranes
   ├── clientes.ts         ← Gestión de clientes
   └── catalogo.ts         ← Catálogos

🎨 app/dashboard/
   ├── page.tsx            ← Dashboard
   ├── clientes/page.tsx   ← Clientes
   └── catalogo/page.tsx   ← Catálogos
```

---

## 🆘 Troubleshooting

### ❌ "SUPABASE_URL not found"
→ Verifica que `.env.local` existe en la raíz  
→ Recarga terminal: `Ctrl+C` y `pnpm dev` de nuevo

### ❌ "No puedo acceder a /dashboard"
→ Verifica que confirmaste el email en Supabase  
→ Intenta logout/login de nuevo

### ❌ "Las tablas no existen"
→ Verifica que ejecutaste ambos SQLs en Supabase  
→ Ve a SQL Editor y ejecuta manualmente si no funcionó

### ❌ "Error de CORS"
→ Es probable que necesites actualizar NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL  
→ Copia tu URL local real en lugar de `http://localhost:3000`

---

## 📞 Necesito Ayuda

**Lee esto primero:**
1. **DATABASE_SETUP.md** - Si es sobre BD
2. **SETUP.md** - Si es sobre setup inicial
3. **README_ERP.md** - Si es sobre código
4. **INDEX.md** - Si es sobre estructura

---

## ✨ Lo Que Tienes Ahora

✅ Autenticación funcional  
✅ Base de datos completa (22 tablas)  
✅ Motor de cálculo de presupuestos  
✅ Trazabilidad con QR  
✅ OCR automático  
✅ Gestión de clientes  
✅ Catálogos maestros  
✅ Dashboard operativo  

---

## 🚀 Próximas Fases Planificadas

1. **Crear Presupuestos** (UI)
2. **Gestión de Pedidos**
3. **Panel de Producción**
4. **Albaranes**
5. **OCR Web Interface**

---

## 📸 Screenshots Esperados

### Después del Login
- Dashboard con 4 tarjetas (pendientes, en producción, completadas, ingresos)
- Botones de acciones rápidas

### Clientes
- Tabla con búsqueda y filtros
- Botón "Nuevo Cliente"

### Catálogos
- 5 tabs con vistas tabulares
- Datos de Supabase en vivo

---

**¡Listo para comenzar!**

**Tiempo total**: ~5 minutos  
**Requisitos**: Supabase, terminal, editor  
**Resultado**: ERP funcional en tu máquina

🎉 **Bienvenido a FinePath!**

---

**Notas finales:**
- Todos los datos se guardan en Supabase
- Puedes apagar la app y los datos persisten
- Es un proyecto real, no un mockup
- El código está completamente documentado

¿Preguntas? Revisa INDEX.md para navegar toda la documentación.
