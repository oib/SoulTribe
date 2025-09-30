// Admin i18n JavaScript for handling UI interactions and API calls
document.addEventListener('DOMContentLoaded', () => {
    const simpleI18n = window.SimpleI18n; // Reference to existing i18n system
    if (simpleI18n && simpleI18n._ready) {
        simpleI18n.updateUI(); // Ensure UI is translated on load
    } else {
        simpleI18n.init().then(() => simpleI18n.updateUI()); // Init i18n if not ready
    }

    // Helpers
    const getAuthHeaders = () => ({
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
    });
    const isDebug = () => document.getElementById('debug-panel')?.style.display !== 'none';
    const logDebug = (msg) => {
        const pane = document.getElementById('debug-log');
        if (pane && isDebug()) pane.textContent += `${msg}\n`;
    };

    // Populate language selector
    simpleI18n.detectSupportedLanguages().then(languages => {
        const select = document.getElementById('locale-select');
        languages.forEach(lang => {
            const option = document.createElement('option');
            option.value = lang;
            option.textContent = simpleI18n.t(`languages.${lang}`) || lang; // Use i18n for display names if available
            select.appendChild(option);
        });
        select.addEventListener('change', (e) => {
            simpleI18n.changeLanguage(e.target.value).then(() => simpleI18n.updateUI());
        });
    });

    // Function to fetch and populate translation keys from backend
    async function loadKeys() {
        try {
            const response = await fetch('/i18n-admin/list-keys', {
                method: 'POST',
                headers: getAuthHeaders()
            });
            if (!response.ok) throw new Error('Failed to fetch keys');
            const data = await response.json();
            const keys = data.keys;
            keys.forEach(key => {
                if (!document.getElementById(`row-${key}`)) { // Avoid adding duplicates
                    const row = document.createElement('tr');
                    row.id = `row-${key}`;
                    row.innerHTML = `
                        <td>${key}</td>
                        <td data-i18n="${key}"></td> <!-- English or current lang -->
                        <td>
                            <textarea id="trans-${key}" rows="2" style="width: 100%"></textarea>
                        </td>
                        <td>
                            <button onclick="translateKey('${key}')">Translate</button>
                            <button onclick="saveTranslation('${key}')">Save</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            });
        } catch (error) {
            console.error('Error loading keys:', error);
            alert('Failed to load translation keys: ' + error.message);
        }
    }

    const tableBody = document.querySelector('#translation-table tbody');
    loadKeys();

    // Function to translate a single key using backend API
    window.translateKey = async (key) => {
        const lang = document.getElementById('locale-select').value;
        try {
            const response = await fetch('/i18n-admin/translate-key', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ lang, key })
            });
            if (!response.ok) throw new Error('Translation failed');
            const data = await response.json();
            const ta = document.getElementById(`trans-${key}`);
            if (ta) ta.value = data.dst;
            // Log debug info if panel is open
            logDebug(`Translated key '${key}' to lang '${lang}': ${data.dst}\nPrompt: ${data.prompt}`);
        } catch (error) {
            console.error('Translation error:', error);
            alert('Failed to translate key');
        }
    };

    // Function to save a translation using backend API
    window.saveTranslation = async (key) => {
        const lang = document.getElementById('locale-select').value;
        const el = document.getElementById(`trans-${key}`);
        const translationText = el && 'value' in el ? el.value : (el?.textContent || '');
        try {
            const response = await fetch('/i18n-admin/save-translation', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ key, lang, translation: translationText })
            });
            if (!response.ok) throw new Error('Save failed');
            const data = await response.json();
            if (data.ok) {
                alert(data.message); // Show success message
            } else {
                alert('Save failed: ' + data.message);
            }
        } catch (error) {
            console.error('Save translation error:', error);
            alert('Failed to save translation: ' + error.message);
        }
    };

    // Batch translate button handler
    document.getElementById('batch-translate-btn').addEventListener('click', async (e) => {
        const lang = document.getElementById('locale-select').value;
        const keys = Array.from(tableBody.children).map(row => row.id.replace('row-', '')); // Get keys from table
        try {
            const btn = e.currentTarget;
            btn.disabled = true;
            const response = await fetch('/i18n-admin/translate-batch', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ keys, lang })
            });
            if (!response.ok) throw new Error('Batch translation failed');
            const data = await response.json();
            data.results.forEach(result => {
                if (result.ok) {
                    const ta = document.getElementById(`trans-${result.key}`);
                    if (ta) ta.value = result.dst;
                }
            });
            // Debug logging
            logDebug('Batch translation results:\n' + JSON.stringify(data, null, 2));
        } catch (error) {
            console.error('Batch translation error:', error);
            alert('Batch translation failed');
        } finally {
            e.currentTarget.disabled = false;
        }
    });

    // Import keys button handler (updated to call backend endpoint)
    document.getElementById('import-keys-btn').addEventListener('click', async (e) => {
        const lang = document.getElementById('locale-select').value;
        try {
            const btn = e.currentTarget;
            btn.disabled = true;
            const response = await fetch('/i18n-admin/import-keys', {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({ lang })
            });
            if (!response.ok) throw new Error('Import keys failed');
            const data = await response.json();
            const importedKeys = data.keys_imported;
            importedKeys.forEach(key => {
                if (!document.getElementById(`row-${key}`)) { // Avoid adding duplicates
                    const row = document.createElement('tr');
                    row.id = `row-${key}`;
                    row.innerHTML = `
                        <td>${key}</td>
                        <td data-i18n="${key}"></td>
                        <td>
                            <textarea id="trans-${key}" rows="2" style="width: 100%"></textarea>
                        </td>
                        <td>
                            <button onclick="translateKey('${key}')">Translate</button>
                            <button onclick="saveTranslation('${key}')">Save</button>
                        </td>
                    `;
                    tableBody.appendChild(row);
                }
            });
            alert(`Imported ${importedKeys.length} keys successfully.`);
            // Update UI translations after import
            simpleI18n.updateUI();
        } catch (error) {
            console.error('Import keys error:', error);
            alert('Failed to import keys: ' + error.message);
        } finally {
            e.currentTarget.disabled = false;
        }
    });

    // Toggle debug panel
    document.getElementById('toggle-debug').addEventListener('click', () => {
        const debugPanel = document.getElementById('debug-panel');
        debugPanel.style.display = debugPanel.style.display === 'none' ? 'block' : 'none';
    });

    // Listen for language changes to update UI
    window.addEventListener('languageChanged', () => {
        simpleI18n.updateUI();
    });

    // Add test function for debugging i18n features
    async function testI18nFeatures() {
        console.log('Testing i18n features...');
        // Test list keys endpoint
        try {
            const listResponse = await fetch('/i18n-admin/list-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                }
            });
            if (listResponse.ok) {
                const listData = await listResponse.json();
                console.log('Keys listed successfully:', listData.keys);
            } else {
                console.error('List keys test failed with status:', listResponse.status);
            }
        } catch (error) {
            console.error('List keys test error:', error);
        }
        // Test translate key endpoint with a sample key, e.g., 'greeting'
        try {
            const translateResponse = await fetch('/i18n-admin/translate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ lang: 'fr', key: 'greeting' })
            });
            if (translateResponse.ok) {
                const translateData = await translateResponse.json();
                console.log('Translation test successful:', translateData);
            } else {
                console.error('Translate key test failed with status:', translateResponse.status);
            }
        } catch (error) {
            console.error('Translate key test error:', error);
        }
        // Test save translation endpoint with a sample key and translation
        try {
            const saveResponse = await fetch('/i18n-admin/save-translation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ key: 'greeting', lang: 'fr', translation: 'Bonjour le monde!' })
            });
            if (saveResponse.ok) {
                const saveData = await saveResponse.json();
                console.log('Save translation test successful:', saveData);
            } else {
                console.error('Save translation test failed with status:', saveResponse.status);
            }
        } catch (error) {
            console.error('Save translation test error:', error);
        }
        // Test import keys endpoint with a sample language
        try {
            const importResponse = await fetch('/i18n-admin/import-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ lang: 'fr' })
            });
            if (importResponse.ok) {
                const importData = await importResponse.json();
                console.log('Import keys test successful:', importData);
            } else {
                console.error('Import keys test failed with status:', importResponse.status);
            }
        } catch (error) {
            console.error('Import keys test error:', error);
        }
        // Test batch translation endpoint with sample keys
        try {
            const batchResponse = await fetch('/i18n-admin/translate-batch', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ keys: ['greeting', 'welcome'], lang: 'fr' })
            });
            if (batchResponse.ok) {
                const batchData = await batchResponse.json();
                console.log('Batch translation test successful:', batchData);
            } else {
                console.error('Batch translation test failed with status:', batchResponse.status);
            }
        } catch (error) {
            console.error('Batch translation test error:', error);
        }
        // Test for authentication failure by omitting token
        try {
            const authFailResponse = await fetch('/i18n-admin/list-keys', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'  // Intentionally omit Authorization header to simulate unauthenticated request
                }
            });
            if (!authFailResponse.ok) {
                console.log('Authentication failure test: Expected error received with status', authFailResponse.status);
            } else {
                console.error('Authentication failure test failed: Unexpected success');
            }
        } catch (error) {
            console.log('Authentication failure test successful: Error caught as expected', error);
        }
        // Test for invalid input (e.g., non-existent key) in translate key endpoint
        try {
            const invalidKeyResponse = await fetch('/i18n-admin/translate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ lang: 'fr', key: 'invalid_key' })  // Use a key that shouldn't exist
            });
            if (!invalidKeyResponse.ok) {
                console.log('Invalid key test successful: Error received with status', invalidKeyResponse.status);
            } else {
                console.error('Invalid key test failed: Unexpected success');
            }
        } catch (error) {
            console.log('Invalid key test successful: Error caught as expected', error);
        }
        // Test for invalid language input in translate key endpoint
        try {
            const invalidLangResponse = await fetch('/i18n-admin/translate-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ lang: 'invalid_lang', key: 'greeting' })  // Use an invalid language code
            });
            if (!invalidLangResponse.ok) {
                console.log('Invalid language test successful: Error received with status', invalidLangResponse.status);
            } else {
                console.error('Invalid language test failed: Unexpected success');
            }
        } catch (error) {
            console.log('Invalid language test successful: Error caught as expected', error);
        }
        // Test for invalid input in save translation endpoint (e.g., empty key)
        try {
            const invalidSaveResponse = await fetch('/i18n-admin/save-translation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({ key: '', lang: 'fr', translation: 'Test translation' })  // Use invalid empty key
            });
            if (!invalidSaveResponse.ok) {
                console.log('Invalid input save test successful: Error received with status', invalidSaveResponse.status);
            } else {
                console.error('Invalid input save test failed: Unexpected success');
            }
        } catch (error) {
            console.log('Invalid input save test successful: Error caught as expected', error);
        }
    }

    // Add a test button to the DOM for running i18n tests
    const testButton = document.createElement('button');
    testButton.id = 'test-i18n-btn';
    testButton.textContent = 'Run i18n Tests';
    document.body.appendChild(testButton); // Append to body or a specific container
    testButton.addEventListener('click', () => {
        testI18nFeatures();
        // Optionally, clear or append to debug log before running tests
        const debugLog = document.getElementById('debug-log');
        debugLog.textContent = 'Running tests...';
    });
});
