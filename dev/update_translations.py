import json
import os

# Path to the locales directory
locales_dir = '/home/oib/windsurf/soultribe.chat/web/i18n/locales'

# Load the English translations as the source of truth
with open(os.path.join(locales_dir, 'en/translation.json'), 'r', encoding='utf-8') as f:
    en_translations = json.load(f)

# Get the login section from English translations
login_keys = en_translations.get('login', {})
nav_keys = en_translations.get('nav', {})

# List of all language directories (except 'en' which we already processed)
languages = [d for d in os.listdir(locales_dir) if os.path.isdir(os.path.join(locales_dir, d)) and d != 'en']

for lang in languages:
    file_path = os.path.join(locales_dir, lang, 'translation.json')
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            translations = json.load(f)
        
        updated = False
        
        # Update login section
        if 'login' not in translations:
            translations['login'] = login_keys
            updated = True
        else:
            for key, value in login_keys.items():
                if key not in translations['login']:
                    translations['login'][key] = value
                    updated = True
        
        # Update nav section
        if 'nav' not in translations:
            translations['nav'] = nav_keys
            updated = True
        else:
            for key, value in nav_keys.items():
                if key not in translations['nav']:
                    translations['nav'][key] = value
                    updated = True
        
        # Save the updated file if changes were made
        if updated:
            with open(file_path, 'w', encoding='utf-8') as f:
                json.dump(translations, f, ensure_ascii=False, indent=2, sort_keys=True)
            print(f"Updated {file_path}")
        else:
            print(f"No updates needed for {file_path}")
                
    except Exception as e:
        print(f"Error processing {file_path}: {str(e)}")

print("Language file updates complete.")
