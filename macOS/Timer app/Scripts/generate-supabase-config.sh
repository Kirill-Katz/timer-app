#!/bin/sh

set -eu

env_file="${SRCROOT}/../../.env"
output_file="${TARGET_BUILD_DIR}/${UNLOCALIZED_RESOURCES_FOLDER_PATH}/SupabaseConfig.plist"

mkdir -p "$(dirname "${output_file}")"
/usr/bin/plutil -create xml1 "${output_file}"

if [ ! -f "${env_file}" ]; then
    echo "warning: Missing ${env_file}; Supabase login will remain unconfigured."
    exit 0
fi

read_value() {
    /usr/bin/awk -v key="$1" \
        'index($0, key "=") == 1 { print substr($0, length(key) + 2); exit }' \
        "${env_file}"
}

strip_quotes() {
    value="$1"
    case "${value}" in
        \"*\") value=${value#\"}; value=${value%\"} ;;
        \'*\') value=${value#\'}; value=${value%\'} ;;
    esac
    printf '%s' "${value}"
}

supabase_url=$(strip_quotes "$(read_value VITE_SUPABASE_URL)")
supabase_key=$(strip_quotes "$(read_value VITE_SUPABASE_PUBLISHABLE_KEY)")

if [ -z "${supabase_url}" ] || [ -z "${supabase_key}" ]; then
    echo "warning: .env must define VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY."
    exit 0
fi

/usr/bin/plutil -insert SupabaseURL -string "${supabase_url}" "${output_file}"
/usr/bin/plutil -insert SupabasePublishableKey -string "${supabase_key}" "${output_file}"
