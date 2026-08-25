# Plan Maestro UX/UI: Evolución a Calidad "Steam" (Vía Reskin CSS)

Para evitar problemas de arquitectura al migrar a escenas de Phaser, aplicaremos los principios de diseño "Cartoon Limpio" directamente sobre la estructura DOM actual. Esto es más seguro e igual de efectivo visualmente.

## 🎨 Dirección de Arte: Cartoon Limpio
- Colores vibrantes y primarios (verdes brillantes, amarillos cálidos, rojos puros).
- Bordes redondeados gruesos (radios grandes).
- Contornos oscuros (strokes) para destacar elementos.
- Fuentes amigables (`Fredoka One` y `Nunito`).
- Animaciones "bouncy" (elásticas) en interacciones.

## 🚀 Fase 1: Reskin del HUD y Controles (CSS/HTML)
- **Panel Inferior (Dashboard)**:
  - Cambiar colores oscuros por tonos más vivos y "gomosos".
  - Aumentar el borde y añadir volumen con sombras CSS (`box-shadow`).
- **Marcadores Superiores (Stats)**:
  - Rediseñar el contenedor de vidas y comodines para que parezcan "botones grandes" o "placas" de un juego móvil/Nintendo.
  - Actualizar los iconos de audio para que encajen en estilo.
- **Botones Generales**:
  - Estilos de botón 3D (con borde inferior pronunciado que se reduce al pulsar `active:transform`).

## ⚙️ Fase 2: Pantalla Completa y Menú Inicial (Overlay)
- **Pantalla Completa**:
  - Añadir un botón visual claro para activar Fullscreen directamente mediante la API del navegador en el DOM.
- **Title Screen (Capa Superpuesta)**:
  - En lugar de una escena de Phaser, usar un `div` a pantalla completa (como el `game-over-screen`) que sirva de Menú Principal con el Logo y el botón "Jugar".
  - Al pulsar jugar, este div se oculta con un *fade out* y revela el juego.

## ✨ Fase 3: Transiciones y Pulido
- Aplicar animaciones CSS a los popups (Sabías Que, Game Over) para que entren rebotando (`bounce`).
- (Opcional) Refinar partículas en Phaser.
