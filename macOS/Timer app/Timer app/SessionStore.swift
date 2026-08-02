import Foundation
import Security

enum SessionStore {
    private static let service = "kirill-katz.Timer-app.supabase-session"
    private static let account = "current-session"
    private static let accessGroup = "group.kirill-katz.timer-app"

    static func save(_ session: SupabaseSession) throws {
        guard let projectURL = SupabaseConfiguration.projectURL else {
            throw SessionStoreError.missingConfiguration
        }

        let storedSession = StoredSupabaseSession(
            session: session,
            projectURL: projectURL.absoluteString,
            publishableKey: SupabaseConfiguration.publishableKey,
            savedAt: Date()
        )
        let data = try JSONEncoder().encode(storedSession)
        try upsert(data)
    }

    static func load() throws -> SupabaseSession? {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            return nil
        }
        guard status == errSecSuccess, let data = item as? Data else {
            throw KeychainError(status: status)
        }

        let decoder = JSONDecoder()
        if let storedSession = try? decoder.decode(StoredSupabaseSession.self, from: data) {
            return storedSession.session
        }

        // Migrate sessions saved by the first app version to the shared format.
        let legacySession = try decoder.decode(SupabaseSession.self, from: data)
        try save(legacySession)
        return legacySession
    }

    static func clear() throws {
        let status = SecItemDelete(baseQuery as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError(status: status)
        }
    }

    private static func upsert(_ data: Data) throws {
        let attributes: [String: Any] = [
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock
        ]
        let updateStatus = SecItemUpdate(
            baseQuery as CFDictionary,
            attributes as CFDictionary
        )

        if updateStatus == errSecSuccess {
            return
        }
        guard updateStatus == errSecItemNotFound else {
            throw KeychainError(status: updateStatus)
        }

        var addQuery = baseQuery
        attributes.forEach { addQuery[$0.key] = $0.value }
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

        // Another process may have inserted the item between update and add.
        if addStatus == errSecDuplicateItem {
            let retryStatus = SecItemUpdate(
                baseQuery as CFDictionary,
                attributes as CFDictionary
            )
            guard retryStatus == errSecSuccess else {
                throw KeychainError(status: retryStatus)
            }
            return
        }

        guard addStatus == errSecSuccess else {
            throw KeychainError(status: addStatus)
        }
    }

    private static var baseQuery: [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
            kSecAttrAccessGroup as String: accessGroup,
            kSecUseDataProtectionKeychain as String: true
        ]
    }
}

private struct StoredSupabaseSession: Codable {
    let session: SupabaseSession
    let projectURL: String
    let publishableKey: String
    let savedAt: Date
}

private enum SessionStoreError: LocalizedError {
    case missingConfiguration

    var errorDescription: String? {
        "Supabase configuration is missing."
    }
}

private struct KeychainError: LocalizedError {
    let status: OSStatus

    var errorDescription: String? {
        SecCopyErrorMessageString(status, nil) as String?
            ?? "Keychain error \(status)."
    }
}
