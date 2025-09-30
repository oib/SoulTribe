#!/bin/bash

# Script to update production translation files
# Make sure to run with appropriate permissions

# Define paths
TRANSLATION_DIR="/var/www/soultribe.chat/web/i18n"
BACKUP_DIR="/var/backups/soultribe/translations/$(date +%Y%m%d_%H%M%S)"

# Create backup
mkdir -p "$BACKUP_DIR"
cp -r "$TRANSLATION_DIR" "$BACKUP_DIR"

echo "Backup created at $BACKUP_DIR"

# Update translations
# Make sure to replace with the actual path to your local changes
cp -r /home/oib/windsurf/soultribe.chat/web/i18n/* "$TRANSLATION_DIR/"

# Set proper permissions (adjust as needed)
chown -R www-data:www-data "$TRANSLATION_DIR"
chmod -R 755 "$TRANSLATION_DIR"

echo "Translation files updated successfully"
echo "Please restart the web server for changes to take effect"
