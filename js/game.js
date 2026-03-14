// DATOS (Cargados desde JSON externo)
        let provincesData = [];

        // Variables globales
        let gameQueue = [];
        let currentTarget = null;
        let aciertos = 0;
        let fallos = 0;
        let vidas = 7;
        let comodines = 5;
        let rachaAciertos = 0; // Nueva variable para rachas

        let isShooting = false;
        let gameStarted = false; // Bloquea disparos hasta que se pulse JUGAR
        let musicEnabled = true;
        let sfxEnabled = true;
        let bgMusic = null;
        let hoverIndex = 0; // Para teclado
        let isEditMode = false; // Modo edición
        let projectileMaskGraphics; // Gráfico para la máscara del proyectil

        const MAP_OFFSET_X = -120; // Ajuste para compensar el hueco del Atlántico en el mapa y centrar a España


        const domAciertos = document.getElementById('score-aciertos');
        const domFallos = document.getElementById('score-fallos');
        const domVidas = document.getElementById('ui-vidas');
        const domComodines = document.getElementById('ui-comodines');
        const domCurrentFood = document.getElementById('current-food');
        const domFoodImage = document.getElementById('food-image');
        const domComodinOptions = document.getElementById('comodin-container');
        const domTooltip = document.getElementById('tooltip');
        const domGameOver = document.getElementById('game-over-screen');
        const domFinalAciertos = document.getElementById('final-aciertos');

        // Configuración de Phaser
        const config = {
            type: Phaser.AUTO,
            width: 1920,
            height: 1080,
            parent: 'game-container',
            scale: {
                mode: Phaser.Scale.FIT,
                autoCenter: Phaser.Scale.CENTER_HORIZONTALLY
            },
            scene: {
                preload: preload,
                create: create,
                update: update
            },
            backgroundColor: '#ffffff',
            transparent: false
        };

        const game = new Phaser.Game(config);

        function preload() {
            // Assets finales
            this.load.image('mapa_espana', 'assets/images/mapa-blanco.png');
            this.load.image('bull_launcher', 'assets/images/bull_launcher.png');
            this.load.json('proximosDatos', 'data/provincesData.json');

            // Efectos de sonido (Local asset)
            this.load.audio('bull_sound', 'assets/audio/shot.mp3');
            this.load.audio('success_sound', 'assets/audio/success.wav');
            this.load.audio('fail_sound', 'assets/audio/fail.wav');
            this.load.audio('flamenco_bg', 'assets/audio/flamenco.mp3');
        }

        let provinceSprites = [];
        let projectile;
        let launcher;

        function create() {
            // Generar textura 'circle' programáticamente para partículas
            let circleGraphics = this.make.graphics({ x: 0, y: 0, add: false });
            circleGraphics.fillStyle(0xffffff, 1);
            circleGraphics.fillCircle(10, 10, 10);
            circleGraphics.generateTexture('circle', 20, 20);

            // Referencia local del JSON
            provincesData = this.cache.json.get('proximosDatos');

            // Preparamos la cola de juego inicial
            gameQueue = Phaser.Utils.Array.Shuffle([...provincesData]);

            // Pre-cargar todas las imágenes de platos en batch para que estén disponibles desde la primera ronda
            const dishImagesToLoad = provincesData.filter(p => p.image);
            let dishLoadPending = dishImagesToLoad.length;

            if (dishLoadPending > 0) {
                // Mostrar "Cargando..." en el HUD mientras se cargan las imágenes
                const domCurrentFood = document.getElementById('current-food');
                const domFoodImage = document.getElementById('food-image');
                if (domCurrentFood) domCurrentFood.innerText = 'Cargando...';
                if (domFoodImage) domFoodImage.innerHTML = '<span style="font-size:2em;animation:spin 1s linear infinite;display:inline-block">⏳</span>';

                let pendingLoad = 0;
                dishImagesToLoad.forEach(p => {
                    const key = `dish_${p.id}`;
                    if (!this.textures.exists(key)) {
                        this.load.image(key, p.image);
                        pendingLoad++;
                    }
                });

                if (pendingLoad > 0) {
                    this.load.once('complete', () => {
                        // Simular carga para que el usuario vea el estado "Cargando..."
                        setTimeout(() => {
                            window._dishImagesReady = true;
                            nextRound();
                        }, 1500);
                    });
                    this.load.start();
                } else {
                    // Todas las texturas ya estaban en caché
                    window._dishImagesReady = true;
                }
            } else {
                window._dishImagesReady = true;
            }

            // Fondo / Mapa decorativo
            let mapBg = this.add.image(960 + MAP_OFFSET_X, 540, 'mapa_espana');
            // Forzamos a que cubra el tamaño de diseño 1920x1080
            mapBg.setDisplaySize(1920, 1080);
            // Coloco la profundidad al fondo
            mapBg.setDepth(-10);

            // Dibujar provincias como textos interactivos
            provincesData.forEach((prov, i) => {
                let pGroup = this.add.container(prov.x + MAP_OFFSET_X, prov.y);

                // Texto completo de la provincia
                let text = this.add.text(0, 0, prov.name, {
                    fontFamily: 'Fredoka One',
                    fontSize: '22px',
                    color: '#ffffff',
                    stroke: '#333333',
                    strokeThickness: 5
                }).setOrigin(0.5);

                pGroup.add(text);

                // Área interactiva reducida para mayor precisión y menor solapamiento
                let w = text.width + 20; // Hitbox ajustado (10px padding por lado)
                let h = text.height + 20;
                let hitArea = new Phaser.Geom.Rectangle(-w / 2, -h / 2, w, h);
                pGroup.setInteractive(hitArea, Phaser.Geom.Rectangle.Contains);
                pGroup.input.cursor = 'pointer';

                // Guardar la escala original para restaurarla
                pGroup.baseScale = 1.0;

                // Efectos de Hover con el ratón
                pGroup.on('pointerover', () => {
                    if (isShooting) return;
                    highlightProvince(pGroup, text, this);
                    hoverIndex = i; // Sincroniza ratón con nav teclado
                });

                pGroup.on('pointerout', () => {
                    if (isShooting || isEditMode) return;
                    resetProvince(pGroup, text, this);
                });

                // Disparo (Click)
                pGroup.on('pointerdown', () => {
                    if (!gameStarted) return;
                    if (window.isPaused) return; // Ignorar si el juego está en pausa
                    if (isEditMode) return;
                    if (isModalOpen()) return;
                    if (!isShooting) shootAt(prov, pGroup);
                });

                // --- Lógica Drag & Drop (Modo Edición) ---
                this.input.setDraggable(pGroup);

                pGroup.on('dragstart', function (pointer, dragX, dragY) {
                    if (!isEditMode) return;
                    this.setDepth(100);
                    text.setTint(0xf94144); // Color rojo al arrastrar
                });

                pGroup.on('drag', function (pointer, dragX, dragY) {
                    if (!isEditMode) return;
                    this.x = dragX;
                    this.y = dragY;
                });

                pGroup.on('dragend', function (pointer, dragX, dragY, dropped) {
                    if (!isEditMode) return;
                    this.setDepth(0);
                    text.clearTint();
                    // Actualizar el objeto original con las nuevas coordenadas, deshaciendo el offset visual
                    this.provinceData.x = Math.round(this.x - MAP_OFFSET_X);
                    this.provinceData.y = Math.round(this.y);
                });

                // Guardar datos
                pGroup.provinceData = prov;
                pGroup.mainText = text;
                provinceSprites.push(pGroup);
            });

            // --- NUEVO LANZADOR BULL-BOT ---
            launcher = this.add.container(960 + MAP_OFFSET_X, 1140); // Subido de 1186 a 1140
            // Cuerpo del Robot-Toro
            let bullBot = this.add.sprite(0, -60, 'bull_launcher');
            // Escalado: 50% más grande que antes (185 * 1.5 = ~277)
            bullBot.setDisplaySize(277, 277);

            launcher.add(bullBot);
            launcher.bullBot = bullBot;

            // --- EFECTO DE LUZ ESTÁTICA (Resplandor en los cuernos/ojos) ---
            let glow = this.add.circle(0, -60, 150, 0xffff00, 0.1).setDepth(-1);
            launcher.add(glow);
            this.tweens.add({
                targets: glow,
                scale: 1.2,
                alpha: 0.05,
                duration: 2000,
                yoyo: true,
                repeat: -1
            });

            // Teclado
            this.input.keyboard.on('keydown-RIGHT', () => navigateKeyboard('RIGHT'));
            this.input.keyboard.on('keydown-LEFT', () => navigateKeyboard('LEFT'));
            this.input.keyboard.on('keydown-UP', () => navigateKeyboard('UP'));
            this.input.keyboard.on('keydown-DOWN', () => navigateKeyboard('DOWN'));
            this.input.keyboard.on('keydown-ENTER', () => {
                if (isModalOpen()) return;
                if (!isShooting && provinceSprites[hoverIndex]) {
                    shootAt(provinceSprites[hoverIndex].provinceData, provinceSprites[hoverIndex]);
                }
            });

            // Resaltar el primer elemento inicialmente
            if (provinceSprites.length > 0) highlightProvince(provinceSprites[0], provinceSprites[0].mainText, this);

            // Inicializar UI de Vidas y Comodines
            updateVidasUI();
            updateComodinesUI();
            
            // Iniciar juego — nextRound se llama tras cargar imágenes si las hay, o directamente si no
            if (window._dishImagesReady) nextRound();
            // (Si no está listo, se llama desde el callback 'complete' de arriba)

            // Asegurar que el AudioContext se reanuda al interactuar
            this.input.on('pointerdown', () => {
                if (this.sound.context.state === 'suspended') {
                    this.sound.context.resume();
                }
                // Iniciar música si no está sonando y está habilitada
                if (musicEnabled && (!bgMusic || !bgMusic.isPlaying)) {
                    if (!bgMusic) {
                        bgMusic = this.sound.add('flamenco_bg', { loop: true, volume: 0.3 });
                    }
                    bgMusic.play();
                }
            });
        }

        function update() {
            // 1. Apuntar el Robot-Toro al ratón
            if (launcher && launcher.bullBot && !isEditMode) {
                let pointer = this.input.activePointer;
                let angle = Phaser.Math.Angle.Between(launcher.x, launcher.y - 60, pointer.worldX, pointer.worldY);

                let targetRot = angle + Math.PI / 2;
                // Límites de rotación
                if (targetRot > 1.2) targetRot = 1.2;
                if (targetRot < -1.2) targetRot = -1.2;

                if (!isShooting) {
                    launcher.bullBot.rotation = targetRot;

                    // ELIMINAR PROYECTIL EN EL TORO (Ocultar mientras está en espera)
                    if (projectile && projectile.active) {
                        projectile.visible = false;
                        // Mantenemos la lógica de posición por si acaso se activa de golpe
                        let rot = launcher.bullBot.rotation;
                        projectile.x = launcher.x + Math.sin(rot) * 110;
                        projectile.y = (launcher.y - 60) - Math.cos(rot) * 110;
                        projectile.rotation = rot;
                        projectile.setScale(0.7);
                    }
                } else {
                    // Asegurar que sea visible durante el disparo
                    if (projectile) projectile.visible = true;
                }
            }

            // 2. Actualizar la posición de la máscara para que siga al proyectil
            if (projectile && projectileMaskGraphics && isShooting) {
                projectileMaskGraphics.x = projectile.x;
                projectileMaskGraphics.y = projectile.y;
                projectileMaskGraphics.scale = projectile.scale;
            }
        }

        // --- FUNCIONES LOGICAS ---

        function isModalOpen() {
            return document.getElementById('confirm-restart-screen').style.display === 'flex' ||
                document.getElementById('game-over-screen').style.display === 'flex';
        }

        function nextRound() {
            if (gameQueue.length === 0) {
                gameOver();
                return;
            }
            currentTarget = gameQueue.pop();
            domCurrentFood.innerText = currentTarget.food;

            // Asignar emoji animado según el plato (esto puede mejorarse con un mapa o emojis dedicados)
            const emojisDisponibles = ['🥘', '🦐', '🥩', '🧀', '🐟', '🐙', '🍗', '🌶🥘', '🍮', '🥟'];
            let randomEmoji = emojisDisponibles[Math.floor(Math.random() * emojisDisponibles.length)];

            // Emoji personalizado según palabra clave en el nombre del plato
            let foodNameLow = currentTarget.food.toLowerCase();
            if (foodNameLow.includes('pulpo')) randomEmoji = '🐙';
            else if (foodNameLow.includes('queso') || foodNameLow.includes('torta')) randomEmoji = '🧀';
            else if (foodNameLow.includes('jamón') || foodNameLow.includes('ternasco') || foodNameLow.includes('chuletón') || foodNameLow.includes('lechazo')) randomEmoji = '🥩';
            else if (foodNameLow.includes('pollo')) randomEmoji = '🍗';
            else if (foodNameLow.includes('langostino') || foodNameLow.includes('gamba')) randomEmoji = '🦐';
            else if (foodNameLow.includes('pimiento')) randomEmoji = '🌶🥘';
            else if (foodNameLow.includes('bacalao') || foodNameLow.includes('sardina')) randomEmoji = '🐟';
            else if (foodNameLow.includes('paella')) randomEmoji = '🥘';
            else if (foodNameLow.includes('crema') || foodNameLow.includes('xuixo') || foodNameLow.includes('turrón') || foodNameLow.includes('mazapán') || foodNameLow.includes('miguelitos') || foodNameLow.includes('ensaimada') || foodNameLow.includes('sobao') || foodNameLow.includes('piononos')) randomEmoji = '🍮';
            if (currentTarget.image) {
                // Usamos 'contain' para que la imagen se vea completa sin recortes
                domFoodImage.innerHTML = `<img src="${currentTarget.image}" style="width: 85%; height: 85%; object-fit: contain;">`;
            } else {
                domFoodImage.innerText = randomEmoji;
            }

            // Re-trigger food-pop animation on the food name
            const hf = domCurrentFood;
            hf.style.animation = 'none';
            void hf.offsetWidth; // reflow
            hf.style.animation = '';

            domComodinOptions.style.display = 'none'; // Ocultar pistas
            domComodinOptions.innerHTML = '';
            isShooting = false;

            // Revisar y mostrar notificaciones (rachas o avisos de escasez)
            checkAndShowNotification(true);

            // Recrear proyectil base
            createProjectile(game.scene.scenes[0]);
        }

        function createProjectile(scene) {
            if (projectile) projectile.destroy();
            if (projectileMaskGraphics) projectileMaskGraphics.destroy();

            projectile = scene.add.container(960, 1080); // Posición inicial (Catapulta)
            projectile.setDepth(20);

            // Base blanca del proyectil
            let pBase = scene.add.circle(0, 0, 80, 0xffffff);
            pBase.setStrokeStyle(8, 0xffba08);
            projectile.add(pBase);

            if (currentTarget && currentTarget.image) {
                const textureKey = `dish_${currentTarget.id}`;

                const applyImage = () => {
                    if (!projectile || !projectile.active) return;
                    let img = scene.add.image(0, 0, textureKey);
                    img.setDisplaySize(145, 145);

                    projectileMaskGraphics = scene.make.graphics();
                    projectileMaskGraphics.fillCircle(0, 0, 72);
                    projectileMaskGraphics.x = projectile.x;
                    projectileMaskGraphics.y = projectile.y;

                    let mask = projectileMaskGraphics.createGeometryMask();
                    img.setMask(mask);
                    projectile.add(img);
                };

                if (!scene.textures.exists(textureKey)) {
                    scene.load.image(textureKey, currentTarget.image);
                    scene.load.once('complete', applyImage);
                    scene.load.start();
                } else {
                    applyImage();
                }
            } else {
                let txt = scene.add.text(0, 0, "🥘", { fontSize: '60px' }).setOrigin(0.5);
                projectile.add(txt);
            }
            projectile.setScale(1);
        }

        function shootAt(targetProv, targetSprite) {
            isShooting = true;
            closeSabiasQue(); // Cerrar el popup si estaba abierto
            hideNotification(); // Cerrar la notificación móvil
            let scene = game.scene.scenes[0];

            // --- EFECTO DE DISPARO (Muzzle Flash) ---
            let rot = launcher.bullBot.rotation;
            // Lo hacemos visible al disparar
            projectile.visible = true;
            // Distancia sincronizada con update() (~110px)
            let muzzleX = launcher.x + Math.sin(rot) * 110;
            let muzzleY = (launcher.y - 60) - Math.cos(rot) * 110;

            // --- NUEVO EFECTO "PLASMA BURST" ---

            // 1. Sonido del Toro
            if (sfxEnabled && scene.cache.audio.exists('bull_sound')) {
                scene.sound.play('bull_sound', { volume: 0.8 });
            }

            // 2. Anillo de Choque (Shockwave)
            let ring = scene.add.circle(muzzleX, muzzleY, 10, 0x00ffff, 0.5).setDepth(30).setStrokeStyle(4, 0x00ffff);
            scene.tweens.add({
                targets: ring,
                radius: 120,
                alpha: 0,
                duration: 400,
                ease: 'Cubic.easeOut',
                onComplete: () => ring.destroy()
            });

            // 3. Flash Central
            let flash = scene.add.circle(muzzleX, muzzleY, 50, 0xffba08).setDepth(31);
            scene.tweens.add({
                targets: flash,
                scale: 2.5,
                alpha: 0,
                duration: 200,
                onComplete: () => flash.destroy()
            });



            // 5. Estela del Proyectil (Trail)
            projectile.trail = scene.add.particles(0, 0, 'circle', {
                color: [0x00ffff],
                scale: { start: 0.3, end: 0 },
                lifespan: 300,
                speed: 50,
                emitZone: { type: 'edge', source: new Phaser.Geom.Circle(0, 0, 40), quantity: 10 },
                blendMode: 'NORMAL',
                frequency: 20
            });
            projectile.trail.startFollow(projectile);
            projectile.trail.setDepth(15);

            projectile.x = muzzleX;
            projectile.y = muzzleY;
            projectile.setScale(0.8);

            // Animación de RETROCESO del Robot
            scene.tweens.add({
                targets: launcher.bullBot,
                y: -30, // Retrocede un poco (estaba en -60)
                duration: 100,
                yoyo: true,
                ease: 'Quad.easeOut'
            });

            // 1. Animación Horizontal, Escala y Rotación
            scene.tweens.add({
                targets: projectile,
                x: targetProv.x + MAP_OFFSET_X,
                scaleX: 0.2, // Simula profundidad
                scaleY: 0.2,
                angle: 720,  // Da dos vueltas completas
                duration: 1500, // 1.5s (lento)
                ease: 'Linear'
            });

            // 2. Animación Vertical coordinada (Parábola)
            scene.tweens.add({
                targets: projectile,
                y: targetProv.y - 250, // Punto más alto del arco
                duration: 750, // Mitad del tiempo
                ease: 'Sine.easeOut',
                onComplete: () => {
                    // Fase de CAÍDA: El proyectil baja hacia el objetivo
                    scene.tweens.add({
                        targets: projectile,
                        y: targetProv.y, // Altura exacta del impacto
                        duration: 750, // Segunda mitad del tiempo
                        ease: 'Sine.easeIn',
                        onComplete: () => {
                            // Al terminar la caída, ejecutamos el impacto
                            checkResult(targetProv, targetSprite, scene);
                        }
                    });
                }
            });
        }

        function checkResult(selectedProv, targetSprite, scene) {
            // --- DESAPARICIÓN INMEDIATA Y EFECTO DE IMPACTO ---
            if (projectile.trail) projectile.trail.destroy();
            if (projectile) projectile.destroy();
            if (projectileMaskGraphics) projectileMaskGraphics.destroy();

            // Partículas de "estallido" (Shatter effect)
            let shatter = scene.add.particles(selectedProv.x + MAP_OFFSET_X, selectedProv.y, 'circle', {
                color: [0x000000, 0x333333],
                speed: { min: 50, max: 150 },
                scale: { start: 0.3, end: 0 },
                lifespan: 600,
                quantity: 15,
                blendMode: 'NORMAL'
            });
            setTimeout(() => shatter.destroy(), 700);

            if (selectedProv.id === currentTarget.id) {
                // ACIERTO
                if (sfxEnabled && scene.cache.audio.exists('success_sound')) scene.sound.play('success_sound', { volume: 0.7 });
                
                aciertos++;
                rachaAciertos++; // Incrementar racha
                domAciertos.innerText = aciertos;

                // Popup SWISH!
                const swishMessages = ['\u00A1SWISH! \uD83C\uDF89', '\uD83D\uDC4F \u00A1Ole!', '\uD83E\uDD73 \u00A1Bien!', '\uD83C\uDF55 \u00A1Correcto!'];
                const swishMsg = swishMessages[aciertos % swishMessages.length];
                let swishText = scene.add.text(selectedProv.x + MAP_OFFSET_X, selectedProv.y - 50, swishMsg, {
                    fontFamily: 'Fredoka One', fontSize: '52px', color: '#06d6a0',
                    stroke: '#073b4c', strokeThickness: 8
                }).setOrigin(0.5).setDepth(30);

                scene.tweens.add({
                    targets: swishText, y: '-=150', alpha: 0, scale: 1.4, duration: 1800,
                    ease: 'Cubic.easeOut',
                    onComplete: () => swishText.destroy()
                });

                // Confeti de colores en partículas — permanece en el mapa como celebración
                let particles = scene.add.particles(selectedProv.x + MAP_OFFSET_X, selectedProv.y, 'circle', {
                    color: [0x000000, 0xffd166, 0xef476f, 0x118ab2],
                    colorRandom: true,
                    speed: { min: 20, max: 60 },
                    angle: { min: 0, max: 360 },
                    scale: { start: 0.4, end: 0 },
                    lifespan: 1400,
                    quantity: 14,
                    blendMode: 'NORMAL'
                });

                targetSprite.mainText.setTint(0x4CAF50); // Verde para acierto

                // UI score pulse
                domAciertos.parentElement.style.transform = 'scale(1.25)';
                setTimeout(() => { domAciertos.parentElement.style.transform = 'scale(1)'; }, 200);

                // Ring de éxito
                let ring2 = scene.add.circle(selectedProv.x + MAP_OFFSET_X, selectedProv.y, 10, 0x06d6a0, 0.7).setDepth(28);
                scene.tweens.add({ targets: ring2, radius: 90, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });

                setTimeout(() => {
                    showSabiasQue(selectedProv.info);
                    nextRound(); // Pasar de ronda inmediatamente sin esperar al popup
                }, 1000);

            } else {
                // FALLO
                if (sfxEnabled && scene.cache.audio.exists('fail_sound')) scene.sound.play('fail_sound', { volume: 0.4 });
                
                fallos++;
                vidas--;
                rachaAciertos = 0; // Romper racha
                updateVidasUI();
                triggerLossAnimation(domVidas.parentElement);

                targetSprite.mainText.setTint(0xF44336); // Rojo para fallo

                // --- NUEVA LÓGICA ---
                // Devolver la provincia fallada a un lugar aleatorio de la cola
                // De esta manera el juego no termina hasta que se aciertan todas.
                let insertIndex = Math.floor(Math.random() * (gameQueue.length + 1));
                gameQueue.splice(insertIndex, 0, currentTarget);

                // Efecto Miss
                let missText = scene.add.text(selectedProv.x + MAP_OFFSET_X, selectedProv.y - 50, '¡MISS!', {
                    fontFamily: 'Fredoka One', fontSize: '48px', color: '#F44336', stroke: '#fff', strokeThickness: 6
                }).setOrigin(0.5).setDepth(30);

                scene.tweens.add({
                    targets: missText, y: '-=100', alpha: 0, scale: 1.5, duration: 1000,
                    onComplete: () => missText.destroy()
                });

                // Efecto rebote rojo y caída (Opcional: Si queremos que caiga, no podemos destruirlo antes)
                // Como el usuario pidió que aparezca "impacto", ya lo hemos destruido arriba.
                // Simplemente pasamos a la siguiente ronda tras el delay.
                setTimeout(() => {
                    targetSprite.mainText.clearTint();
                    if (vidas <= 0) {
                        gameOver();
                    } else {
                        nextRound();
                    }
                }, 1000);
            }
        }

        function highlightProvince(group, text, scene) {
            // Quitar resalte a todos primero
            provinceSprites.forEach(p => resetProvince(p, p.mainText, scene));

            // Animación suave de aumento y color
            if (group.hoverTween) group.hoverTween.stop();
            group.hoverTween = scene.tweens.add({
                targets: group,
                scaleX: 1.3,
                scaleY: 1.3,
                duration: 200,
                ease: 'Back.easeOut'
            });

            group.setDepth(15);
            text.setTint(0xffba08); // Tintar de dorado
            text.setShadow(0, 4, '#000000', 4, true, true);
        }

        function resetProvince(group, text, scene) {
            if (!scene) scene = game.scene.scenes[0];

            if (group.scaleX !== 1.0) {
                if (group.hoverTween) group.hoverTween.stop();

                // Restaurar escala original suavemente
                scene.tweens.add({
                    targets: group,
                    scaleX: 1.0,
                    scaleY: 1.0,
                    duration: 150,
                    ease: 'Sine.easeOut'
                });

                group.setDepth(0);
                text.clearTint();
                text.setShadow(0, 0, 'rgba(0,0,0,0)', 0);
            }
        }

        function navigateKeyboard(direction) {
            if (isShooting) return;

            let current = provinceSprites[hoverIndex];
            if (!current) return;

            let bestMatch = null;
            let bestDist = Infinity;

            for (let i = 0; i < provinceSprites.length; i++) {
                let candidate = provinceSprites[i];
                if (i === hoverIndex) continue; // Skip self
                
                // Allow navigating over hit provinces to reach others? Yes.
                let dx = candidate.x - current.x;
                let dy = candidate.y - current.y;
                let dist = Math.sqrt(dx * dx + dy * dy);

                let isValiddirection = false;
                
                // We use a cone of vision to determine if it's "in that direction"
                if (direction === 'RIGHT' && dx > Math.abs(dy) * 0.5) isValiddirection = true;
                if (direction === 'LEFT' && -dx > Math.abs(dy) * 0.5) isValiddirection = true;
                if (direction === 'DOWN' && dy > Math.abs(dx) * 0.5) isValiddirection = true;
                if (direction === 'UP' && -dy > Math.abs(dx) * 0.5) isValiddirection = true;

                if (isValiddirection && dist < bestDist) {
                    bestDist = dist;
                    bestMatch = i;
                }
            }

            if (bestMatch !== null) {
                hoverIndex = bestMatch;
                let target = provinceSprites[hoverIndex];
                highlightProvince(target, target.mainText, game.scene.scenes[0]);
            }
        }

        function gameOver() {
            if (vidas <= 0) {
                document.querySelector('#game-over-box h1').innerText = "\uD83D\uDC94 Sin Vidas";
                document.querySelector('#game-over-box p.final-score').innerHTML =
                    `Encestaste <span id="final-aciertos">0</span> platos de 52.`;
            } else {
                document.querySelector('#game-over-box h1').innerText = "\uD83C\uDF89 \u00A1Ganaste!";
                document.querySelector('#game-over-box p.final-score').innerHTML =
                    `\u00A1<span id="final-aciertos">0</span> de 52 provincias!`;
            }
            domGameOver.style.display = 'flex';
            // Dar un tick para que el CSS compile y luego añadir .active
            requestAnimationFrame(() => requestAnimationFrame(() => {
                domGameOver.classList.add('active');
                // Animar el contador de puntuación
                const finalEl = document.getElementById('final-aciertos');
                if (finalEl) {
                    let count = 0;
                    const target = aciertos;
                    const dur = Math.min(1500, target * 60);
                    const step = dur / Math.max(target, 1);
                    const iv = setInterval(() => {
                        count++;
                        finalEl.innerText = count;
                        if (count >= target) clearInterval(iv);
                    }, step);
                }
            }));
        }

        // --- LÓGICA COMODINES Y VIDAS ---
        function updateVidasUI() {
            const maxVidas = 8; // Total original de vidas
            let html = '';
            for (let i = 0; i < maxVidas; i++) {
                if (i < vidas) {
                    html += '<span class="icon-active">\u2764\uFE0F</span>';
                } else {
                    html += '<span class="icon-spent">\uD83E\uDD0D</span>'; // corazón roto
                }
            }
            domVidas.innerHTML = html;
            // Pulsar corazón si quedan <= 2 vidas
            const vidasBox = document.getElementById('vidas-stat-box');
            if (vidasBox) {
                if (vidas <= 2) vidasBox.classList.add('danger');
                else vidasBox.classList.remove('danger');
            }
        }

        function updateComodinesUI() {
            const maxComodines = 8;
            let html = '';
            for (let i = 0; i < maxComodines; i++) {
                if (i < comodines) {
                    html += '<span class="icon-active" style="font-size:20px">\u2B50</span>'; // estrella dorada
                } else {
                    html += '<span class="icon-spent" style="font-size:20px">\u2606</span>'; // estrella vacía
                }
            }
            domComodines.innerHTML = html;
        }

        function usarComodin() {
            if (isShooting || isEditMode || comodines <= 0 || !currentTarget) return;
            if (domComodinOptions.style.display === 'flex') return; // Ya usado en este turno

            comodines--;
            updateComodinesUI();
            triggerUseAnimation(domComodines.parentElement);
            checkAndShowNotification(false); // Actualizar aviso si es necesario, sin chequear rachas

            // Clonamos el objeto Data para no alterarlo
            let misProvincias = JSON.parse(JSON.stringify(provincesData));

            // Seleccionar 1 provincia al azar incorrecta
            let falsas = Phaser.Utils.Array.Shuffle(misProvincias)
                .filter(p => p.id !== currentTarget.id)
                .slice(0, 1);

            let opciones = Phaser.Utils.Array.Shuffle([currentTarget, falsas[0]]);

            domComodinOptions.innerHTML = '';
            opciones.forEach(opc => {
                let hint = document.createElement('span');
                hint.className = 'comodin-hint';
                hint.innerText = opc.name;
                hint.onclick = () => { alert("¡Pista activada!\nAhora busca '" + opc.name + "' en el mapa y haz clic allí para lanzar."); };
                domComodinOptions.appendChild(hint);
            });

            domComodinOptions.style.display = 'flex';

            // Forzar que el click vuelva al contenedor de Phaser si estábamos en el DOM
            if (game && game.canvas) game.canvas.focus();
        }

        // --- SABÍAS QUE POPUP ---
        function showSabiasQue(infoText) {
            document.getElementById('sabias-que-text').innerText = infoText || "¿Sabías que la gastronomía española es famosa mundialmente?";
            document.getElementById('sabias-que-popup').style.display = 'block';
        }

        function closeSabiasQue() {
            document.getElementById('sabias-que-popup').style.display = 'none';
        }

        function confirmRestart() {
            document.getElementById('confirm-restart-screen').style.display = 'flex';
        }

        function cancelRestart(event) {
            if (event) event.stopPropagation();
            document.getElementById('confirm-restart-screen').style.display = 'none';
        }

        // --- SISTEMA DE NOTIFICACIONES Y RECOMPENSAS ---
        function triggerLossAnimation(el) {
            // Efecto CSS Dom (rojo suave)
            el.style.transition = "transform 0.2s, box-shadow 0.3s, background-color 0.3s";
            el.style.backgroundColor = "#ffebee";
            el.style.boxShadow = "0px 0px 15px 4px rgba(244, 67, 54, 0.4)";
            el.style.transform = "scale(0.95)";

            setTimeout(() => {
                el.style.boxShadow = "4px 4px 0px rgba(0, 0, 0, 0.15)";
                el.style.backgroundColor = "#ffffff";
                el.style.transform = "scale(1)";
                setTimeout(() => { el.style.transition = ""; }, 300);
            }, 400);
        }

        function triggerUseAnimation(el) {
            // Efecto CSS Dom (dorado)
            el.style.transition = "transform 0.1s, box-shadow 0.3s, background-color 0.3s";
            el.style.backgroundColor = "#fffde7";
            el.style.boxShadow = "0px 0px 25px 8px rgba(255, 193, 7, 0.6)";

            // Animación de pulso
            el.style.transform = "scale(1.1)";

            setTimeout(() => {
                el.style.boxShadow = "4px 4px 0px rgba(0, 0, 0, 0.15)";
                el.style.backgroundColor = "#ffffff";
                el.style.transform = "scale(1)";
                setTimeout(() => { el.style.transition = ""; }, 300);
            }, 300);
        }

        function triggerRewardAnimation(el) {
            // Efecto CSS Dom
            el.style.transition = "transform 0.3s, box-shadow 0.3s, background-color 0.3s";
            el.style.transform = "scale(1.3)";
            el.style.boxShadow = "0px 0px 25px 8px rgba(76, 175, 80, 0.6)";
            el.style.backgroundColor = "#e8f5e9";

            // Partículas en Phaser
            if (game && game.scene && game.scene.scenes[0]) {
                let scene = game.scene.scenes[0];
                // Posición estática aproximada del marcador superior derecho
                let px = 1750;
                let py = 100;

                let particles = scene.add.particles(px, py, 'circle', {
                    color: [0x4CAF50, 0xffba08, 0xffffff],
                    speed: { min: 100, max: 400 },
                    scale: { start: 0.6, end: 0 },
                    lifespan: 800,
                    blendMode: 'ADD',
                    quantity: 40
                });
                particles.setDepth(100);
                setTimeout(() => particles.destroy(), 1000);
            }

            setTimeout(() => {
                el.style.transform = "scale(1)";
                el.style.boxShadow = "4px 4px 0px rgba(0, 0, 0, 0.15)";
                el.style.backgroundColor = "#ffffff";
                setTimeout(() => { el.style.transition = ""; }, 300);
            }, 600);
        }

        function checkAndShowNotification(checkStreaks = true) {
            let msgObj = null;

            // 1. Evaluar Recompensas Positivas (Rachas)
            if (checkStreaks) {
                if (rachaAciertos === 3) {
                    msgObj = { title: "¡En racha!", text: "Llevas 3 seguidas. ¡A los 5 ganas un comodín!", type: "info" };
                } else if (rachaAciertos === 4) {
                    msgObj = { title: "¡Buena racha!", text: "Llevas 4 seguidas. ¡A los 5 ganas un comodín!", type: "info" };
                } else if (rachaAciertos === 5) {
                    if (comodines < 7) {
                        comodines++;
                        updateComodinesUI();
                        triggerRewardAnimation(domComodines.parentElement);
                        msgObj = { title: "¡COMBO x5!", text: "¡Has ganado 1 COMODIN extra!", type: "success" };
                    } else {
                        msgObj = { title: "¡COMBO x5!", text: "Comodines al máximo, ¡pero menuda racha llevas!", type: "info" };
                    }
                } else if (rachaAciertos === 6) {
                    msgObj = { title: "¡Imparable!", text: "¡Estás a un acierto de conseguir una VIDA extra!", type: "info" };
                } else if (rachaAciertos === 7) {
                    if (vidas < 7) {
                        vidas++;
                        updateVidasUI();
                        triggerRewardAnimation(domVidas.parentElement);
                        msgObj = { title: "¡COMBO x7!", text: "¡Has ganado 1 VIDA extra!", type: "success" };
                    } else {
                        msgObj = { title: "¡COMBO x7!", text: "Vidas al máximo. ¡Eres una leyenda!", type: "info" };
                    }
                    rachaAciertos = 0; // Reiniciar racha tras máxima recompensa (8)
                }
            }

            // 2. Si no hay recompensa, evaluar Escasez/Peligros (Negativos)
            if (!msgObj) {
                // Combinados primero (los más extremos)
                if (vidas <= 3 && comodines <= 3) {
                    if (vidas === 1 || comodines === 1) {
                        msgObj = { title: "¡ALERTA MÁXIMA!", text: `¡${vidas} vida(s) y ${comodines} comodín(es)! ¡Suerte y la toro!`, type: "danger" };
                    } else if (vidas === 2 || comodines === 2) {
                        msgObj = { title: "¡Sudores fríos!", text: `¡Quedan ${vidas} vidas y ${comodines} comodines! ¡Concéntrate!`, type: "danger" };
                    } else { // 3 y 3
                        msgObj = { title: "¡Uy, uy, uy!", text: `Avisando... 3 vidas y 3 comodines. La cosa se tensa.`, type: "warning" };
                    }
                }
                // Solo vidas
                else if (vidas <= 3) {
                    if (vidas === 3) msgObj = { title: "¡Friendly reminder!", text: "3 vidas restantes. Aún respiramos, pero ojo.", type: "warning" };
                    else if (vidas === 2) msgObj = { title: "Auug!", text: "2 vidas...", type: "danger" };
                    else if (vidas === 1) msgObj = { title: "¡ÚLTIMO ALIENTO!", text: "¡1 sola vida! ", type: "danger" };
                }
                // Solo comodines
                else if (comodines <= 3) {
                    if (comodines === 3) msgObj = { title: "¡Alerta!", text: "Te quedan 3 comodines. ", type: "warning" };
                    else if (comodines === 2) msgObj = { title: "¡Secano total!", text: "Solo 2 comodines... No los gastes a lo loco.", type: "warning" };
                    else if (comodines === 1) msgObj = { title: "¡Última llamada!", text: "¡1 comodín! ¡Resérvalo para una que no sepas!", type: "danger" };
                }
            }

            // 3. Mostrar la notificación si hay mensaje
            if (msgObj) {
                showNotification(msgObj.title, msgObj.text, msgObj.type);
            } else {
                hideNotification();
            }
        }

        // --- FUNCIONES DE CONTROL DE AUDIO ---
        function toggleMusic(event) {
            if (event) event.stopPropagation();
            musicEnabled = !musicEnabled;
            const btn = document.getElementById('music-toggle');
            
            if (musicEnabled) {
                btn.classList.remove('off');
                if (bgMusic) bgMusic.resume();
                else if (game.scene.scenes[0]) {
                    const scene = game.scene.scenes[0];
                    bgMusic = scene.sound.add('flamenco_bg', { loop: true, volume: 0.3 });
                    bgMusic.play();
                }
            } else {
                btn.classList.add('off');
                if (bgMusic) bgMusic.pause();
            }
        }

        function toggleSFX(event) {
            if (event) event.stopPropagation();
            sfxEnabled = !sfxEnabled;
            const btn = document.getElementById('sfx-toggle');
            
            if (sfxEnabled) {
                btn.classList.remove('off');
            } else {
                btn.classList.add('off');
            }
        }

        function showNotification(title, text, type) {
            let pop = document.getElementById('notification-popup');
            let tEl = document.getElementById('notification-title');
            let mEl = document.getElementById('notification-msg');

            tEl.innerText = title;
            mEl.innerText = text;

            // Asignar color de borde según el tipo
            if (type === "success" || type === "info") {
                pop.style.borderLeftColor = "#4CAF50"; // Verde
                tEl.style.color = "#4CAF50";
            } else if (type === "warning") {
                pop.style.borderLeftColor = "#FFD166"; // Amarillo/naranja
                tEl.style.color = "#E59819";
            } else {
                pop.style.borderLeftColor = "#f94144"; // Rojo (danger)
                tEl.style.color = "#f94144";
            }

            // Breve animación reinicio
            pop.style.display = 'none';
            setTimeout(() => { pop.style.display = 'flex'; }, 50);
        }

        function hideNotification() {
            document.getElementById('notification-popup').style.display = 'none';
        }

        // --- MODO EDICIÓN ---
        function toggleEditMode() {
            isEditMode = !isEditMode;
            const btn = document.getElementById('edit-btn');

            if (isEditMode) {
                btn.innerText = "Guardar y Exportar JSON";
                btn.style.background = "#f94144";
                document.getElementById('hud-container').style.display = "none";
                alert("MODO EDICIÓN ACTIVADO:\nArrastra los nombres de las provincias a su posición correcta en el mapa. Cuando termines, pulsa 'Guardar y Exportar JSON'.");
            } else {
                btn.innerText = "Activar Modo Edición";
                btn.style.background = "#43aa8b";
                document.getElementById('hud-container').style.display = "flex";

                // Exportar Data
                exportJSONData();
            }
        }

        function exportJSONData() {
            // Actualizamos IDs, nombres, coords, color e info.
            const updatedData = provincesData.map(p => {
                return {
                    id: p.id,
                    name: p.name,
                    food: p.food,
                    x: p.x,
                    y: p.y,
                    color: p.color,
                    info: p.info
                };
            });

            const jsonString = JSON.stringify(updatedData, null, 4);

            // 1. Mostrar por consola por si acaso
            console.log("NUEVAS COORDENADAS JSON:", jsonString);

            // 2. Descargar archivo automáticamente
            const blob = new Blob([jsonString], { type: "application/json" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = "provincesData_actualizado.json";
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            alert("El archivo JSON con las nuevas posiciones se ha descargado.\nAbre tu archivo index.html original y reemplaza todo el bloque 'const provincesData = [...]' con el contenido de este archivo descargado.");
        }