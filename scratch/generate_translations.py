import json
import urllib.request
import urllib.parse
import time

def translate_text(text, target_lang, source_lang='es'):
    if target_lang == 'es' or target_lang == 'es-419' or not text:
        return text
    
    url = "https://translate.googleapis.com/translate_a/single?client=gtx&sl={}&tl={}&dt=t&q={}".format(
        source_lang, target_lang, urllib.parse.quote(text)
    )
    
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            # data[0] contains the translations
            translated = "".join([sentence[0] for sentence in data[0]])
            return translated
    except Exception as e:
        print(f"Error translating '{text}' to {target_lang}: {e}")
        return text

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
    "about_desc1": "Desarrollado como una experiencia interactiva para aprender sobre la gastronomía española mientras te diviertes.",
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
    "confirm_quit_desc": "Se perderá tu progreso actual.",
    "btn_yes_restart": "✓ Sí, reiniciar",
    "btn_cancel": "✕ Cancelar",
    "pause_title": "⏸ PAUSA",
    "btn_resume": "▶ Reanudar",
    "btn_settings": "⚙ Ajustes",
    "btn_main_menu": "🏠 Menú Principal",
    "alert_exit_confirm": "¿Estás seguro de que quieres salir al escritorio?",
    "alert_exit_web": "Para salir del juego en el navegador, simplemente cierra esta pestaña.",
    "tt_music": "Música Si/No",
    "tt_sfx": "Efectos Si/No",
    "tt_fullscreen": "Pantalla Completa (F11)",
    "tt_wildcard": "Clic para usar Comodín (Pista)",
    
    "loading_dishes": "CARGANDO PLATOS...",
    "hint_activated": "¡Pista activada!\\nAhora busca '{name}' en el mapa y haz clic allí para lanzar.",
    "no_lives": "💔 Sin Vidas",
    "score_final_lose": "Encestaste {count} platos de 52.",
    "win_title": "🎉 ¡Ganaste!",
    "score_final_win": "¡{count} de 52 provincias!",
    "alert_streak_3": "Llevas 3 seguidas. ¡A los 5 ganas un comodín!",
    "alert_streak_4": "Llevas 4 seguidas. ¡A los 5 ganas un comodín!",
    "alert_streak_5_title": "¡COMBO x5!",
    "alert_streak_5_won": "¡Has ganado 1 COMODIN extra!",
    "alert_streak_5_max": "Comodines al máximo, ¡pero menuda racha llevas!",
    "alert_streak_6_title": "¡Imparable!",
    "alert_streak_6": "¡Estás a un acierto de conseguir una VIDA extra!",
    "alert_streak_7_title": "¡COMBO x7!",
    "alert_streak_7_won": "¡Has ganado 1 VIDA extra!",
    "alert_streak_7_max": "Vidas al máximo. ¡Eres una leyenda!",
    "alert_danger_title": "¡ALERTA MÁXIMA!",
    "alert_danger_1": "¡{vidas} vida(s) y {comodines} comodín(es)! ¡Suerte y al toro!",
    "alert_danger_2_title": "¡Sudores fríos!",
    "alert_danger_2": "¡Quedan {vidas} vidas y {comodines} comodines! Good karma!",
    "alert_warning_3_title": "¡Uy, uy, uy!",
    "alert_warning_3": "Avisando... 3 vidas y 3 comodines. La cosa se tensa.",
    "alert_lives_3_title": "¡Friendly reminder!",
    "alert_lives_3": "3 vidas restantes. Aún respiramos, pero ojo.",
    "alert_lives_2_title": "Auug!",
    "alert_lives_2": "2 vidas...",
    "alert_lives_1_title": "¡ÚLTIMO ALIENTO!",
    "alert_lives_1": "¡1 sola vida! ",
    "alert_wild_3_title": "¡Alerta!",
    "alert_wild_3": "Te quedan 3 comodines. ",
    "alert_wild_2_title": "¡Secano total!",
    "alert_wild_2": "Solo 2 comodines... No los gastes a lo loco.",
    "alert_wild_1_title": "¡Última llamada!",
    "alert_wild_1": "¡1 comodín! ¡Resérvalo para una que no sepas!",
    "miss": "¡MISS!",
    "version_footer": "Versión {version} · 52 Provincias",
    "lbl_language": "🌐 Idioma"
}

languages = [
     'en', 'fr', 'it', 'de', 'bg', 'cs', 'zh-CN', 'zh-TW', 'ko', 'da',
     'es-419', 'fi', 'el', 'nl', 'hu', 'id', 'ja', 'no', 'pl', 'pt',
     'ro', 'ru', 'sv', 'th', 'tr', 'uk', 'vi', 'ar'
]

translations = {}
translations['es'] = es_base.copy()

print("Generando JSON básico para todas las traducciones. Espere...")
for lang in languages:
    print(f"Traduciendo a {lang}...")
    lang_dict = {}
    for key, val in es_base.items():
        # Handle param keys smoothly
        # Replace template tags temporarily to avoid breaking them
        text_to_translate = val
        
        # Don't translate placeholders fully if possible, but Google Translate usually handles {name} fine
        # We will translate directly.
        translated = translate_text(text_to_translate, lang)
        lang_dict[key] = translated
        time.sleep(0.1)
    
    # Correct pt to pt-BR/pt-PT for our array if needed
    if lang == 'pt':
        translations['pt-BR'] = lang_dict.copy()
        translations['pt-PT'] = lang_dict.copy()
    else:
        translations[lang] = lang_dict

with open('data/translations.json', 'w', encoding='utf-8') as f:
    json.dump(translations, f, ensure_ascii=False, indent=2)

print("¡Traducciones generadas en data/translations.json!")
