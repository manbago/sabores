# Plan Maestro UX/UI: Evolución a Calidad "Steam"

Para que *Sabor de España* pase de ser un "juego web" a sentirse como un título premium digno de Steam, necesitamos aplicar los principios de diseño de interfaces de videojuegos (Game UI) y "Juice" (Game Feel). 

Este es el roadmap propuesto, dividido por fases lógicas de implementación.

---

## 🚀 Fase 1: Arquitectura de Escenas y Fullscreen
El primer paso para que parezca un juego de escritorio es controlar el flujo completo del usuario y aislarlo del navegador.

- **[NEW] Soporte Fullscreen API**: Añadir un botón o atajo (F11/Alt+Enter) para poner el canvas en pantalla completa.
- **Transición a Sistema de Escenas (Phaser Scenes)**: 
  - Eliminar los elementos HTML superpuestos (`div` flotantes de game over, settings, etc.) y reconstruirlos como verdaderas Escenas de Phaser (`BootScene`, `MainMenuScene`, `GameScene`, `PauseScene`, `GameOverScene`).
  - Esto garantiza que la UI se escale perfectamente con el juego, soporte gamepads en el futuro y no se sienta como una página web.

## 🎨 Fase 2: El Menú Principal (Title Screen)
La primera impresión lo es todo. Necesitamos un menú principal inmersivo.

- **Fondo Animado**: Una versión dinámica del mapa (nubes moviéndose lentamente, brillos sutiles en las provincias).
- **Logo del Juego**: Un logotipo pulido, con texturas y un efecto de "respiración" o levitación sutil.
- **Botonera Principal**: Reemplazar los botones estándar por "Sprite Buttons".
  - Opciones: *Jugar, Opciones, Créditos, Salir (si aplica)*.
  - **Interacción**: Sonido de hover (`tic`), sonido de click sólido, animación de escala (pop) y cambio de frame/textura al enfocarlos.
- **Navegación por Teclado/Mando**: Soporte total para moverse por el menú sin ratón.

## ⚙️ Fase 3: Menú de Opciones y Pausa
La calidad de vida (QoL) es vital en juegos de PC.

- **Menú de Pausa (In-Game)**: 
  - Al pulsar `Escape`, desenfocar el fondo (efecto blur), detener la lógica del juego temporalmente y mostrar un panel elegante.
  - Opciones: *Reanudar, Ajustes, Volver al Menú Principal*.
- **Ajustes Avanzados**:
  - Sliders para el Volumen General, Música y SFX (en lugar de simples botones On/Off).
  - Toggle de Pantalla Completa.

## 🕹️ Fase 4: Rediseño del HUD In-Game
El HUD (Heads-Up Display) actual en HTML es funcional, pero intrusivo. Hay que integrarlo temáticamente.

- **Panel Superior (Estadísticas)**:
  - Diseño temático: Quizás paneles de madera rústica, pergaminos, o placas de metal pulido, dependiendo de la dirección de arte final.
  - Vidas: Corazones o iconos temáticos que "Laten" cuando hay peligro.
  - Comodines: Representados como cartas del tarot español o tickets dorados brillantes.
- **Panel Inferior (Lanzador)**:
  - Eliminar el enorme cuadro gris actual.
  - El "plato a lanzar" debe aparecer en un holograma o pedestal rústico junto al cañón, de forma más orgánica.
  - La pista ("¿Dónde encestamos?") debe flotar sutilmente con una tipografía limpia y con contornos (outline) para ser legible sobre cualquier fondo.

## ✨ Fase 5: "Juice", Pulido y Transiciones
Los detalles que hacen que el juego responda de forma visceral.

- **Transiciones entre pantallas**: Fundidos a negro (`FadeInOut`), barridos de pantalla o aperturas circulares al cambiar de menú.
- **Efectos de Partículas UI**: Chisporroteos al ganar puntos, estelas al arrastrar, confeti direccional.
- **Feedback Sensorial UI**: Absolutamente TODO lo que se pueda clicar debe tener un sonido de *hover* y de *click*.
- **Pantalla de Victoria/Derrota Épica**: 
  - Aparición escalonada de los elementos: Título -> Puntuación (contando numéricamente hacia arriba rápido) -> Rango/Estrellas obtenidas -> Botones.

---

## 📋 ¿Por dónde empezamos?

Para no romper el juego actual, la mejor forma de abordar esto es **secuencial**:

1. **Paso A**: Migrar la gestión del Fullscreen y mover los Popups actuales (Game Over, Sabías Que) a dentro del código de Phaser (o estilizarlos drásticamente con CSS puro si preferimos no tocar tanto el JS por ahora).
2. **Paso B**: Crear la Escena del Menú Principal (`MainMenu`) que anteceda a la jugabilidad.
3. **Paso C**: Rediseñar los botones y el HUD inferior implementando texturas/sprites en lugar de colores planos.

¿Qué dirección gráfica te imaginas para la interfaz? ¿Algo **"Madera/Rústico Tradicional Español"**, algo **"Sci-Fi Holográfico"** (por el Robot-Toro), o algo **"Cartoon Limpio"** estilo Nintendo/Mobile?
