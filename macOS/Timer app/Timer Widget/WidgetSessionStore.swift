import Foundation
import Security

struct WidgetStoredSession: Codable {
    let session: WidgetSupabaseSession
    let projectURL: String
    let publishableKey: String
    let savedAt: Date

    var isExpired: Bool {
        let refreshMargin = min(60, max(0, session.expiresIn / 10))
        let usableLifetime = max(0, session.expiresIn - refreshMargin)
        return Date() >= savedAt.addingTimeInterval(TimeInterval(usableLifetime))
    }
}

struct WidgetSupabaseSession: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String
    let user: WidgetSupabaseUser
}

struct WidgetSupabaseUser: Codable {
    let id: String
    let email: String?
}

enum WidgetSessionStore {
    private static let service = "kirill-katz.Timer-app.supabase-session"
    private static let account = "current-session"
    private static let accessGroup = "group.kirill-katz.timer-app"

    static func load() throws -> WidgetStoredSession {
        var query = baseQuery
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne

        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound {
            throw FocusDataError.signedOut
        }
        guard status == errSecSuccess, let data = item as? Data else {
            throw FocusDataError.sessionUnavailable
        }
        guard let context = try? JSONDecoder().decode(WidgetStoredSession.self, from: data) else {
            throw FocusDataError.sessionCorrupted
        }
        return context
    }

    static func save(_ context: WidgetStoredSession) throws {
        let data = try JSONEncoder().encode(context)
        let attributes: [String: Any] = [
            kSecValueData as String: data
        ]
        let updateStatus = SecItemUpdate(
            baseQuery as CFDictionary,
            attributes as CFDictionary
        )

        if updateStatus == errSecSuccess { return }
        guard updateStatus == errSecItemNotFound else {
            throw FocusDataError.sessionUnavailable
        }

        var addQuery = baseQuery
        attributes.forEach { addQuery[$0.key] = $0.value }
        addQuery[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlock
        let addStatus = SecItemAdd(addQuery as CFDictionary, nil)

        if addStatus == errSecDuplicateItem {
            let retryStatus = SecItemUpdate(
                baseQuery as CFDictionary,
                attributes as CFDictionary
            )
            guard retryStatus == errSecSuccess else {
                throw FocusDataError.sessionUnavailable
            }
            return
        }

        guard addStatus == errSecSuccess else {
            throw FocusDataError.sessionUnavailable
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

actor WidgetAuthManager {
    static let shared = WidgetAuthManager()

    private let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 15
        return URLSession(configuration: configuration)
    }()

    func context(rejectedAccessToken: String? = nil) async throws -> WidgetStoredSession {
        let current = try WidgetSessionStore.load()
        let tokenWasReplaced = rejectedAccessToken.map {
            $0 != current.session.accessToken
        } ?? false

        if tokenWasReplaced || (!current.isExpired && rejectedAccessToken == nil) {
            return current
        }
        return try await refresh(current)
    }

    private func refresh(_ context: WidgetStoredSession) async throws -> WidgetStoredSession {
        guard let baseURL = URL(string: context.projectURL),
              let url = URL(
                string: "/auth/v1/token?grant_type=refresh_token",
                relativeTo: baseURL
              )?.absoluteURL else {
            throw FocusDataError.invalidConfiguration
        }

        var request = URLRequest(url: url, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue(context.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            RefreshRequest(refreshToken: context.session.refreshToken)
        )

        let (data, response) = try await session.data(for: request)
        guard let response = response as? HTTPURLResponse else {
            throw FocusDataError.invalidResponse
        }
        guard (200..<300).contains(response.statusCode) else {
            if response.statusCode == 400 || response.statusCode == 401 {
                // The host app may have refreshed and replaced this token while this
                // request was in flight. Use that newer session instead of signing out.
                let latest = try WidgetSessionStore.load()
                if latest.session.accessToken != context.session.accessToken {
                    return latest
                }
                throw FocusDataError.signedOut
            }
            throw FocusDataError.requestFailed(response.statusCode)
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard let session = try? decoder.decode(WidgetSupabaseSession.self, from: data) else {
            throw FocusDataError.invalidResponse
        }

        let refreshed = WidgetStoredSession(
            session: session,
            projectURL: context.projectURL,
            publishableKey: context.publishableKey,
            savedAt: Date()
        )

        // Do not overwrite a token the host app rotated while this request ran.
        let latest = try WidgetSessionStore.load()
        if latest.session.accessToken != context.session.accessToken {
            return latest
        }

        try WidgetSessionStore.save(refreshed)
        return refreshed
    }
}

private struct RefreshRequest: Encodable {
    let refreshToken: String

    private enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}
