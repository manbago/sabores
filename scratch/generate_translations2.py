import json
import urllib.request
import urllib.parse
import time
import ssl
import os

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

def translate_text(text, target_lang, source_lang='es'):
    if target_lang == 'es' or target_lang == 'es-419' or not text:
        return text
    
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl={}&tl={}&dt=t&q={}".format(
        source_lang, target_lang, urllib.parse.quote(text)
    )
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'})
        with urllib.request.urlopen(req, context=ctx, timeout=5) as response:
            data = json.loads(response.read().decode())
            translated = "".join([sentence[0] for sentence in data[0]])
            return translated
    except Exception as e:
        print(f"Error translating to {target_lang}: {str(e)}")
        return text

# Cargar base estática
es_base = {
    "title_main": "🍽️ SABOR DE ESPAÑA",
    "title_sub": "The Hoops Challenge",
    "btn_newgame": "▶ NUEVA PARTIDA",
    "btn_options": "⚙️ OPCIONES",
    "btn_about": "ℹ️ ACERCA DE",
    "btn_exit": "🚪 SALIR AL ESCRITORIO",
    "title_options": "Ajustes",
    "lbl_graphics": "💻 Gráficos (Pantalla)",
    "btn_fullscreen": "⛶ Alternar Pantalla Completa",
    "lbl_master_vol": "🔊 Volumen General",
    "lbl_music": "🎷 Música",
    "lbl_sfx": "💥 Efectos",
    "btn_back": "← VOLVER",
    "title_about": "Créditos",
    "about_desc1": "Experiencia interactiva sobre gastronomía española.",
    "about_engine": "Motor Gráfico: Phaser 3",
    "about_created": "Creado por Manuel Bago Cobo",
    "loading_version": "Cargando versión...",
    "notification_title": "Aviso",
    "sabias_que": "💡 ¡Sabías que...!",
    "word_lives": "VIDAS",
    "word_wildcards": "COMODINES",
    "btn_pause": "⏸ Pausa",
    "btn_edit_mode": "✎ Modo Edición",
    "btn_leave": "Salir",
    "dash_title": "🎯 Siguiente Lanzamiento",
    "dash_subtitle": "¿A qué provincia pertenece este plato?",
    "loading_short": "Cargando...",
    "game_over": "¡Juego Terminado!",
    "provinces_score": "Provincias:",
    "btn_play_again": "🔄 Jugar de Nuevo",
    "btn_about_short": "ℹ️ Acerca de",
    "confirm_quit_title": "¿Salir de la Partida?",
    "confirm_quit_desc": "Se perderá tu progreso.",
    "btn_yes_restart": "✓ Sí, reiniciar",
    "btn_cancel": "✕ Cancelar",
    "pause_title": "⏸ PAUSA",
    "btn_resume": "▶ Reanudar",
    "btn_settings": "⚙ Ajustes",
    "btn_main_menu": "🏠 Menú Principal",
    "alert_exit_confirm": "¿Seguro que quieres salir?",
    "alert_exit_web": "Cierra la pestaña para salir.",
    "tt_music": "Música Si/No",
    "tt_sfx": "Efectos Si/No",
    "tt_fullscreen": "Pantalla Completa",
    "tt_wildcard": "Usar Comodín",
    "loading_dishes": "CARGANDO PLATOS...",
    "hint_activated": "¡Busca '{name}' en el mapa!",
    "no_lives": "💔 Sin Vidas",
    "score_final_lose": "Encestaste {count} de 52.",
    "win_title": "🎉 ¡Ganaste!",
    "score_final_win": "¡{count} de 52 provincias!",
    "alert_streak_3": "¡3 seguidas!",
    "alert_streak_4": "¡4 seguidas!",
    "alert_streak_5_title": "¡COMBO x5!",
    "alert_streak_5_won": "¡+1 COMODÍN!",
    "alert_streak_5_max": "¡Menuda racha!",
    "alert_streak_6_title": "¡Imparable!",
    "alert_streak_6": "¡Casi una vida extra!",
    "alert_streak_7_title": "¡COMBO x7!",
    "alert_streak_7_won": "¡+1 VIDA!",
    "alert_streak_7_max": "¡Eres una leyenda!",
    "alert_danger_title": "¡ALERTA MÁXIMA!",
    "alert_danger_1": "¡{vidas} vida, {comodines} comodín!",
    "alert_danger_2_title": "¡Sudores fríos!",
    "alert_danger_2": "¡{vidas} vidas, {comodines} comodines!",
    "alert_warning_3_title": "¡Uy, uy, uy!",
    "alert_warning_3": "3 vidas y 3 comodines.",
    "alert_lives_3_title": "¡Ojo!",
    "alert_lives_3": "3 vidas restantes.",
    "alert_lives_2_title": "¡Cuidado!",
    "alert_lives_2": "2 vidas...",
    "alert_lives_1_title": "¡ÚLTIMO ALIENTO!",
    "alert_lives_1": "¡1 sola vida!",
    "alert_wild_3_title": "¡Alerta!",
    "alert_wild_3": "Te quedan 3 comodines.",
    "alert_wild_2_title": "¡Pocos comodines!",
    "alert_wild_2": "Solo 2 comodines...",
    "alert_wild_1_title": "¡Última llamada!",
    "alert_wild_1": "¡1 comodín!",
    "miss": "¡MISS!",
    "version_footer": "Versión {version} · 52 Provincias",
    "lbl_language": "🌐 Idioma",
    "lbl_control_profile": "🎮 Perfil de Control",
    "opt_profile_arrows": "Flechas + Enter",
    "opt_profile_wasd": "WASD + Espacio",
    "gamepad_detected": "Mando Detectado",
    "gamepad_disconnected": "Mando Desconectado"
}

