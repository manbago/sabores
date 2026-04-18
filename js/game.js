/** 
 * Sabor de España: The Hoops Challenge 
 * Creado por Manuel Bago Cobo
 */
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
let maxRachaActual = 0; // Histórico de racha en la sesión actual

let isShooting = false;
let gameStarted = false; // Bloquea disparos hasta que se pulse JUGAR
let musicEnabled = true;
let sfxEnabled = true;
let bgMusic = null;
let hoverIndex = 0; // Para teclado
let isEditMode = false; // Modo edición
let projectileMaskGraphics; // Gráfico para la máscara del proyectil

// --- STEAM STATS WRAPPER ---
function updateSteamStats(hits, misses, maxCombo) {
    if (typeof gameSwAPI !== 'undefined' && gameSwAPI && gameSwAPI.stats) {
        try {
            // 1. Partidas Jugadas
            let played = gameSwAPI.stats.getInt('STAT_GAMES_PLAYED') || 0;
            gameSwAPI.stats.setInt('STAT_GAMES_PLAYED', played + 1);

            // 2. Aciertos Acumulados
            let totalHits = gameSwAPI.stats.getInt('STAT_TOTAL_HITS') || 0;
            gameSwAPI.stats.setInt('STAT_TOTAL_HITS', totalHits + hits);

            // 3. Fallos Acumulados
            let totalMisses = gameSwAPI.stats.getInt('STAT_TOTAL_MISSES') || 0;
            gameSwAPI.stats.setInt('STAT_TOTAL_MISSES', totalMisses + misses);

            // 4. Mejor Racha Máxima Absoluta
            let bestCombo = gameSwAPI.stats.getInt('STAT_BEST_COMBO') || 0;
            if (maxCombo > bestCombo) {
                gameSwAPI.stats.setInt('STAT_BEST_COMBO', maxCombo);
            }

            // Gurdar en la nube
            gameSwAPI.stats.store();
            console.log("Steam Stats actualizadas correctamente.");
        } catch(e) {
            console.warn("Fallo al actualizar las estadísticas de Steam:", e);
        }
    }
}

// --- STEAM ACHIEVEMENTS WRAPPER ---
function unlockAchievement(achId) {
    if (typeof gameSwAPI !== 'undefined' && gameSwAPI && gameSwAPI.achievement) {
        try {
            if (!gameSwAPI.achievement.isActivated(achId)) {
                gameSwAPI.achievement.activate(achId);
                console.log("Steam Achievement Unlocked:", achId);
            }
        } catch(e) {
            console.warn("Failed to unlock achievement:", e);
        }
    }
}

const MAP_OFFSET_X = 0; // El mapa recortado ya viene centrado, no requiere offset adicional


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

// --- CÁLCULO DE RESOLUCIÓN INICIAL (Prevención de Estiramiento) ---
let initialWidth = 1920;
let initialHeight = 1080;
// Si cargamos directamente en móvil/tablet (vertical), ajustamos la altura interna
if (window.innerWidth < window.innerHeight || window.innerWidth <= 1024) {
    // Tomamos como referencia el alto real del contenedor (aprox 75vh) vs ancho
    const aspect = window.innerHeight * 0.75 / window.innerWidth;
    initialHeight = initialWidth * aspect;
    if (initialHeight < 1080) initialHeight = 1080;
}

const config = {
    type: Phaser.AUTO,
    width: initialWidth,
    height: initialHeight,
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
    input: {
        gamepad: true
    },
    backgroundColor: '#ffffff',
    transparent: false
};

const game = new Phaser.Game(config);

