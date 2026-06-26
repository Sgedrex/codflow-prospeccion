# 🧠 Cerebro — Codflow Inteligencia Comercial

## ¿Qué es este vault?
Este es el cerebro del sistema de prospección de Codflow.
Aquí se guardan todos los análisis que genera MiroFish.
El sistema lee estas notas antes de generar cualquier nuevo
análisis, para no empezar desde cero cada vez.

---

## 📁 Estructura de carpetas

- `/Rubros/Logística` → análisis de empresas de logística
- `/Rubros/Clínicas` → análisis de clínicas y laboratorios
- `/Rubros/Distribuidoras` → distribuidoras y mayoristas
- `/Rubros/Supermercados` → retail alimenticio
- `/Zonas` → perfil de cada zona de Ciudad de Panamá
- `/Casos de Estudio` → empresas procesadas completas
- `/Patrones` → lo que se repite entre rubros y zonas

---

## 🗺️ Zonas de Ciudad de Panamá

### Perfil A — Alta Rotación / Margen Ajustado
- Juan Díaz
- Transístmica
- Villa Zaita
- 24 de Diciembre

### Perfil B — Ticket Alto / Volumen Controlado
- Costa del Este
- Obarrio
- San Francisco
- Condado del Rey
- Punta Pacífica

---

## 📌 Casos de estudio procesados

- [[Fulter Logistics — Juan Díaz]]

---

## 🔗 Conexiones del sistema

- **Supabase:** tabla `leads` — datos de cada empresa
- **MiroFish:** genera señal destacada y ángulo de contacto
- **Vercel:** dashboard operativo del equipo de ventas
- **Google Maps API:** scraper de empresas por rubro y zona