# Inyectar curiosidades desde provincesData
try:
    with open('data/provincesData.json', 'r', encoding='utf-8') as f:
        provinces = json.load(f)
        for p in provinces:
            es_base[f"info_{p['id']}"] = p['info']
except Exception as e:
    print(f"Error loading provincesData.json: {e}")

languages = [
     'en', 'fr', 'it', 'de', 'bg', 'cs', 'zh-CN', 'zh-TW', 'ko', 'da',
     'es-419', 'fi', 'el', 'nl', 'hu', 'id', 'ja', 'no', 'pl', 'pt',
     'ro', 'ru', 'sv', 'th', 'tr', 'uk', 'vi', 'ar'
]

translations = {'es': es_base.copy()}

# Cargar progreso existente
if os.path.exists('data/translations.json'):
    try:
        with open('data/translations.json', 'r', encoding='utf-8') as f:
            translations = json.load(f)
            # Asegurar que ES tenga las nuevas claves por si acaso
            translations['es'] = es_base.copy()
    except: pass

print(f"Iniciando actualización de traducciones ({len(es_base)} claves por idioma)...")

for lang in languages:
    print(f"Checking language: {lang}...")
    if lang not in translations:
        translations[lang] = {}
    
    # Check each key individualy
    changed = False
    for key, val in es_base.items():
        if key not in translations[lang]:
            print(f"  Translating missing key: {key}...")
            translated = translate_text(val, lang)
            translations[lang][key] = translated
            changed = True
            time.sleep(0.12)  # Throttle
            
    # Save incrementally if this language was updated
    if changed:
        if lang == 'pt':
             # Also update pt-BR and pt-PT if we are on generic 'pt'
             translations['pt-BR'] = translations[lang].copy()
             translations['pt-PT'] = translations[lang].copy()
             
        with open('data/translations.json', 'w', encoding='utf-8') as f:
            json.dump(translations, f, ensure_ascii=False, indent=2)

print("¡Proceso completado!")