function preload() {
    // Assets finales
    this.load.image('mapa_espana', 'assets/images/mapa-blanco_cut.png');
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
        if (domCurrentFood) domCurrentFood.innerHTML = '<span class="loading-text">' + t('loading_dishes') + ' 0%</span>';
        if (domFoodImage) domFoodImage.innerHTML = '<div class="neon-loader"></div>';

        let pendingLoad = 0;
        dishImagesToLoad.forEach(p => {
            const key = `dish_${p.id}`;
            if (!this.textures.exists(key)) {
                this.load.image(key, p.image);
                pendingLoad++;
            }
        });

        if (pendingLoad > 0) {
            let loadCompleteFired = false;
            let forceTimeout = setTimeout(() => {
                if (!loadCompleteFired) {
                    console.warn("Failsafe: Forzando inicio tras timeout de carga de platos.");
                    loadCompleteFired = true;
                    window._dishImagesReady = true;
                    nextRound();
                }
            }, 10000); // 10 segundos de failsafe para evitar bloqueos

            this.load.on('progress', (value) => {
                if (!loadCompleteFired && domCurrentFood) {
                    let pct = Math.round(value * 100);
                    domCurrentFood.innerHTML = '<span class="loading-text">' + t('loading_dishes') + ' ' + pct + '%</span>';
                }
            });

            this.load.once('complete', () => {
                if (loadCompleteFired) return;
                loadCompleteFired = true;
                clearTimeout(forceTimeout);
                // Simular carga para que el usuario vea el estado final al 100%
                if (domCurrentFood) domCurrentFood.innerHTML = '<span class="loading-text">' + t('loading_dishes') + ' 100%</span>';
                setTimeout(() => {
                    window._dishImagesReady = true;
                    nextRound();
                }, 1000);
            });
            
            // Log de errores en carga individual
            this.load.on('loaderror', (file) => {
                console.warn("Error cargando plato:", file.src);
            });

            this.load.start();
        } else {
            // Todas las texturas ya estaban en caché
            window._dishImagesReady = true;
        }
    } else {
        window._dishImagesReady = true;
    }

    // --- CENTRADO DINÁMICO DEL MAPA (Responsive Pro) ---
    // Usamos el alto ya calculado en el arranque para centrar el mapa de 1080px
    let canvasHeight = this.scale.height;
    let verticalOffset = (canvasHeight - 1080) / 2;
    this.currentVerticalOffset = verticalOffset;
    
    const mapContainer = this.add.container(0, verticalOffset);
    this.mapContainer = mapContainer;

    // Fondo / Mapa decorativo
    let mapBg = this.add.image(960 + MAP_OFFSET_X, 540, 'mapa_espana');
    this.map = mapBg; // Referencia para debug
    // Calculamos escala respecto al alto target (1080px)
    let scale = 1080 / mapBg.height;
    mapBg.setScale(scale);
    mapBg.setDepth(-10);
    mapContainer.add(mapBg);

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
        mapContainer.add(pGroup);

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
            
            // Fix Safari/iOS: el hover no existe, así que resaltamos al tocar
            if (this.sys.game.device.input.touch || navigator.maxTouchPoints > 0) {
                highlightProvince(pGroup, text, this);
            }

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

    // --- OBJETIVOS VIRTUALES (Botones HUD accesibles con flechas/mando) ---
    // Cada uno se coloca donde está físicamente su botón HTML, pero en coordenadas del canvas.

    // [SUPERIOR DERECHA] Comodines
    let wGroup = this.add.container(1820 - MAP_OFFSET_X, 80);
    let wText = this.add.text(0, 0, " ", {fontSize: '1px'});
    wGroup.add(wText); wGroup.mainText = wText; wGroup.isWildcard = true;
    wGroup.setDepth(-100); mapContainer.add(wGroup); provinceSprites.push(wGroup);

    // [COLUMNA DERECHA] Pausa — debajo de la fila de audio (y > 820)
    let pauseGroup = this.add.container(1650 - MAP_OFFSET_X, 920);
    let pauseText = this.add.text(0, 0, " ", {fontSize: '1px'});
    pauseGroup.add(pauseText); pauseGroup.mainText = pauseText; pauseGroup.isPauseBtn = true;
    pauseGroup.setDepth(-100); mapContainer.add(pauseGroup); provinceSprites.push(pauseGroup);

    // [COLUMNA DERECHA] Salir — debajo de Pausa
    let exitGroup = this.add.container(1650 - MAP_OFFSET_X, 1000);
    let exitText = this.add.text(0, 0, " ", {fontSize: '1px'});
    exitGroup.add(exitText); exitGroup.mainText = exitText; exitGroup.isExitBtn = true;
    exitGroup.setDepth(-100); mapContainer.add(exitGroup); provinceSprites.push(exitGroup);

    // [BORDE INFERIOR DERECHO] Pantalla Completa
    let fGroup = this.add.container(1620 - MAP_OFFSET_X, 820);
    let fText = this.add.text(0, 0, " ", {fontSize: '1px'});
    fGroup.add(fText); fGroup.mainText = fText; fGroup.isFullscreen = true;
    fGroup.setDepth(-100); mapContainer.add(fGroup); provinceSprites.push(fGroup);

    // [BORDE INFERIOR DERECHO] Audio: Música — físicamente a la derecha de Fullscreen
    let mGroup = this.add.container(1720 - MAP_OFFSET_X, 820);
    let mText = this.add.text(0, 0, " ", {fontSize: '1px'});
    mGroup.add(mText); mGroup.mainText = mText; mGroup.isMusic = true;
    mGroup.setDepth(-100); mapContainer.add(mGroup); provinceSprites.push(mGroup);

    // [BORDE INFERIOR DERECHO] Audio: Efectos — a la derecha de Música
    let sGroup = this.add.container(1820 - MAP_OFFSET_X, 820);
    let sText = this.add.text(0, 0, " ", {fontSize: '1px'});
    sGroup.add(sText); sGroup.mainText = sText; sGroup.isSFX = true;
    sGroup.setDepth(-100); mapContainer.add(sGroup); provinceSprites.push(sGroup);




    // --- LANZADOR BULL-BOT ---
    // En móvil/tablet lo hacemos más grande (400px) para que se vea mejor, 
    // pero ajustamos la posición para que su base siga en la misma línea "dorada" del HUD.
    let bullSize = 277;
    let bullOffsetY = -60;
    if (window.innerWidth <= 1024) {
        bullSize = 400;
        // Compensamos el crecimiento (400-277)/2 = 61.5px para mantener la base quieta
        bullOffsetY = -60 - 61.5; 
    }

    // Lo situamos al final del canvas + un offset dinámico para PC vs Mobile
    let bottomOffset = (window.innerWidth <= 1024) ? 110 : 60;
    launcher = this.add.container(1015 + MAP_OFFSET_X, canvasHeight + bottomOffset); 
    let bullBot = this.add.sprite(0, bullOffsetY, 'bull_launcher');
    this.bull = bullBot; // Referencia para debug
    bullBot.setDisplaySize(bullSize, bullSize);
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

    // --- CONTROLES Y SOPORTE DE MANDO ---
    function getCurrentProfile() {
        return localStorage.getItem('control_profile') || 'arrows';
    }

    const doAction = () => {
        if (isModalOpen() || window.isPaused) return;
        if (document.getElementById('main-menu-screen').style.display !== 'none' && !document.getElementById('main-menu-screen').classList.contains('hidden')) return;
        if (!isShooting && provinceSprites[hoverIndex]) {
            if (provinceSprites[hoverIndex].isWildcard) {
                if (typeof usarComodin === 'function') usarComodin();
            } else if (provinceSprites[hoverIndex].isMusic) {
                if (typeof window.toggleMusic === 'function') window.toggleMusic();
            } else if (provinceSprites[hoverIndex].isSFX) {
                if (typeof window.toggleSFX === 'function') window.toggleSFX();
            } else if (provinceSprites[hoverIndex].isFullscreen) {
                if (typeof window.toggleFullscreen === 'function') window.toggleFullscreen();
            } else if (provinceSprites[hoverIndex].isPauseBtn) {
                if (typeof window.togglePause === 'function') window.togglePause();
            } else if (provinceSprites[hoverIndex].isExitBtn) {
                if (typeof window.confirmRestart === 'function') window.confirmRestart();
            } else {
                shootAt(provinceSprites[hoverIndex].provinceData, provinceSprites[hoverIndex]);
            }
        }
    };

    // Teclado
    this.input.keyboard.on('keydown-RIGHT', () => { if (getCurrentProfile() === 'arrows') navigateKeyboard('RIGHT'); });
    this.input.keyboard.on('keydown-LEFT', () => { if (getCurrentProfile() === 'arrows') navigateKeyboard('LEFT'); });
    this.input.keyboard.on('keydown-UP', () => { if (getCurrentProfile() === 'arrows') navigateKeyboard('UP'); });
    this.input.keyboard.on('keydown-DOWN', () => { if (getCurrentProfile() === 'arrows') navigateKeyboard('DOWN'); });
    this.input.keyboard.on('keydown-ENTER', () => { if (getCurrentProfile() === 'arrows') doAction(); });

    this.input.keyboard.on('keydown-D', () => { if (getCurrentProfile() === 'wasd') navigateKeyboard('RIGHT'); });
    this.input.keyboard.on('keydown-A', () => { if (getCurrentProfile() === 'wasd') navigateKeyboard('LEFT'); });
    this.input.keyboard.on('keydown-W', () => { if (getCurrentProfile() === 'wasd') navigateKeyboard('UP'); });
    this.input.keyboard.on('keydown-S', () => { if (getCurrentProfile() === 'wasd') navigateKeyboard('DOWN'); });
    this.input.keyboard.on('keydown-SPACE', () => { if (getCurrentProfile() === 'wasd') doAction(); });

    // Atajos HUD y Accesibilidad
    this.input.keyboard.on('keydown-SHIFT', () => { if (typeof usarComodin === 'function') usarComodin(); });
    this.input.keyboard.on('keydown-C', () => { if (typeof usarComodin === 'function') usarComodin(); });
    this.input.keyboard.on('keydown-M', () => { if (typeof window.toggleMusic === 'function') window.toggleMusic(); });
    this.input.keyboard.on('keydown-X', () => { if (typeof window.toggleSFX === 'function') window.toggleSFX(); });
    // P = Pausa directa, Q = Salir (confirmación)
    this.input.keyboard.on('keydown-P', () => {
        if (typeof gameStarted !== 'undefined' && gameStarted && document.getElementById('main-menu-screen').classList.contains('hidden')) {
            if (typeof window.togglePause === 'function') window.togglePause();
        }
    });
    this.input.keyboard.on('keydown-Q', () => {
        if (typeof gameStarted !== 'undefined' && gameStarted && !window.isPaused) {
            if (typeof window.confirmRestart === 'function') window.confirmRestart();
        }
    });

    // Gamepad (Phaser native wrapper)
    this.input.gamepad.on('connected', (pad) => {
        const ind = document.getElementById('gamepad-indicator');
        if (ind) ind.style.display = 'flex';
        
        pad.on('down', (index, value, button) => {
            // Aceptar/Disparar: Botón A (Steam/Xbox index 0)
            if (index === 0) {
                // If we are playing
                doAction();
            }
            // D-PAD
            if (index === 12) navigateKeyboard('UP');
            if (index === 13) navigateKeyboard('DOWN');
            if (index === 14) navigateKeyboard('LEFT');
            if (index === 15) navigateKeyboard('RIGHT');
            
            // Pausa / Atrás: Botón B (index 1) o Menú (index 9)
            if (index === 1 || index === 9) {
                if (typeof gameStarted !== 'undefined' && gameStarted && document.getElementById('main-menu-screen').classList.contains('hidden')) {
                    if (typeof window.togglePause === 'function') window.togglePause();
                }
            }
            
            // Comodín: Botón Y (index 3)
            if (index === 3) {
                if (typeof usarComodin === 'function') usarComodin();
            }
        });
    });

    this.input.gamepad.on('disconnected', (pad) => {
        if (this.input.gamepad.total === 0) {
            const ind = document.getElementById('gamepad-indicator');
            if (ind) ind.style.display = 'none';
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
                let initialMusicVol = typeof window.musicVolumeFactor !== 'undefined' ? window.musicVolumeFactor : 0.24;
                bgMusic = this.sound.add('flamenco_bg', { loop: true, volume: initialMusicVol });
            }
            bgMusic.play();
        }
    });
}

