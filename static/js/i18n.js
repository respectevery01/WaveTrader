class I18n {
    constructor() {
        this.currentLocale = localStorage.getItem('locale') || 'en';
        this.translations = {};
        this.loadTranslations();
    }

    async loadTranslations() {
        try {
            const response = await fetch(`/locales/${this.currentLocale}.json`);
            this.translations = await response.json();
            this.updatePageContent();
        } catch (error) {
            console.error('Failed to load translations:', error);
        }
    }

    setLocale(locale) {
        this.currentLocale = locale;
        localStorage.setItem('locale', locale);
        this.loadTranslations();
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations;
        
        for (const k of keys) {
            value = value?.[k];
            if (!value) return key;
        }
        
        // 替换参数
        if (typeof value === 'string' && params) {
            return value.replace(/\{(\w+)\}/g, (match, key) => {
                return params[key] !== undefined ? params[key] : match;
            });
        }
        
        return value;
    }

    updatePageContent() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            // 获取可能存在的参数
            const params = {};
            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-i18n-param-')) {
                    const paramName = attr.name.replace('data-i18n-param-', '');
                    params[paramName] = attr.value;
                }
            }
            element.textContent = this.t(key, params);
        });

        // Update all placeholders with data-i18n-placeholder
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            // 获取可能存在的参数
            const params = {};
            for (const attr of element.attributes) {
                if (attr.name.startsWith('data-i18n-param-')) {
                    const paramName = attr.name.replace('data-i18n-param-', '');
                    params[paramName] = attr.value;
                }
            }
            element.placeholder = this.t(key, params);
        });
    }
}

// Create global i18n instance
window.i18n = new I18n();

// Add language switcher
document.addEventListener('DOMContentLoaded', () => {
    const languageSwitcher = document.createElement('div');
    languageSwitcher.className = 'fixed top-4 left-4 flex gap-2';
    languageSwitcher.innerHTML = `
        <button onclick="i18n.setLocale('en')" class="px-2 py-1 rounded ${i18n.currentLocale === 'en' ? 'bg-purple-600' : 'bg-gray-600'}">EN</button>
        <button onclick="i18n.setLocale('zh')" class="px-2 py-1 rounded ${i18n.currentLocale === 'zh' ? 'bg-purple-600' : 'bg-gray-600'}">中文</button>
    `;
    document.body.appendChild(languageSwitcher);
}); 