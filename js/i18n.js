const i18n_lang_list = [
    { code: 'es', name: 'Español de España' },
    { code: 'en', name: 'Inglés' },
    { code: 'fr', name: 'Francés' },
    { code: 'it', name: 'Italiano' },
    { code: 'de', name: 'Alemán' },
    { code: 'bg', name: 'Búlgaro' },
    { code: 'cs', name: 'Checo' },
    { code: 'zh-CN', name: 'Chino simplificado' },
    { code: 'zh-TW', name: 'Chino tradicional' },
    { code: 'ko', name: 'Coreano' },
    { code: 'da', name: 'Danés' },
    { code: 'es-419', name: 'Español de Hispanoamérica' },
    { code: 'fi', name: 'Finés' },
    { code: 'el', name: 'Griego' },
    { code: 'nl', name: 'Holandés' },
    { code: 'hu', name: 'Húngaro' },
    { code: 'id', name: 'Indonesio' },
    { code: 'ja', name: 'Japonés' },
    { code: 'no', name: 'Noruego' },
    { code: 'pl', name: 'Polaco' },
    { code: 'pt-BR', name: 'Portugués de Brasil' },
    { code: 'pt-PT', name: 'Portugués de Portugal' },
    { code: 'ro', name: 'Rumano' },
    { code: 'ru', name: 'Ruso' },
    { code: 'sv', name: 'Sueco' },
    { code: 'th', name: 'Tailandés' },
    { code: 'tr', name: 'Turco' },
    { code: 'uk', name: 'Ucraniano' },
    { code: 'vi', name: 'Vietnamita' },
    { code: 'ar', name: 'Árabe' }
];

let translations = {};
let currentLanguage = 'es';

// Función para inicializar el manejador de idiomas
async function initI18n() {
    // Sincronizar con GlobalSettings (Nube) si está disponible
    if (window.GlobalSettings && window.GlobalSettings.language) {
        currentLanguage = window.GlobalSettings.language;
    } else {
        currentLanguage = localStorage.getItem('language') || 'es';
    }

    try {
        const response = await fetch('data/translations.json');
        translations = await response.json();
    } catch (e) {
        console.error("Error loading translations:", e);
    }

    // Poblar el selector si existe
    const langSelector = document.getElementById('lang-selector');
    if (langSelector) {
        i18n_lang_list.forEach(lan => {
            let opt = document.createElement('option');
            opt.value = lan.code;
            opt.innerText = lan.name;
            if (lan.code === currentLanguage) opt.selected = true;
            langSelector.appendChild(opt);
        });

        langSelector.addEventListener('change', (e) => {
            setLanguage(e.target.value);
        });
    }

    applyTranslations();
}

// Función principal de traducción para el código
function t(key, params = {}) {
    if (!translations[currentLanguage]) {
        return key;
    }
    let str = translations[currentLanguage][key];
    if (!str && currentLanguage !== 'es') {
        // Fallback to Spanish
        str = translations['es'] ? translations['es'][key] : null;
    }
    if (!str) return key;

    // 1. Reemplazar por nombre de clave: {vidas} -> params.vidas
    for (const [k, v] of Object.entries(params)) {
        str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
    }

    // 2. Reemplazo posicional como fallback: cualquier {placeholder} restante
    //    se sustituye en orden con los valores del objeto params.
    //    Esto cubre idiomas con nombres distintos ({lives}, {vies}, {jolly}, etc.)
    const values = Object.values(params);
    let posIndex = 0;
    str = str.replace(/\{[^}]+\}/g, () => {
        const val = values[posIndex];
        posIndex++;
        return val !== undefined ? val : '';
    });

    return str;
}

// Cambiar el idioma
function setLanguage(lang) {
    if (i18n_lang_list.find(l => l.code === lang)) {
        currentLanguage = lang;
        if (window.GlobalSettings) {
            window.GlobalSettings.language = lang;
            if (typeof saveCloudSettings === 'function') saveCloudSettings();
        }
        localStorage.setItem('language', lang);
        applyTranslations();
    }
}

// Aplicar al DOM
function applyTranslations() {
    // 1. Textos directos
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.innerText = t(key);
    });

    // 2. Títulos
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
        const key = el.getAttribute('data-i18n-title');
        el.setAttribute('title', t(key));
    });

    // 3. Document Title
    const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
    if (titleKey) {
        document.title = t(titleKey);
    }
    
    // Disparar evento global para código que necesite actualizarse (ex: Phaser text dinámico si hace falta)
    window.dispatchEvent(new Event('languageChanged'));
}

document.addEventListener('DOMContentLoaded', initI18n);
