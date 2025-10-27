from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import subprocess
import json
import os
from pydantic import BaseModel
from typing import List

# Assuming auth dependency is defined elsewhere, e.g., in main.py
get_current_user = HTTPBearer()

router = APIRouter()

class TranslateKeyRequest(BaseModel):
    lang: str
    key: str

class TranslateKeyResponse(BaseModel):
    ok: bool
    key: str
    src: str
    dst: str
    prompt: str
    retry_prompt: str | None = None

class BatchTranslateRequest(BaseModel):
    keys: List[str]  # List of translation keys
    lang: str       # Target language for all keys in the batch

class BatchTranslateResponse(BaseModel):
    results: List[TranslateKeyResponse]

class ImportKeysRequest(BaseModel):
    lang: str  # Target language to import keys for

class ImportKeysResponse(BaseModel):
    keys_imported: List[str]  # List of keys that were 'imported' or added

class ListKeysRequest(BaseModel):
    pass  # No parameters needed for now, but could add filters later

class ListKeysResponse(BaseModel):
    keys: List[str]  # List of available translation keys

class SaveTranslationRequest(BaseModel):
    key: str
    lang: str
    translation: str  # The translated text to save

class SaveTranslationResponse(BaseModel):
    ok: bool
    message: str

translations_store = {}

@router.post("/i18n-admin/translate-key", response_model=TranslateKeyResponse)
async def translate_key(request: TranslateKeyRequest, credentials: HTTPAuthorizationCredentials = Depends(get_current_user)):
    # Validate auth (simplified; use actual user verification)
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Simple in-memory English translations (replace with database query in production)
    english_translations = {
        "greeting": "Hello, world!",
        "welcome": "Welcome to the app",
        # Add more keys as needed; this should be dynamically loaded in a real system
    }
    english_text = english_translations.get(request.key, request.key)  # Fall back to key if not found
    if english_text is None:
        raise HTTPException(status_code=404, detail=f"English translation for key '{request.key}' not found")
    
    # Build AI prompt based on i18n.md guidelines
    prompt = f"Translate the following text from English to {request.lang}: '{english_text}'\nEnsure placeholders like {{name}} are preserved."
    
    # Call the existing AI Node CLI (adapted from dev/ai.md)
    try:
        result = subprocess.run(
            ["node", "src/backend/services/llm/ollama_cli.mjs", prompt],
            capture_output=True,
            text=True,
            check=True,
            env=os.environ  # Inherit environment variables like OLLAMA_BASE
        )
        translation = result.stdout.strip()
        
        # Simple post-processing: preserve placeholders, handle retries if translation matches source
        if translation.lower() == english_text.lower():
            retry_prompt = f"Retry translation for '{english_text}' to {request.lang}. Use localized forms and ensure it's different from source."
            retry_result = subprocess.run(
                ["node", "src/backend/services/llm/ollama_cli.mjs", retry_prompt],
                capture_output=True,
                text=True,
                check=True,
                env=os.environ
            )
            translation = retry_result.stdout.strip()
        else:
            retry_prompt = None
        
        return TranslateKeyResponse(
            ok=True,
            key=request.key,
            src=english_text,
            dst=translation,
            prompt=prompt,
            retry_prompt=retry_prompt
        )
    except subprocess.CalledProcessError as e:
        raise HTTPException(status_code=500, detail=f"AI translation failed: {e.stderr}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/i18n-admin/translate-batch", response_model=BatchTranslateResponse)
async def translate_batch(request: BatchTranslateRequest, credentials: HTTPAuthorizationCredentials = Depends(get_current_user)):
    # Validate auth
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Use the existing in-memory English translations
    english_translations = {
        "greeting": "Hello, world!",
        "welcome": "Welcome to the app",
        # Add more keys as needed
    }
    
    results = []
    for key in request.keys:
        english_text = english_translations.get(key, key)  # Fall back to key if not found
        if english_text is None:
            results.append(TranslateKeyResponse(ok=False, key=key, src="", dst="", prompt="", retry_prompt=None))
            continue  # Skip or handle missing key
        
        prompt = f"Translate the following text from English to {request.lang}: '{english_text}'\nEnsure placeholders like {{name}} are preserved."
        
        try:
            result_ai = subprocess.run(
                ["node", "src/backend/services/llm/ollama_cli.mjs", prompt],
                capture_output=True,
                text=True,
                check=True,
                env=os.environ
            )
            translation = result_ai.stdout.strip()
            
            if translation.lower() == english_text.lower():
                retry_prompt = f"Retry translation for '{english_text}' to {request.lang}. Use localized forms and ensure it's different from source."
                retry_result = subprocess.run(
                    ["node", "src/backend/services/llm/ollama_cli.mjs", retry_prompt],
                    capture_output=True,
                    text=True,
                    check=True,
                    env=os.environ
                )
                translation = retry_result.stdout.strip()
            else:
                retry_prompt = None
            
            results.append(TranslateKeyResponse(ok=True, key=key, src=english_text, dst=translation, prompt=prompt, retry_prompt=retry_prompt))
        except subprocess.CalledProcessError as e:
            results.append(TranslateKeyResponse(ok=False, key=key, src=english_text, dst="", prompt=prompt, retry_prompt=None))
        except Exception as e:
            results.append(TranslateKeyResponse(ok=False, key=key, src=english_text, dst="", prompt=prompt, retry_prompt=None))
    
    return BatchTranslateResponse(results=results)

@router.post("/i18n-admin/import-keys", response_model=ImportKeysResponse)
async def import_keys(request: ImportKeysRequest, credentials: HTTPAuthorizationCredentials = Depends(get_current_user)):
    # Validate auth
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Simulate importing missing keys; in a real system, this could query a database or AI for missing keys in the target language
    # For now, return a list of sample keys that might be missing (based on English keys)
    english_keys = ["greeting", "welcome", "error_message"]  # Example keys; should be dynamically fetched in production
    imported_keys = [key for key in english_keys if key not in ['key1', 'key2']]  # Placeholder logic; check against actual storage
    
    # Optionally, integrate with AI to generate translations for missing keys, but keep it simple for now
    return ImportKeysResponse(keys_imported=imported_keys)

@router.post("/i18n-admin/list-keys", response_model=ListKeysResponse)
async def list_keys(request: ListKeysRequest, credentials: HTTPAuthorizationCredentials = Depends(get_current_user)):
    # Validate auth
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Use the existing in-memory English translations keys (replace with database query in production)
    english_translations = {
        "greeting": "Hello, world!",
        "welcome": "Welcome to the app",
        "error_message": "An error occurred",
        # Add more keys as needed; this should be dynamically loaded in a real system
    }
    keys = list(english_translations.keys())
    return ListKeysResponse(keys=keys)

@router.post("/i18n-admin/save-translation", response_model=SaveTranslationResponse)
async def save_translation(request: SaveTranslationRequest, credentials: HTTPAuthorizationCredentials = Depends(get_current_user)):
    # Validate auth
    if not credentials.credentials:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Simulate saving to an in-memory store; in production, this should update a database or file
    # For now, use a global dictionary (not persistent)
    if request.lang not in translations_store:
        translations_store[request.lang] = {}
    translations_store[request.lang][request.key] = request.translation
    
    return SaveTranslationResponse(ok=True, message=f"Saved translation for key '{request.key}' in language '{request.lang}'")