let gameSwAPI = null;
try { if (typeof require !== 'undefined') gameSwAPI = require('electron').remote ? require('electron').remote.getGlobal('steamworks') : require('steamworks.js'); } catch(e){}
let swInGameSet = null;
let swInGameUp = null, swInGameDown = null, swInGameLeft = null, swInGameRight = null, swInGameShoot = null, swInGamePause = null, swInGameWildcard = null;

function update() {
    // 0. Gamepad Analog Stick Polling & Steamworks Input
    let usedSteamInput = false;
    let now = this.time.now;
    
    if (gameSwAPI && gameSwAPI.input) {
        try {
            const controllers = gameSwAPI.input.getControllers();
            if (controllers && controllers.length > 0) {
                usedSteamInput = true;
                const pad = controllers[0];
                if (!swInGameSet) swInGameSet = gameSwAPI.input.getActionSet("InGame");
                if (!swInGameUp) swInGameUp = gameSwAPI.input.getDigitalAction("action_up");
                if (!swInGameDown) swInGameDown = gameSwAPI.input.getDigitalAction("action_down");
                if (!swInGameLeft) swInGameLeft = gameSwAPI.input.getDigitalAction("action_left");
                if (!swInGameRight) swInGameRight = gameSwAPI.input.getDigitalAction("action_right");
                if (!swInGameShoot) swInGameShoot = gameSwAPI.input.getDigitalAction("action_shoot");
                if (!swInGamePause) swInGamePause = gameSwAPI.input.getDigitalAction("action_pause");
                if (!swInGameWildcard) swInGameWildcard = gameSwAPI.input.getDigitalAction("action_wildcard");

                pad.activateActionSet(swInGameSet);

                if (!this.lastGamepadNav || now > this.lastGamepadNav + 250) {
                    if (pad.isDigitalActionPressed(swInGameRight)) { navigateKeyboard('RIGHT'); this.lastGamepadNav = now; }
                    else if (pad.isDigitalActionPressed(swInGameLeft)) { navigateKeyboard('LEFT'); this.lastGamepadNav = now; }
                    else if (pad.isDigitalActionPressed(swInGameDown)) { navigateKeyboard('DOWN'); this.lastGamepadNav = now; }
                    else if (pad.isDigitalActionPressed(swInGameUp)) { navigateKeyboard('UP'); this.lastGamepadNav = now; }
                }

                // Shoot
                if (pad.isDigitalActionPressed(swInGameShoot)) {
                    if (!this.lastGamepadShoot || now > this.lastGamepadShoot + 300) {
                        doAction();
                        this.lastGamepadShoot = now;
                    }
                }
                
                // Pause
                if (pad.isDigitalActionPressed(swInGamePause)) {
                    if (!this.lastGamepadPause || now > this.lastGamepadPause + 500) {
                        if (typeof gameStarted !== 'undefined' && gameStarted && document.getElementById('main-menu-screen').classList.contains('hidden')) {
                            if (typeof window.togglePause === 'function') window.togglePause();
                        }
                        this.lastGamepadPause = now;
                    }
                }

                // Wildcard (Comodín)
                if (pad.isDigitalActionPressed(swInGameWildcard)) {
                    if (!this.lastGamepadWildcard || now > this.lastGamepadWildcard + 500) {
                        if (typeof usarComodin === 'function') usarComodin();
                        this.lastGamepadWildcard = now;
                    }
                }

            }
        } catch(e) {}
    }

    if (!usedSteamInput && this.input.gamepad.total > 0) {
        let pad = this.input.gamepad.pads[0];
        if (pad && pad.axes.length > 1) {
            let x = pad.axes[0].getValue();
            let y = pad.axes[1].getValue();
            if (!this.lastGamepadNav || now > this.lastGamepadNav + 250) {
                if (x > 0.6) { navigateKeyboard('RIGHT'); this.lastGamepadNav = now; }
                else if (x < -0.6) { navigateKeyboard('LEFT'); this.lastGamepadNav = now; }
                else if (y > 0.6) { navigateKeyboard('DOWN'); this.lastGamepadNav = now; }
                else if (y < -0.6) { navigateKeyboard('UP'); this.lastGamepadNav = now; }
            }
        }
    }

    // 1. Apuntar el Robot-Toro al ratón
    if (launcher && launcher.bullBot && !isEditMode) {
        let pointer = this.input.activePointer;
        let angle = Phaser.Math.Angle.Between(launcher.x, launcher.y - 60, pointer.worldX, pointer.worldY);

        let targetRot = angle + Math.PI / 2;
        // Límites de rotación
        if (targetRot > 1.2) targetRot = 1.2;
        if (targetRot < -1.2) targetRot = -1.2;

        if (!isShooting) {
            // Fix Safari/iOS: solo rotar en tiempo real si hay ratón físico.
            // Usamos matchMedia para detectar ratón de precisión (mouse) vs solo táctil.
            // navigator.maxTouchPoints > 0 es falso positivo en PCs con Windows Ink.
            const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
            if (hasFinePointer || pointer.isDown) {
                launcher.bullBot.rotation = targetRot;
            }

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
    // Logro Primera Partida
    if (aciertos === 0 && fallos === 0) unlockAchievement('ACH_FIRST_PLAY');

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
        let vol = 0.8 * (typeof window.sfxVolumeFactor !== 'undefined' ? window.sfxVolumeFactor : 0.56);
        scene.sound.play('bull_sound', { volume: vol });
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

    // Animación unificada del proyectil (Horizontal, Escala y Rotación)
    scene.tweens.add({
        targets: projectile,
        x: targetProv.x + MAP_OFFSET_X,
        scaleX: 0.2, 
        scaleY: 0.2,
        angle: 720,
        duration: 1500,
        ease: 'Linear',
        onComplete: () => {
            checkResult(targetProv, targetSprite, scene);
        }
    });

    // Parábola (Vertical): Sube a un punto pico y luego baja al objetivo real con offset
    let peakY = (targetProv.y + scene.currentVerticalOffset) - 300;
    let finalY = targetProv.y + scene.currentVerticalOffset;

    scene.tweens.add({
        targets: projectile,
        y: peakY,
        duration: 750,
        ease: 'Cubic.easeOut',
        onComplete: () => {
            if (!projectile || !projectile.active) return;
            scene.tweens.add({
                targets: projectile,
                y: finalY,
                duration: 750,
                ease: 'Cubic.easeIn'
            });
        }
    });
}

function checkResult(selectedProv, targetSprite, scene) {
    // --- DESAPARICIÓN INMEDIATA Y EFECTO DE IMPACTO ---
    if (projectile.trail) projectile.trail.destroy();
    if (projectile) projectile.destroy();
    if (projectileMaskGraphics) projectileMaskGraphics.destroy();

    // Partículas de "estallido" (Shatter effect) en la posición real del mapa
    let shatter = scene.add.particles(selectedProv.x + MAP_OFFSET_X, selectedProv.y + scene.currentVerticalOffset, 'circle', {
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
        if (sfxEnabled && scene.cache.audio.exists('success_sound')) {
            let vol = 0.7 * (typeof window.sfxVolumeFactor !== 'undefined' ? window.sfxVolumeFactor : 0.56);
            scene.sound.play('success_sound', { volume: vol });
        }

        aciertos++;
        rachaAciertos++; // Incrementar racha
        if (rachaAciertos > maxRachaActual) {
            maxRachaActual = rachaAciertos;
        }
        
        // Logros de Racha
        if (rachaAciertos === 5) unlockAchievement('ACH_COMBO_5');
        if (rachaAciertos === 10) unlockAchievement('ACH_COMBO_10');

        domAciertos.innerText = aciertos;

        // Popup SWISH!
        const swishMessages = ['\u00A1SWISH! \uD83C\uDF89', '\uD83D\uDC4F \u00A1Ole!', '\uD83E\uDD73 \u00A1Bien!', '\uD83C\uDF55 \u00A1Correcto!'];
        const swishMsg = swishMessages[aciertos % swishMessages.length];
        let swishText = scene.add.text(selectedProv.x + MAP_OFFSET_X, selectedProv.y + (scene.currentVerticalOffset || 0) - 50, swishMsg, {
            fontFamily: 'Fredoka One', fontSize: '52px', color: '#06d6a0',
            stroke: '#073b4c', strokeThickness: 8
        }).setOrigin(0.5).setDepth(30);

        scene.tweens.add({
            targets: swishText, y: '-=150', alpha: 0, scale: 1.4, duration: 1800,
            ease: 'Cubic.easeOut',
            onComplete: () => swishText.destroy()
        });

        // Confeti de colores en partículas — permanece en el mapa como celebración
        let particles = scene.add.particles(selectedProv.x + MAP_OFFSET_X, selectedProv.y + (scene.currentVerticalOffset || 0), 'circle', {
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
        let ring2 = scene.add.circle(selectedProv.x + MAP_OFFSET_X, selectedProv.y + (scene.currentVerticalOffset || 0), 10, 0x06d6a0, 0.7).setDepth(28);
        scene.tweens.add({ targets: ring2, radius: 90, alpha: 0, duration: 500, ease: 'Cubic.easeOut', onComplete: () => ring2.destroy() });

        setTimeout(() => {
            showSabiasQue(t('info_' + selectedProv.id));
            nextRound(); // Pasar de ronda inmediatamente sin esperar al popup
        }, 1000);

    } else {
        // FALLO
        if (sfxEnabled && scene.cache.audio.exists('fail_sound')) {
            let vol = 0.4 * (typeof window.sfxVolumeFactor !== 'undefined' ? window.sfxVolumeFactor : 0.56);
            scene.sound.play('fail_sound', { volume: vol });
        }

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
        let missText = scene.add.text(selectedProv.x + MAP_OFFSET_X, selectedProv.y + (scene.currentVerticalOffset || 0) - 50, t('miss'), {
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

    // Eliminar flags HTML (usar getElementById u querySelector de los ID)
    if (group.isWildcard) {
        document.querySelector('.comodines-box').classList.add('gamepad-focus');
        return;
    }
    if (group.isMusic) {
        let el = document.getElementById('music-toggle');
        if (el) el.classList.add('gamepad-focus');
        return;
    }
    if (group.isSFX) {
        let el = document.getElementById('sfx-toggle');
        if (el) el.classList.add('gamepad-focus');
        return;
    }
    if (group.isFullscreen) {
        let el = document.getElementById('fullscreen-btn');
        if (el) el.classList.add('gamepad-focus');
        return;
    }
    if (group.isPauseBtn) {
        let el = document.getElementById('pause-btn');
        if (el) el.classList.add('gamepad-focus');
        return;
    }
    if (group.isExitBtn) {
        let el = document.getElementById('restart-btn');
        if (el) el.classList.add('gamepad-focus');
        return;
    }

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

    // Limpiar resaltado HTML de objetivos virtuales
    if (group.isWildcard) {
        document.querySelector('.comodines-box').classList.remove('gamepad-focus');
        return;
    }
    if (group.isMusic) {
        let el = document.getElementById('music-toggle');
        if (el) el.classList.remove('gamepad-focus');
        return;
    }
    if (group.isSFX) {
        let el = document.getElementById('sfx-toggle');
        if (el) el.classList.remove('gamepad-focus');
        return;
    }
    if (group.isFullscreen) {
        let el = document.getElementById('fullscreen-btn');
        if (el) el.classList.remove('gamepad-focus');
        return;
    }
    if (group.isPauseBtn) {
        let el = document.getElementById('pause-btn');
        if (el) el.classList.remove('gamepad-focus');
        return;
    }
    if (group.isExitBtn) {
        let el = document.getElementById('restart-btn');
        if (el) el.classList.remove('gamepad-focus');
        return;
    }

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
    // Almacenar estadísticas y guardarlas en Steam en el momento del Game Over
    updateSteamStats(aciertos, fallos, maxRachaActual);

    let mainBtn = document.getElementById('btn-game-over-main');
    let aboutBtn = document.getElementById('btn-game-over-about');

    if (vidas <= 0) {
        document.querySelector('#game-over-box h1').innerText = "\uD83D\uDC94 " + t('no_lives').replace('💔 ', '');
        document.querySelector('#game-over-box p.final-score').innerHTML = t('score_final_lose', {count: '<span id="final-aciertos">0</span>'});
        if(mainBtn) mainBtn.innerText = t('btn_play_again');
        if(aboutBtn) aboutBtn.style.display = "none";
        document.getElementById('game-over-box').style.boxShadow = "0 20px 50px rgba(0,0,0,0.5)";
        document.getElementById('game-over-screen').style.backgroundColor = ''; // Restaurar sombra negra normal
    } else {
        document.querySelector('#game-over-box h1').innerText = "\uD83C\uDF89 " + t('win_title').replace('🎉 ', '');
        document.querySelector('#game-over-box p.final-score').innerHTML = t('score_final_win', {count: '<span id="final-aciertos">0</span>'});
        if(mainBtn) mainBtn.innerText = t('btn_main_menu');
        if(aboutBtn) aboutBtn.style.display = "block";
        document.getElementById('game-over-box').style.boxShadow = "0 0 80px rgba(255, 209, 102, 0.8)";
        
        unlockAchievement('ACH_GAME_CLEAR');
        
        // Efecto Sonoro Triunfal
        if (sfxEnabled && typeof _playTone !== 'undefined') {
            _playTone(400, 'square', 0.2, 0.1, 0.05, 0.1);
            setTimeout(() => _playTone(500, 'square', 0.2, 0.1, 0.05, 0.1), 150);
            setTimeout(() => _playTone(600, 'square', 0.6, 0.2, 0.05, 0.4), 300);
            setTimeout(() => _playTone(800, 'square', 1.0, 0.3, 0.1, 0.8), 500);
        }

        // LANZAR CONFETI DOM (Librería Canvas-Confetti)
        if (typeof confetti === 'function') {
            const count = 200;
            const defaults = { origin: { y: 0.7 }, zIndex: 1000 };

            function fire(particleRatio, opts) {
                confetti({
                    ...defaults,
                    ...opts,
                    particleCount: Math.floor(count * particleRatio)
                });
            }

            fire(0.25, { spread: 26, startVelocity: 55 });
            fire(0.2, { spread: 60 });
            fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
            fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
            fire(0.1, { spread: 120, startVelocity: 45 });
        }
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
    const maxVidas = 7; // Total de vidas
    let html = '';
    for (let i = 0; i < maxVidas; i++) {
        if (i < vidas) {
            html += '<span class="icon-active" style="font-size:18px;filter:drop-shadow(0 0 3px #a855f7)">🧠</span>';
        } else {
            html += '<span class="icon-spent" style="font-size:18px;opacity:0.65">🧠</span>';
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
    const maxComodines = 5;
    let html = '';
    for (let i = 0; i < maxComodines; i++) {
        if (i < comodines) {
            html += '<span class="icon-active" style="font-size:22px;filter:drop-shadow(0 0 4px #a855f7)">🃏</span>';
        } else {
            html += '<span class="icon-spent" style="font-size:22px;opacity:0.65">🃏</span>';
        }
    }
    domComodines.innerHTML = html;

    const comodinesBox = document.querySelector('.comodines-box');
    if (comodinesBox) {
        if (comodines <= 2) comodinesBox.classList.add('danger');
        else comodinesBox.classList.remove('danger');
    }
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
        hint.onclick = () => { alert(t('hint_activated', {name: opc.name})); };
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
    // Reajustar posición de notificación si existe en móvil
    const pop = document.getElementById('notification-popup');
    if (window.innerWidth <= 768) {
        pop.style.top = ''; // Volver al CSS (85px)
    }
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
            msgObj = { title: t('alert_streak_3'), text: t('alert_streak_3'), type: "info" };
        } else if (rachaAciertos === 4) {
            msgObj = { title: t('alert_streak_4'), text: t('alert_streak_4'), type: "info" };
        } else if (rachaAciertos === 5) {
            if (comodines < 7) {
                comodines++;
                updateComodinesUI();
                triggerRewardAnimation(domComodines.parentElement);
                msgObj = { title: t('alert_streak_5_title'), text: t('alert_streak_5_won'), type: "success" };
            } else {
                msgObj = { title: t('alert_streak_5_title'), text: t('alert_streak_5_max'), type: "info" };
            }
        } else if (rachaAciertos === 6) {
            msgObj = { title: t('alert_streak_6_title'), text: t('alert_streak_6'), type: "info" };
        } else if (rachaAciertos === 7) {
            if (vidas < 7) {
                vidas++;
                updateVidasUI();
                triggerRewardAnimation(domVidas.parentElement);
                msgObj = { title: t('alert_streak_7_title'), text: t('alert_streak_7_won'), type: "success" };
            } else {
                msgObj = { title: t('alert_streak_7_title'), text: t('alert_streak_7_max'), type: "info" };
            }
            rachaAciertos = 0; // Reiniciar racha tras máxima recompensa (8)
        }
    }

    // 2. Si no hay recompensa, evaluar Escasez/Peligros (Negativos)
    if (!msgObj) {
        // Combinados primero (los más extremos)
        if (vidas <= 3 && comodines <= 3) {
            if (vidas === 1 || comodines === 1) {
                msgObj = { title: t('alert_danger_title'), text: t('alert_danger_1', {vidas: vidas, comodines: comodines, lives: vidas, wildcards: comodines}), type: "danger" };
            } else if (vidas === 2 || comodines === 2) {
                msgObj = { title: t('alert_danger_2_title'), text: t('alert_danger_2', {vidas: vidas, comodines: comodines, lives: vidas, wildcards: comodines}), type: "danger" };
            } else { // 3 y 3
                msgObj = { title: t('alert_warning_3_title'), text: t('alert_warning_3'), type: "warning" };
            }
        }
        // Solo vidas
        else if (vidas <= 3) {
            if (vidas === 3) msgObj = { title: t('alert_lives_3_title'), text: t('alert_lives_3'), type: "warning" };
            else if (vidas === 2) msgObj = { title: t('alert_lives_2_title'), text: t('alert_lives_2'), type: "danger" };
            else if (vidas === 1) msgObj = { title: t('alert_lives_1_title'), text: t('alert_lives_1'), type: "danger" };
        }
        // Solo comodines
        else if (comodines <= 3) {
            if (comodines === 3) msgObj = { title: t('alert_wild_3_title'), text: t('alert_wild_3'), type: "warning" };
            else if (comodines === 2) msgObj = { title: t('alert_wild_2_title'), text: t('alert_wild_2'), type: "warning" };
            else if (comodines === 1) msgObj = { title: t('alert_wild_1_title'), text: t('alert_wild_1'), type: "danger" };
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

    // Reposicionamiento dinámico en móvil si el "Sabías que" está abierto
    const sabiasPop = document.getElementById('sabias-que-popup');
    if (window.innerWidth <= 768 && sabiasPop && sabiasPop.style.display === 'block') {
        const rect = sabiasPop.getBoundingClientRect();
        // Ponemos el top de la notificación después del final del popup de sabias que
        // (En móvil ambos suelen estar a left: 10px, right: 10px)
        pop.style.top = (sabiasPop.offsetTop + sabiasPop.offsetHeight + 10) + 'px';
    } else {
        pop.style.top = ''; // Usar el valor base de CSS (85px)
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

    // Crear o remover el overlay de edición
    let overlay = document.getElementById('edit-overlay');

    if (isEditMode) {
        btn.innerText = "💾 Guardar y Exportar";
        btn.style.background = "#073b4c";
        btn.style.boxShadow = "0 5px 0 #000";
        document.getElementById('hud-container').style.display = "none";
        
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'edit-overlay';
            overlay.innerHTML = `
                <div style="position: fixed; top: 20px; left: 50%; transform: translateX(-50%); 
                            background: rgba(7, 59, 76, 0.9); color: white; padding: 15px 30px; 
                            border-radius: 50px; border: 4px solid #ffd166; z-index: 1000;
                            font-family: 'Fredoka One', cursive; pointer-events: none; text-align: center;
                            box-shadow: 0 10px 30px rgba(0,0,0,0.5);">
                    🏗️ MODO EDICIÓN ACTIVADO<br>
                    <span style="font-size: 14px; font-family: 'Nunito', sans-serif; opacity: 0.9;">
                        Arrastra los nombres a su sitio. Pulsa GUARDAR al terminar.
                    </span>
                </div>
            `;
            document.body.appendChild(overlay);
        }
    } else {
        btn.innerText = "✎ Modo Edición";
        btn.style.background = "#06d6a0";
        btn.style.boxShadow = "0 5px 0 #049070";
        document.getElementById('hud-container').style.display = "flex";
        if (overlay) overlay.remove();

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
            info: p.info,
            image: p.image // Asegurar que no perdemos la imagen
        };
    });

    const jsonString = JSON.stringify(updatedData, null, 4);

    // 1. Mostrar por consola con un marcador claro para el asistente
    console.log("=== BEGIN UPDATE DATA ===");
    console.log(jsonString);
    console.log("=== END UPDATE DATA ===");

    // 2. Descargar archivo automáticamente
    const blob = new Blob([jsonString], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = "provincesData.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    alert("¡Posiciones guardadas!\n\nSe ha descargado el archivo 'provincesData.json'. Pásame el contenido si quieres que actualice el proyecto por ti.");
}