import Foundation

struct SupabaseSession: Codable {
    let accessToken: String
    let refreshToken: String
    let expiresIn: Int
    let tokenType: String
    let user: SupabaseUser
}

struct SupabaseUser: Codable {
    let id: String
    let email: String?
}

enum AuthServiceError: LocalizedError {
    case notConfigured
    case invalidResponse
    case unauthorized
    case serverMessage(String)

    var errorDescription: String? {
        switch self {
        case .notConfigured:
            "Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to the repository's .env file, then rebuild the app."
        case .invalidResponse:
            "Supabase returned an unexpected response."
        case .unauthorized:
            "Your session has expired. Please sign in again."
        case .serverMessage(let message):
            message
        }
    }
}

struct AuthService {
    private static let session: URLSession = {
        let configuration = URLSessionConfiguration.ephemeral
        configuration.timeoutIntervalForRequest = 10
        configuration.timeoutIntervalForResource = 15
        return URLSession(configuration: configuration)
    }()

    func signIn(email: String, password: String) async throws -> SupabaseSession {
        guard SupabaseConfiguration.isConfigured,
              let projectURL = SupabaseConfiguration.projectURL,
              let endpoint = URL(
                string: "/auth/v1/token?grant_type=password",
                relativeTo: projectURL
              )?.absoluteURL else {
            throw AuthServiceError.notConfigured
        }

        var request = URLRequest(url: endpoint)
        request.httpMethod = "POST"
        request.setValue(SupabaseConfiguration.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(Credentials(email: email, password: password))

        let (data, response) = try await Self.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthServiceError.invalidResponse
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase

        guard (200..<300).contains(httpResponse.statusCode) else {
            let error = try? JSONDecoder().decode(SupabaseErrorResponse.self, from: data)
            throw AuthServiceError.serverMessage(
                error?.bestMessage ?? "Sign in failed (HTTP \(httpResponse.statusCode))."
            )
        }

        do {
            return try decoder.decode(SupabaseSession.self, from: data)
        } catch {
            throw AuthServiceError.invalidResponse
        }
    }

    func validate(_ stored: StoredSupabaseSession) async throws {
        guard let baseURL = URL(string: stored.projectURL) else {
            throw AuthServiceError.notConfigured
        }

        let endpoint = baseURL.appendingPathComponent("auth/v1/user")
        var request = URLRequest(url: endpoint, timeoutInterval: 10)
        request.setValue(stored.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue(
            "Bearer \(stored.session.accessToken)",
            forHTTPHeaderField: "Authorization"
        )

        let (_, response) = try await Self.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthServiceError.invalidResponse
        }
        if httpResponse.statusCode == 401 {
            throw AuthServiceError.unauthorized
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            throw AuthServiceError.serverMessage(
                "Unable to verify the session (HTTP \(httpResponse.statusCode))."
            )
        }
    }

    func refresh(_ stored: StoredSupabaseSession) async throws -> SupabaseSession {
        guard let baseURL = URL(string: stored.projectURL),
              let endpoint = URL(
                string: "/auth/v1/token?grant_type=refresh_token",
                relativeTo: baseURL
              )?.absoluteURL else {
            throw AuthServiceError.notConfigured
        }

        var request = URLRequest(url: endpoint, timeoutInterval: 10)
        request.httpMethod = "POST"
        request.setValue(stored.publishableKey, forHTTPHeaderField: "apikey")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONEncoder().encode(
            RefreshCredentials(refreshToken: stored.session.refreshToken)
        )

        let (data, response) = try await Self.session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw AuthServiceError.invalidResponse
        }
        if httpResponse.statusCode == 400 || httpResponse.statusCode == 401 {
            throw AuthServiceError.unauthorized
        }
        guard (200..<300).contains(httpResponse.statusCode) else {
            let error = try? JSONDecoder().decode(SupabaseErrorResponse.self, from: data)
            throw AuthServiceError.serverMessage(
                error?.bestMessage ?? "Session refresh failed (HTTP \(httpResponse.statusCode))."
            )
        }

        let decoder = JSONDecoder()
        decoder.keyDecodingStrategy = .convertFromSnakeCase
        guard let refreshed = try? decoder.decode(SupabaseSession.self, from: data) else {
            throw AuthServiceError.invalidResponse
        }
        return refreshed
    }
}

private struct Credentials: Encodable {
    let email: String
    let password: String
}

private struct RefreshCredentials: Encodable {
    let refreshToken: String

    private enum CodingKeys: String, CodingKey {
        case refreshToken = "refresh_token"
    }
}

private struct SupabaseErrorResponse: Decodable {
    let message: String?
    let msg: String?
    let errorDescription: String?

    var bestMessage: String? {
        message ?? msg ?? errorDescription
    }

    private enum CodingKeys: String, CodingKey {
        case message
        case msg
        case errorDescription = "error_description"
    }
}
